// Si lo dejás vacío usa mismo origen; en Pages poné la URL de Render
// —— configuración de API (arriba del archivo)
const API_BASE = "https://oppi-backend.onrender.com"; // en local podés dejar "" (cadena vacía)

// ────────────────────────────────────────────────────────────────
// Referencias DOM
const box = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const resetBtn = document.getElementById("reset-btn");
const importBtn = document.getElementById("import-btn");
const iniFile = document.getElementById("ini-file");
const generateBtn = document.getElementById("generate-ini-btn");
const openIniFile = document.getElementById("open-ini-prusa-file");
const openIniBtn  = document.getElementById("open-ini-prusa-btn");

// Si el backend está remoto, ocultamos la tarjeta "Abrir en Prusa"
if (typeof API_BASE === "string" && API_BASE) {
  document.querySelectorAll('#open-ini-prusa-file, #open-ini-prusa-btn')
    .forEach(el => el?.closest('.card')?.remove());
}

// ────────────────────────────────────────────────────────────────
// Control de hilos / memoria
const THREADS_KEY = "oppi.threads";
const CURRENT_KEY = "oppi.currentThread";
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() :
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random()*16)|0, v = c==="x" ? r : (r&0x3)|0x8;
      return v.toString(16);
    });
}
function loadThreads(){ try{return JSON.parse(localStorage.getItem(THREADS_KEY))||{};}catch{return{};} }
function saveThreads(o){ localStorage.setItem(THREADS_KEY, JSON.stringify(o)); }
let threads = loadThreads();
let threadId = localStorage.getItem(CURRENT_KEY);
function ensureFirstThread(){
  if(!threadId){
    const id=uuid();
    threads[id]={name:"Conversación 1",created:Date.now()};
    saveThreads(threads);
    localStorage.setItem(CURRENT_KEY,id);
    threadId=id;
  }
}
ensureFirstThread();

// ────────────────────────────────────────────────────────────────
// Render de chat y utilidades
function push(who, text, {allowHtml=false}={}) {
  const msg=document.createElement("div");
  msg.className=`msg ${who}`;
  msg[allowHtml?"innerHTML":"textContent"]=text;
  box.appendChild(msg);
  box.scrollTop=box.scrollHeight;
  return msg;
}
function setTyping(on=true){
  const id="__typing__";
  let el=document.getElementById(id);
  if(on){
    if(el)return;
    el=document.createElement("div");
    el.id=id; el.className="msg oppi";
    el.textContent="Oppi está escribiendo…";
    box.appendChild(el);
  } else if(el) el.remove();
  box.scrollTop=box.scrollHeight;
}
function toSimpleHtml(md){
  const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let html=esc(md||"");
  html=html.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  html=html.replace(/`([^`]+?)`/g,"<code>$1</code>");
  html=html.replace(/\n/g,"<br>");
  return html;
}
function extractIniBlock(text){
  const re=/```(?:ini)?\s*([\s\S]*?)```/i;
  const m=(text||"").match(re);
  return m?m[1].trim():null;
}

// Agregar botones a los .ini generados
function attachIniActions(msgEl, iniText, filename="perfil-oppi.prusa.ini"){
  const bar=document.createElement("div");
  bar.style.marginTop="8px";
  bar.style.display="flex";
  bar.style.flexWrap="wrap";
  bar.style.gap="8px";
  const pre=document.createElement("pre");
  pre.style.whiteSpace="pre-wrap";
  pre.style.margin="8px 0";
  pre.textContent=iniText;

  const btnDl=document.createElement("button");
  btnDl.textContent="⬇️ Descargar .ini";
  btnDl.className="btn";
  btnDl.addEventListener("click",()=>{
    const blob=new Blob([iniText],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename;
    a.click(); URL.revokeObjectURL(url);
  });

  bar.appendChild(btnDl);
  msgEl.appendChild(bar);
  msgEl.appendChild(pre);
  box.scrollTop=box.scrollHeight;
}

// ────────────────────────────────────────────────────────────────
// Enviar mensaje al backend
form.addEventListener("submit",async e=>{
  e.preventDefault();
  const text=input.value.trim();
  if(!text)return;
  push("user",text);
  input.value="";
  setTyping(true);
  try{
    const r=await fetch(`${API_BASE}/chat-oppi`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:text,threadId})
    });
    const data=await r.json();
    setTyping(false);
    const reply=data.reply||"Hubo un problema al responder.";
    const msgEl=push("oppi",toSimpleHtml(reply),{allowHtml:true});
    const ini=extractIniBlock(reply);
    if(ini)attachIniActions(msgEl,ini);
  }catch{
    setTyping(false);
    push("oppi","Error de red. Probá de nuevo.");
  }
});

// ────────────────────────────────────────────────────────────────
// Reset de conversación
resetBtn?.addEventListener("click",async()=>{
  try{
    await fetch(`${API_BASE}/reset-thread`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({threadId})
    });
    push("oppi","Memoria reiniciada ✅");
  }catch{
    push("oppi","Error al reiniciar memoria.");
  }
});

// ────────────────────────────────────────────────────────────────
// Importar perfil .ini (contexto)
importBtn?.addEventListener("click",()=>iniFile?.click());
iniFile?.addEventListener("change",async()=>{
  const file=iniFile.files?.[0];
  if(!file)return;
  push("user",`Importando perfil: ${file.name} ...`);
  const fd=new FormData();
  fd.append("file",file);
  fd.append("threadId",threadId);
  try{
    const r=await fetch(`${API_BASE}/import-ini`,{method:"POST",body:fd});
    const data=await r.json();
    if(data.ok)
      push("oppi",toSimpleHtml(`Perfil importado ✅<br>${data.summary}`),{allowHtml:true});
    else
      push("oppi",`No pude importar: ${data.error}`);
  }catch{
    push("oppi","Error de red importando el .ini.");
  }finally{ iniFile.value=""; }
});

// ────────────────────────────────────────────────────────────────
// Generar .ini automático con Oppi
generateBtn?.addEventListener("click",async()=>{
  push("user","(Generar .ini con Oppi)");
  setTyping(true);
  try{
    const r=await fetch(`${API_BASE}/generate-ini-ai`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({threadId})
    });
    const data=await r.json();
    setTyping(false);
    if(!data.ok)return push("oppi",`No pude generar: ${data.error}`);
    const msgEl=push("oppi","Perfil generado automáticamente ✅");
    attachIniActions(msgEl,data.iniText);
  }catch{
    setTyping(false);
    push("oppi","Error de red generando el .ini.");
  }
});

// ────────────────────────────────────────────────────────────────
// Saludo inicial
window.addEventListener("load",()=>{
  push("oppi","¡Hola! Soy Oppi 🤖. Te acompaño en tu impresión 3D.<br>Podés chatear, importar un .ini y generar uno nuevo automáticamente.",{allowHtml:true});
});


