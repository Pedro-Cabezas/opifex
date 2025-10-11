// Si lo dejás vacío usa mismo origen; en Pages poné la URL de Render
// —— configuración de API (arriba del archivo)
const API_BASE = "https://opifex.onrender.com"; // en local podés dejar "" (cadena vacía)

// —— referencias UI (ya las tenías)
const box      = document.getElementById("chat-box");
const form     = document.getElementById("chat-form");
const input    = document.getElementById("user-input");
const resetBtn = document.getElementById("reset-btn");
const importBtn= document.getElementById("import-btn");
const iniFile  = document.getElementById("ini-file");

// panel derecho
const generateBtn = document.getElementById("generate-ini-btn");
const openIniFile = document.getElementById("open-ini-prusa-file");
const openIniBtn  = document.getElementById("open-ini-prusa-btn");

// ⬇️⬇️ AQUI MISMO: ocultar la tarjeta “Abrir en Prusa” si el backend es remoto
if (typeof API_BASE === "string" && API_BASE) {
  document.querySelectorAll('#open-ini-prusa-file, #open-ini-prusa-btn')
    .forEach(el => el?.closest('.card')?.remove());
}

// …y a partir de acá siguen tus listeners y funciones (chat, generar ini, etc.)

// sidebar (threads)
const listEl = document.getElementById("thread-list");
const newBtn = document.getElementById("new-thread");
const renBtn = document.getElementById("rename-thread");
const delBtn = document.getElementById("delete-thread");

// threads (local)
const THREADS_KEY = "oppi.threads";
const CURRENT_KEY = "oppi.currentThread";
function uuid(){return crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=(Math.random()*16)|0,v=c==="x"?r:(r&0x3)|0x8;return v.toString(16);});}
function loadThreads(){try{return JSON.parse(localStorage.getItem(THREADS_KEY))||{};}catch{return {};}}
function saveThreads(o){localStorage.setItem(THREADS_KEY, JSON.stringify(o));}
let threads = loadThreads();
let threadId = localStorage.getItem(CURRENT_KEY);
function ensureFirstThread(){if(!threadId){const id=uuid();threads[id]={name:"Conversación 1",created:Date.now()};saveThreads(threads);localStorage.setItem(CURRENT_KEY,id);threadId=id;}else if(!threads[threadId]){const id=uuid();threads[id]={name:"Conversación 1",created:Date.now()};saveThreads(threads);localStorage.setItem(CURRENT_KEY,id);threadId=id;}}
ensureFirstThread();

function renderThreadList(){
  listEl.innerHTML="";
  const entries = Object.entries(threads).sort((a,b)=>a[1].created-b[1].created);
  for(const [id,meta] of entries){
    const li=document.createElement("li");
    li.textContent=meta.name||"Sin título";
    if(id===threadId) li.classList.add("active");
    li.addEventListener("click",()=>switchThread(id));
    listEl.appendChild(li);
  }
}
function switchThread(id){ if(!threads[id]) return; threadId=id; localStorage.setItem(CURRENT_KEY,id); box.innerHTML=""; greet(); renderThreadList(); }
newBtn.addEventListener("click",()=>{const id=uuid();const n=Object.keys(threads).length+1;threads[id]={name:`Conversación ${n}`,created:Date.now()};saveThreads(threads);switchThread(id);});
renBtn.addEventListener("click",()=>{const curr=threads[threadId];if(!curr)return;const name=prompt("Nombre de la conversación:",curr.name||"");if(name&&name.trim()){curr.name=name.trim();saveThreads(threads);renderThreadList();}});
delBtn.addEventListener("click",()=>{if(!confirm("¿Eliminar esta conversación?"))return;delete threads[threadId];saveThreads(threads);const next=Object.keys(threads)[0]||null;if(!next){const id=uuid();threads[id]={name:"Conversación 1",created:Date.now()};saveThreads(threads);threadId=id;}else{threadId=next;}localStorage.setItem(CURRENT_KEY,threadId);box.innerHTML="";greet();renderThreadList();});

// helpers UI
function push(who,text,{allowHtml=false}={}){const msg=document.createElement("div");msg.className=`msg ${who}`;if(allowHtml)msg.innerHTML=text;else msg.textContent=text;box.appendChild(msg);box.scrollTop=box.scrollHeight;return msg;}
function setTyping(on=true){const id="__typing__";let el=document.getElementById(id);if(on){if(el)return;el=document.createElement("div");el.id=id;el.className="msg oppi";el.textContent="Oppi está escribiendo…";box.appendChild(el);}else if(el){el.remove();}box.scrollTop=box.scrollHeight;}
function toSimpleHtml(md){const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");let html=esc(md||"");html=html.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");html=html.replace(/`([^`]+?)`/g,"<code>$1</code>");html=html.replace(/\n/g,"<br>");return html;}
function extractIniBlock(text){const re=/```(?:ini)?\s*([\s\S]*?)```/i;const m=(text||"").match(re);return m?m[1].trim():null;}
function attachIniActions(msgEl, iniText, filename="perfil-oppi.prusa.ini"){
  const bar=document.createElement("div");bar.style.marginTop="8px";bar.style.display="flex";bar.style.flexWrap="wrap";bar.style.gap="8px";
  const pre=document.createElement("pre");pre.style.whiteSpace="pre-wrap";pre.style.margin="8px 0";pre.textContent=iniText;
  const btnDl=document.createElement("button");btnDl.type="button";btnDl.textContent="⬇️ Descargar .ini";btnDl.className="btn";
  btnDl.addEventListener("click",()=>{const blob=new Blob([iniText],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);});
  const btnOpen=document.createElement("button");btnOpen.type="button";btnOpen.textContent="🟠 Abrir en PrusaSlicer";btnOpen.className="btn";
  btnOpen.addEventListener("click",async()=>{try{const r=await fetch("${API_BASE}/open-prusa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iniText})});const data=await r.json();if(data.ok)push("oppi",`PrusaSlicer abierto con el perfil. (Archivo: ${data.loaded})`);else push("oppi",`No pude abrir PrusaSlicer: ${data.error||"error desconocido"}`);}catch{push("oppi","Error de red al abrir PrusaSlicer.");}});
  bar.appendChild(btnDl);bar.appendChild(btnOpen);msgEl.appendChild(bar);msgEl.appendChild(pre);box.scrollTop=box.scrollHeight;
}

// CHAT
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  push("user", text);
  input.value = "";
  setTyping(true);
  try {
    const r = await fetch("${API_BASE}/chat-oppi", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ message:text, threadId }) });
    const data = await r.json();
    setTyping(false);
    const reply = data.reply || "Hubo un problema al responder.";
    const msgEl = push("oppi", toSimpleHtml(reply), { allowHtml:true });
    const ini = extractIniBlock(reply);
    if (ini) attachIniActions(msgEl, ini);
  } catch {
    setTyping(false);
    push("oppi", "Error de red. Probá de nuevo.");
  }
});

// RESET
resetBtn?.addEventListener("click", async () => {
  try {
    await fetch("${API_BASE}/reset-thread",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({threadId})});
    push("oppi","Memoria reiniciada para este hilo. Podés seguir acá o crear una nueva conversación.");
  } catch { push("oppi","No pude reiniciar la memoria. Probá otra vez."); }
});

// Importar .ini (contexto conversacional)
importBtn?.addEventListener("click",()=>iniFile?.click());
iniFile?.addEventListener("change", async ()=>{
  const file = iniFile.files?.[0]; if(!file) return;
  push("user",`Importando perfil: ${file.name} ...`);
  const fd=new FormData(); fd.append("file",file); fd.append("threadId",threadId);
  try { const r=await fetch("${API_BASE}/import-ini",{method:"POST",body:fd}); const data=await r.json();
    if(data.ok) push("oppi", toSimpleHtml(`Perfil importado ✅<br>${data.summary}`), {allowHtml:true});
    else push("oppi",`No pude importar el .ini: ${data.error||"error desconocido"}`);
  } catch { push("oppi","Error de red importando el .ini."); }
  finally { iniFile.value=""; }
});

// 👉 GENERAR .ini con Oppi (motor IA + tu esquema)
generateBtn?.addEventListener("click", async ()=>{
  push("user","(Generar .ini ahora con lo conversado)");
  setTyping(true);
  try{
    const r = await fetch("${API_BASE}/generate-ini-ai", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ threadId })
    });
    const data = await r.json();
    setTyping(false);
    if(!data.ok) return push("oppi", `No pude generar el .ini: ${data.error || "error desconocido"}`);
    // Mostrar .ini y acciones
    const msgEl = push("oppi", toSimpleHtml("Perfil generado automáticamente ✅"), { allowHtml:true });
    attachIniActions(msgEl, data.iniText);
  }catch{
    setTyping(false);
    push("oppi","Error de red generando el .ini.");
  }
});

// Abrir .ini local en Prusa (panel derecho)
openIniBtn?.addEventListener("click", async ()=>{
  const file=openIniFile.files?.[0]; if(!file) return alert("Elegí un archivo .ini primero.");
  const text=await file.text();
  push("user",`Abriendo en Prusa: ${file.name}`);
  try{
    const r=await fetch("${API_BASE}/open-prusa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iniText:text})});
    const data=await r.json();
    if(data.ok) push("oppi",`PrusaSlicer abierto con el perfil. (Archivo: ${data.loaded})`);
    else push("oppi",`No pude abrir PrusaSlicer: ${data.error||"error desconocido"}`);
  }catch{
    push("oppi","Error de red al abrir PrusaSlicer.");
  }
});

// saludo inicial
function greet(){
  push("oppi","¡Hola! Soy Oppi 🤖. Te acompaño en tu impresión 3D. Podés chatear, importar un .ini como contexto y, cuando quieras, generar un **.ini automático** listo para descargar o abrir en PrusaSlicer.");
}
renderThreadList();
greet();
