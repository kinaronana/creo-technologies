(()=> {
const pages=[["index.html","Homepage"],["website-development.html","Website Development"],["website-maintenance.html","Website Maintenance"],["security-systems.html","Website Security"],["ai-automation.html","AI Automation"]];
const services=[["website-development","Website Development"],["website-maintenance","Website Maintenance"],["security-systems","Website Security"],["ai-automation","AI Automation"]];
let current=null,pageData={},priceData={};
const $=id=>document.getElementById(id);
async function api(action,extra={}) {
  const r=await fetch("/.netlify/functions/admin-api",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...extra})});
  const data=await r.json().catch(()=>({error:"Unexpected server response."}));
  if(!r.ok) throw new Error(data.error||"Request failed.");
  return data;
}
function status(id,msg,type=""){const el=$(id);el.textContent=msg;el.className="status "+type;}
async function login(){
 const b=$("login-button");b.disabled=true;status("login-status","Signing in…");
 try{await api("login",{username:$("username").value.trim(),password:$("password").value});$("login-panel").classList.add("hidden");$("workspace").classList.remove("hidden");$("password").value="";await init();}
 catch(e){status("login-status",e.message,"error");}
 finally{b.disabled=false;}
}
async function logout(){try{await api("logout");}catch(_){}$("workspace").classList.add("hidden");$("login-panel").classList.remove("hidden");$("username").value="";$("password").value="";status("login-status","You have been signed out.");}
function labelFor(node,i){const p=node.parentElement;const tag=p?p.tagName.toLowerCase():"text";let hint=(p?.className?.toString()||"").trim().replace(/\\s+/g," ");if(!hint&&p?.id)hint="#"+p.id;if(!hint)hint=tag;return tag+(hint!==tag?" · "+hint:"")+" · text "+(i+1);}
async function loadPage(path){
 current=path;status("page-status","Loading "+path+"…");
 try{
  const data=await api("get",{path});pageData[path]=data;
  const doc=new DOMParser().parseFromString(data.content,"text/html"),box=$("page-editor");box.innerHTML="";
  [["Page title",doc.querySelector("title")?.textContent||"",v=>{if(doc.querySelector("title"))doc.querySelector("title").textContent=v}],["Search description",doc.querySelector('meta[name="description"]')?.content||"",v=>{if(doc.querySelector('meta[name="description"]'))doc.querySelector('meta[name="description"]').content=v}]].forEach(([label,value,set])=>{
   const wrap=document.createElement("div");wrap.className="edit-field";const l=document.createElement("label");l.textContent=label;const input=document.createElement("textarea");input.value=value;input.addEventListener("input",()=>set(input.value));wrap.append(l,input);box.append(wrap);
  });
  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),nodes=[];let n;
  while(n=walker.nextNode()){if(!n.nodeValue.trim()||n.parentElement.closest("script,style,noscript,svg"))continue;nodes.push(n);}
  nodes.forEach((node,i)=>{const wrap=document.createElement("div");wrap.className="edit-field";const l=document.createElement("label");l.textContent=labelFor(node,i);const input=document.createElement("textarea");input.value=node.nodeValue.trim();input.addEventListener("input",()=>{node.nodeValue=input.value;});wrap.append(l,input);box.append(wrap);});
  box._doc=doc;status("page-status",nodes.length+" editable text items loaded.","ok");
 }catch(e){status("page-status",e.message,"error");}
}
async function savePage(){
 if(!current)return;const b=$("save-page");b.disabled=true;status("page-status","Publishing "+current+"…");
 try{const html="<!doctype html>\\n"+$("page-editor")._doc.documentElement.outerHTML;const saved=await api("save",{path:current,content:html,sha:pageData[current].sha});pageData[current].sha=saved.sha;status("page-status","Saved. Netlify will deploy the update shortly.","ok");}
 catch(e){status("page-status",e.message,"error");}finally{b.disabled=false;}
}
async function loadPrices(){
 const f=await api("get",{path:"pricing.json"});priceData=JSON.parse(f.content);priceData._sha=f.sha;const box=$("price-editor");box.innerHTML="";
 services.forEach(([key,name])=>{const p=priceData.services[key]||{amount:"",currency:"KES",billing:"",note:"Contact us for pricing"};const card=document.createElement("div");card.className="price-card";const h=document.createElement("h3");h.textContent=name;card.append(h);const row=document.createElement("div");row.className="row";
  [["Amount","amount","number"],["Currency","currency","text"],["Billing period","billing","text"],["Display when no amount","note","text"]].forEach(([label,field,type])=>{const wrap=document.createElement("div");wrap.className="field"+(field==="note"?" note":"");const l=document.createElement("label");l.textContent=label;const input=document.createElement("input");input.type=type;if(type==="number"){input.min="0";input.step="0.01";}input.value=p[field]||"";input.addEventListener("input",()=>{priceData.services[key][field]=input.value;});wrap.append(l,input);row.append(wrap);});card.append(row);box.append(card);
 });
}
async function savePrices(){const b=$("save-prices");b.disabled=true;status("price-status","Saving prices…");try{const saved=await api("save",{path:"pricing.json",content:JSON.stringify({services:priceData.services},null,2),sha:priceData._sha});priceData._sha=saved.sha;status("price-status","Prices saved. Netlify will deploy the update shortly.","ok");}catch(e){status("price-status",e.message,"error");}finally{b.disabled=false;}}
async function init(){
 const tabs=$("page-tabs");tabs.innerHTML="";
 pages.forEach(([path,name],i)=>{const b=document.createElement("button");b.textContent=name;b.className=i===0?"active":"";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");loadPage(path);});tabs.append(b);});
 await Promise.all([loadPage("index.html"),loadPrices()]);
}
$("login-button").addEventListener("click",login);$("password").addEventListener("keydown",e=>{if(e.key==="Enter")login();});$("logout").addEventListener("click",logout);$("save-page").addEventListener("click",savePage);$("save-prices").addEventListener("click",savePrices);
api("session").then(async()=>{$("login-panel").classList.add("hidden");$("workspace").classList.remove("hidden");await init();}).catch(()=>{});
})();