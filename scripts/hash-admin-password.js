const crypto = require("node:crypto");
const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Usage: node scripts/hash-admin-password.js 'a-long-unique-password' (minimum 12 characters)");
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
console.log(salt + ":" + hash);
