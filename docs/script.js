// Si lo dejás vacío usa mismo origen; en Pages poné la URL de Render
// —— configuración de API (arriba del archivo)
const API_BASE = "https://oppi-backend.onrender.com"; // en local podés dejar "" (cadena vacía)

// script.js
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// 1) Cliente de Supabase (FRONTEND)
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Lo dejo global por si querés usarlo en otros archivos
window.supabase = supabase;

// 2) Helper para llamar a tu backend con el token de Supabase
async function callBackend(path, options = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Error obteniendo sesión:", error);
    throw new Error("Error al obtener la sesión");
  }

  if (!session) {
    throw new Error("No hay sesión activa (usuario no logueado)");
  }

  const token = session.access_token;

  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Error backend:", body);
    throw new Error(body.error || "Error en el backend");
  }

  return body;
}

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
// 🔹 NUEVO: botón para sugerir STL
const suggestStlBtn = document.getElementById("suggest-stl-btn");
// 3) Referencias a los elementos del DOM
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const registerBtn = document.getElementById("register-btn");
const registerStatus = document.getElementById("register-status");

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");

const btnVerCuenta = document.getElementById("btn-ver-cuenta");
const meOutput = document.getElementById("me-output");

// 4) Registro (signUp)
if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    registerStatus.textContent = "Creando cuenta...";

    const email = registerEmail.value.trim();
    const password = registerPassword.value.trim();

    if (!email || !password) {
      registerStatus.textContent = "Completá email y contraseña.";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      registerStatus.textContent = "Error: " + error.message;
    } else {
      registerStatus.textContent = "Cuenta creada. Revisá tu mail si pide confirmación.";
      console.log("SignUp:", data);
    }
  });
}

// 5) Login (signInWithPassword)
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    loginStatus.textContent = "Iniciando sesión...";

    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      loginStatus.textContent = "Completá email y contraseña.";
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      loginStatus.textContent = "Error: " + error.message;
    } else {
      loginStatus.textContent = "Sesión iniciada.";
      console.log("SignIn:", data);
    }
  });
}

// 6) Probar /api/me en tu backend
if (btnVerCuenta) {
  btnVerCuenta.addEventListener("click", async () => {
    meOutput.textContent = "Consultando /api/me...";

    try {
      const data = await callBackend("/api/me"); // O "https://TU-BACKEND.onrender.com/api/me"
      meOutput.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      meOutput.textContent = "Error: " + err.message;
      console.error(err);
    }
  });
}



// Si el backend está remoto, ocultamos la tarjeta "Abrir en Prusa"
if (typeof API_BASE === "string" && API_BASE) {
  document.querySelectorAll('#open-ini-prusa-file, #open-ini-prusa-btn')
    .forEach(el => el?.closest('.card')?.remove());
}

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

    let data;
    try {
      data = await r.json();
    } catch (e) {
      setTyping(false);
      return push("oppi","El backend no devolvió JSON válido.");
    }

    setTyping(false);

    if (!r.ok) {
      const msgError = data?.error || `Error del servidor (${r.status})`;
      return push("oppi",`No pude responder: ${msgError}`);
    }

    const reply=data.reply||"Hubo un problema al responder.";
    const msgEl=push("oppi",toSimpleHtml(reply),{allowHtml:true});
    const ini=extractIniBlock(reply);
    if(ini)attachIniActions(msgEl,ini);
  }catch(err){
    console.error("Error en chat-oppi:", err);
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

    let data;
    try {
      data = await r.json();
    } catch (e) {
      setTyping(false);
      return push("oppi","El backend no devolvió JSON válido al generar el .ini.");
    }

    setTyping(false);

    if (!r.ok || !data.ok) {
      const msgError = data?.error || `Error del servidor (${r.status})`;
      return push("oppi",`No pude generar el .ini: ${msgError}`);
    }

    const msgEl=push("oppi","Perfil generado automáticamente ✅");
    attachIniActions(msgEl,data.iniText);
  }catch(err){
    console.error("Error generando ini:", err);
    setTyping(false);
    push("oppi","Error de red generando el .ini.");
  }
});


// ────────────────────────────────────────────────────────────────
// 🔹 Sugerir modelo STL con Oppi (IA + historial de chat)
suggestStlBtn?.addEventListener("click", async () => {
  // Mostramos una acción similar a la de generar .ini
  push("user", "(Pedir modelo STL a Oppi)");
  setTyping(true);

  try {
    const r = await fetch(`${API_BASE}/api/stl/suggest-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId })
    });

    const data = await r.json();
    setTyping(false);

    if (!data.ok || !data.model) {
      return push(
        "oppi",
        "Por ahora no pude elegir un modelo STL a partir de lo que hablamos. Probá contarme mejor qué querés imprimir 😊"
      );
    }

    const m = data.model;
    const motivo = data.motivo;

    const html = `
      Te recomiendo este modelo STL basado en lo que estuvimos hablando:<br>
      <strong>${m.nombre}</strong><br>
      ${m.descripcion || ""}<br>
      <em>Categoría:</em> ${m.categoria || "-"} – <em>Dificultad:</em> ${m.dificultad || "-"}<br>
      ${motivo ? `<em>Motivo:</em> ${motivo}<br>` : ""}
      <a href="${m.archivo}" target="_blank" rel="noopener noreferrer">⬇️ Descargar STL</a>
    `;

    push("oppi", html, { allowHtml: true });

  } catch (err) {
    console.error("Error al sugerir STL con IA:", err);
    setTyping(false);
    push("oppi", "Tuvimos un problema al buscar el STL. Probá de nuevo.");
  }
});


// ────────────────────────────────────────────────────────────────
// Saludo inicial
window.addEventListener("load",()=>{
  push("oppi","¡Hola! Soy Oppi 🤖. Te acompaño en tu impresión 3D.<br>Podés chatear, importar un .ini, generar uno nuevo automáticamente y ahora también pedir un modelo STL para probar.",{allowHtml:true});
});












