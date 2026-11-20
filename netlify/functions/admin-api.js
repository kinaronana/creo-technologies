const crypto = require("node:crypto");

const ALLOWED_FILES = new Set([
  "index.html",
  "website-development.html",
  "website-maintenance.html",
  "security-systems.html",
  "ai-automation.html",
  "pricing.json"
]);

function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
    body: JSON.stringify(body)
  };
}
function cookieValue(event, name) {
  const raw = event.headers.cookie || event.headers.Cookie || "";
  const part = raw.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}
function validSession(event) {
  const token = cookieValue(event, "creo_admin_session");
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !process.env.ADMIN_SESSION_SECRET) return false;
  const expected = crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now() && data.user === process.env.ADMIN_USERNAME;
  } catch (_) { return false; }
}
function verifyPassword(password) {
  const stored = process.env.ADMIN_PASSWORD_HASH || "";
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{32,}$/.test(salt) || !/^[a-f0-9]{64,}$/.test(hash)) return false;
  const actual = crypto.scryptSync(password, salt, hash.length / 2);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
async function github(path, method = "GET", content, sha) {
  const token = process.env.CREO_GITHUB_TOKEN;
  if (!token) throw new Error("The server is missing CREO_GITHUB_TOKEN.");
  const url = "https://api.github.com/repos/kinaronana/creo-technologies/contents/" + encodeURIComponent(path).replace(/%2F/g, "/");
  const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const options = { method, headers };
  if (method === "PUT") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify({ message: "Update " + path + " via Creo admin", content: Buffer.from(content, "utf8").toString("base64"), sha, branch: "main" });
  }
  const r = await fetch(url, options);
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "GitHub request failed.");
  return data;
}
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed." });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (_) { return response(400, { error: "Invalid request." }); }

  if (body.action === "login") {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH || !process.env.ADMIN_SESSION_SECRET) return response(503, { error: "Admin login is not configured yet. Add the required Netlify environment variables." });
    const username = String(body.username || "");
    const password = String(body.password || "");
    const u = Buffer.from(username);
    const expectedUser = Buffer.from(process.env.ADMIN_USERNAME);
    const userOk = u.length === expectedUser.length && crypto.timingSafeEqual(u, expectedUser);
    if (!userOk || !verifyPassword(password)) return response(401, { error: "Incorrect username or password." });
    const payload = Buffer.from(JSON.stringify({ user: username, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
    const signature = crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url");
    return response(200, { ok: true }, { "Set-Cookie": "creo_admin_session=" + payload + "." + signature + "; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/admin-api; Max-Age=28800" });
  }

  if (body.action === "logout") {
    return response(200, { ok: true }, { "Set-Cookie": "creo_admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/admin-api; Max-Age=0" });
  }

  if (!validSession(event)) return response(401, { error: "Your session has expired. Please sign in again." });

  try {
    if (body.action === "get") {
      const path = String(body.path || "");
      if (!ALLOWED_FILES.has(path)) return response(400, { error: "That file cannot be accessed." });
      const file = await github(path);
      return response(200, { content: Buffer.from(file.content, "base64").toString("utf8"), sha: file.sha });
    }
    if (body.action === "save") {
      const path = String(body.path || "");
      if (!ALLOWED_FILES.has(path) || typeof body.content !== "string" || typeof body.sha !== "string") return response(400, { error: "Invalid save request." });
      if (Buffer.byteLength(body.content, "utf8") > 500000) return response(413, { error: "File is too large." });
      if (path === "pricing.json") {
        let parsed;
        try { parsed = JSON.parse(body.content); } catch (_) { return response(400, { error: "Pricing data must be valid JSON." }); }
        const keys = ["website-development", "website-maintenance", "security-systems", "ai-automation"];
        if (!parsed.services || keys.some(k => !parsed.services[k] || typeof parsed.services[k] !== "object")) return response(400, { error: "Pricing data is incomplete." });
      }
      const saved = await github(path, "PUT", body.content, body.sha);
      return response(200, { ok: true, sha: saved.content.sha });
    }
    if (body.action === "session") return response(200, { ok: true });
    return response(400, { error: "Unknown action." });
  } catch (error) {
    return response(500, { error: error.message || "The request could not be completed." });
  }
};
