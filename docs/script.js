// ────────────────────────────────────────────────────────────────
// Configuración de API
// Si lo dejás vacío ("") usa el mismo origen que el frontend.
// En GitHub Pages, poné acá la URL de tu backend en Render.
const API_BASE = "https://oppi-backend.onrender.com";
// const API_BASE = ""; // para usar mismo dominio en desarrollo/local

// ────────────────────────────────────────────────────────────────
// Supabase (Auth + helper para backend)
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// 1) Cliente de Supabase (FRONTEND)
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Lo dejo global por si querés usarlo en otros archivos / consola
window.supabase = supabase;

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
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      // Solo ponemos Content-Type en JSON. Para FormData lo deja el navegador.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
// Estado de sesión / elementos de autenticación
let currentUser = null;

// Referencias DOM generales (chat + botones Oppi)
const box = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const resetBtn = document.getElementById("reset-btn");
const importBtn = document.getElementById("import-btn");
const iniFile = document.getElementById("ini-file");
const generateBtn = document.getElementById("generate-ini-btn");
const openIniFile = document.getElementById("open-ini-prusa-file");
const openIniBtn = document.getElementById("open-ini-prusa-btn");

// Sidebar de conversaciones
const threadList = document.getElementById("thread-list");
const newThreadBtn = document.getElementById("new-thread-btn");

// Botón para abrir el modal y elementos del modal
const authOpenBtn = document.getElementById("auth-open-btn");
const authModal = document.getElementById("auth-modal");
const authCloseBtn = document.getElementById("auth-close-btn");

// UI usuario logueado
const authUserInfo = document.getElementById("auth-user-info");
const authUserLabel = document.getElementById("auth-user-label");
const authLogoutBtn = document.getElementById("auth-logout-btn");

// 🔹 Botón para sugerir STL
const suggestStlBtn = document.getElementById("suggest-stl-btn");

// Referencias DOM para autenticación (Supabase Auth)
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

// ────────────────────────────────────────────────────────────────
// Modal de autenticación

function openAuthModal() {
  authModal?.classList.add("open");
}

function closeAuthModal() {
  authModal?.classList.remove("open");
}

// Abrir modal
authOpenBtn?.addEventListener("click", () => {
  openAuthModal();
});

// Cerrar modal con la X
authCloseBtn?.addEventListener("click", () => {
  closeAuthModal();
});

// Cerrar modal haciendo click afuera del cuadro
authModal?.addEventListener("click", (e) => {
  if (e.target === authModal) {
    closeAuthModal();
  }
});

// ────────────────────────────────────────────────────────────────
// Manejo de sesión y UI según estado

function updateAuthUI() {
  if (currentUser) {
    // Hay sesión
    authOpenBtn?.classList.add("hidden");
    authUserInfo?.classList.remove("hidden");
    if (authUserLabel) authUserLabel.textContent = currentUser.email || "Usuario";
  } else {
    // No hay sesión
    authOpenBtn?.classList.remove("hidden");
    authUserInfo?.classList.add("hidden");
    if (authUserLabel) authUserLabel.textContent = "";
  }
}

async function initAuthState() {
  const { data, error } = await supabase.auth.getSession();
  if (!error) {
    currentUser = data.session?.user ?? null;
  } else {
    console.error("Error obteniendo sesión:", error);
    currentUser = null;
  }
  updateAuthUI();
}

// Escuchar cambios de sesión (login / logout / registro)
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  updateAuthUI();
});

// Cerrar sesión
authLogoutBtn?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
    currentUser = null;
    updateAuthUI();
    push("oppi", "Cerraste sesión. Podés volver a iniciar cuando quieras 🔐");
  } catch (err) {
    console.error("Error al cerrar sesión:", err);
    push("oppi", "No pude cerrar sesión, probá de nuevo.");
  }
});

// Helper: asegurar que haya sesión antes de usar funciones
function ensureLoggedIn() {
  if (!currentUser) {
    push(
      "oppi",
      "Para usar todas las funciones de Oppi tenés que iniciar sesión 😊"
    );
    openAuthModal();
    return false;
  }
  return true;
}

// ────────────────────────────────────────────────────────────────
// Registro (signUp)
if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    registerStatus.textContent = "Creando cuenta...";

    const email = registerEmail.value.trim();
    const password = registerPassword.value.trim();

    if (!email || !password) {
      registerStatus.textContent = "Completá email y contraseña.";
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      registerStatus.textContent = "Error: " + error.message;
    } else {
      registerStatus.textContent =
        "Cuenta creada. Revisá tu mail si pide confirmación.";
      console.log("SignUp:", data);
    }
  });
}

// Login (signInWithPassword)
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
      // Cerrar el modal al iniciar sesión
      closeAuthModal();
    }
  });
}

// Debug: probar /api/me en tu backend
if (btnVerCuenta) {
  btnVerCuenta.addEventListener("click", async () => {
    meOutput.textContent = "Consultando /api/me...";

    try {
      const data = await callBackend("/api/me");
      meOutput.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      meOutput.textContent = "Error: " + err.message;
      console.error(err);
    }
  });
}

// ────────────────────────────────────────────────────────────────
// Si el backend está remoto, ocultamos la tarjeta "Abrir en Prusa"
if (typeof API_BASE === "string" && API_BASE) {
  document
    .querySelectorAll("#open-ini-prusa-file, #open-ini-prusa-btn")
    .forEach((el) => el?.closest(".card")?.remove());
}

// ────────────────────────────────────────────────────────────────
// Control de hilos / memoria (threads de conversación)
const THREADS_KEY = "oppi.threads";
const CURRENT_KEY = "oppi.currentThread";

// Memoria corta de mensajes por thread (solo últimos 3)
const HISTORY_KEY = "oppi.threadHistory";

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

function loadThreads() {
  try {
    return JSON.parse(localStorage.getItem(THREADS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveThreads(o) {
  localStorage.setItem(THREADS_KEY, JSON.stringify(o));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
  } catch {
    return {};
  }
}
function saveHistory(h) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

let threads = loadThreads();
let threadId = localStorage.getItem(CURRENT_KEY);
let historyByThread = loadHistory();

function ensureFirstThread() {
  if (!threadId) {
    const id = uuid();
    threads[id] = { name: "Conversación 1", created: Date.now() };
    saveThreads(threads);
    localStorage.setItem(CURRENT_KEY, id);
    threadId = id;
  }
}
ensureFirstThread();

// ────────────────────────────────────────────────────────────────
// Memoria corta: registrar y renderizar últimos 3 mensajes

function recordMessage(role, text) {
  if (!threadId || !text) return;
  if (!historyByThread[threadId]) {
    historyByThread[threadId] = [];
  }

  const arr = historyByThread[threadId];
  arr.push({ role, text, ts: Date.now() });

  // Solo guardamos los últimos 3
  historyByThread[threadId] = arr.slice(-3);
  saveHistory(historyByThread);
}

function clearChatUI() {
  if (box) box.innerHTML = "";
}

function renderHistoryForThread(id) {
  if (!box) return;
  const arr = historyByThread[id] || [];
  for (const msg of arr) {
    push(msg.role === "user" ? "user" : "oppi", msg.text, { allowHtml: false });
  }
}

// ────────────────────────────────────────────────────────────────
// Sidebar de conversaciones (UI)

function renderThreads() {
  if (!threadList) return;

  threadList.innerHTML = "";

  const entries = Object.entries(threads).sort(
    (a, b) => a[1].created - b[1].created
  );

  if (!entries.length) return;

  for (const [id, t] of entries) {
    const btn = document.createElement("button");
    btn.className = "thread-item" + (id === threadId ? " active" : "");
    btn.textContent = t.name || "Chat sin título";

    btn.addEventListener("click", () => {
      switchThread(id);
    });

    threadList.appendChild(btn);
  }
}

function switchThread(id) {
  if (!threads[id]) return;
  if (id === threadId) return;

  threadId = id;
  localStorage.setItem(CURRENT_KEY, id);

  clearChatUI();
  // Mostrar historial corto de ese chat
  renderHistoryForThread(id);
  push(
    "oppi",
    `Estás en: ${threads[id].name || "Nuevo chat"}. Podés seguir hablando o empezar un tema nuevo.`
  );

  renderThreads();
}

function createNewThread() {
  if (!ensureLoggedIn()) return;

  const id = uuid();
  const count = Object.keys(threads).length + 1;

  threads[id] = {
    name: `Conversación ${count}`,
    created: Date.now(),
  };

  saveThreads(threads);
  threadId = id;
  localStorage.setItem(CURRENT_KEY, id);

  clearChatUI();
  push("oppi", "Nuevo chat creado. Contame qué querés imprimir 😊");

  renderThreads();
}

// Botón "Nuevo chat"
newThreadBtn?.addEventListener("click", createNewThread);

// Render inicial de threads
renderThreads();

// ────────────────────────────────────────────────────────────────
// Render de chat y utilidades

function push(who, text, { allowHtml = false } = {}) {
  const msg = document.createElement("div");
  msg.className = `msg ${who}`;
  msg[allowHtml ? "innerHTML" : "textContent"] = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
  return msg;
}

function setTyping(on = true) {
  const id = "__typing__";
  let el = document.getElementById(id);
  if (on) {
    if (el) return;
    el = document.createElement("div");
    el.id = id;
    el.className = "msg oppi";
    el.textContent = "Oppi está escribiendo…";
    box.appendChild(el);
  } else if (el) el.remove();
  box.scrollTop = box.scrollHeight;
}

function toSimpleHtml(md) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = esc(md || "");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+?)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

function extractIniBlock(text) {
  const re = /```(?:ini)?\s*([\s\S]*?)```/i;
  const m = (text || "").match(re);
  return m ? m[1].trim() : null;
}

// Agregar botones a los .ini generados
function attachIniActions(msgEl, iniText, filename = "perfil-oppi.prusa.ini") {
  const bar = document.createElement("div");
  bar.style.marginTop = "8px";
  bar.style.display = "flex";
  bar.style.flexWrap = "wrap";
  bar.style.gap = "8px";

  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap";
  pre.style.margin = "8px 0";
  pre.textContent = iniText;

  const btnDl = document.createElement("button");
  btnDl.textContent = "⬇️ Descargar .ini";
  btnDl.className = "btn";
  btnDl.addEventListener("click", () => {
    const blob = new Blob([iniText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });

  bar.appendChild(btnDl);
  msgEl.appendChild(bar);
  msgEl.appendChild(pre);
  box.scrollTop = box.scrollHeight;
}

// ────────────────────────────────────────────────────────────────
// Enviar mensaje al backend (chat principal)

// ────────────────────────────────────────────────────────────────
// Enviar mensaje al backend (chat principal)

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ensureLoggedIn()) return;

  const text = input.value.trim();
  if (!text) return;

  // Mostrar en pantalla y guardar en historial
  push("user", text);
  recordMessage("user", text);

  input.value = "";
  setTyping(true);

  try {
    const data = await callBackend("/chat-oppi", {
      method: "POST",
      body: JSON.stringify({ message: text, threadId }),
    });

    setTyping(false);

    const reply = data.reply || "Hubo un problema al responder.";

    // Guardar respuesta también en historial (en texto plano)
    recordMessage("oppi", reply);

    const msgEl = push("oppi", toSimpleHtml(reply), { allowHtml: true });
    const ini = extractIniBlock(reply);
    if (ini) attachIniActions(msgEl, ini);
  } catch (err) {
    console.error("Error en chat-oppi:", err);
    setTyping(false);
    push("oppi", `No pude responder: ${err.message}`);
  }
});


// ────────────────────────────────────────────────────────────────
// Reset de conversación

resetBtn?.addEventListener("click", async () => {
  if (!ensureLoggedIn()) return;

  try {
    await fetch(`${API_BASE}/reset-thread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
    push("oppi", "Memoria reiniciada ✅");

    // Al resetear, también limpiamos el historial corto de ese chat
    historyByThread[threadId] = [];
    saveHistory(historyByThread);
  } catch {
    push("oppi", "Error al reiniciar memoria.");
  }
});

// ────────────────────────────────────────────────────────────────
// Importar perfil .ini (contexto)

importBtn?.addEventListener("click", () => {
  if (!ensureLoggedIn()) return;
  iniFile?.click();
});

iniFile?.addEventListener("change", async () => {
  const file = iniFile.files?.[0];
  if (!file) return;

  push("user", `Importando perfil: ${file.name} ...`);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("threadId", threadId);

  try {
    const r = await fetch(`${API_BASE}/import-ini`, { method: "POST", body: fd });
    const data = await r.json();
    if (data.ok) {
      const msg = `Perfil importado ✅\n${data.summary || ""}`;
      push("oppi", toSimpleHtml(msg), { allowHtml: true });

      // También podemos registrar este último mensaje de Oppi como historial
      recordMessage("oppi", msg);
    } else {
      push("oppi", `No pude importar: ${data.error}`);
    }
  } catch {
    push("oppi", "Error de red importando el .ini.");
  } finally {
    iniFile.value = "";
  }
});

// ────────────────────────────────────────────────────────────────
// Generar .ini automático con Oppi

generateBtn?.addEventListener("click", async () => {
  if (!ensureLoggedIn()) return;

  const userMsg = "(Generar .ini con Oppi)";
  push("user", userMsg);
  recordMessage("user", userMsg);

  setTyping(true);

  try {
    const r = await fetch(`${API_BASE}/generate-ini-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });

    let data;
    try {
      data = await r.json();
    } catch (e) {
      setTyping(false);
      return push(
        "oppi",
        "El backend no devolvió JSON válido al generar el .ini."
      );
    }

    setTyping(false);

    if (!r.ok || !data.ok) {
      const msgError = data?.error || `Error del servidor (${r.status})`;
      return push("oppi", `No pude generar el .ini: ${msgError}`);
    }

    const msgText = "Perfil generado automáticamente ✅";
    const msgEl = push("oppi", msgText);
    recordMessage("oppi", msgText);

    attachIniActions(msgEl, data.iniText);
  } catch (err) {
    console.error("Error generando ini:", err);
    setTyping(false);
    push("oppi", "Error de red generando el .ini.");
  }
});

// ────────────────────────────────────────────────────────────────
// 🔹 Sugerir modelo STL con Oppi (IA + historial de chat)

suggestStlBtn?.addEventListener("click", async () => {
  if (!ensureLoggedIn()) return;

  const userMsg = "(Pedir modelo STL a Oppi)";
  push("user", userMsg);
  recordMessage("user", userMsg);

  setTyping(true);

  try {
    const r = await fetch(`${API_BASE}/api/stl/suggest-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });

    const data = await r.json();
    setTyping(false);

    if (!data.ok || !data.model) {
      const msgText =
        "Por ahora no pude elegir un modelo STL a partir de lo que hablamos. Probá contarme mejor qué querés imprimir 😊";
      push("oppi", msgText);
      recordMessage("oppi", msgText);
      return;
    }

    const m = data.model;
    const motivo = data.motivo;

    const html = `
      Te recomiendo este modelo STL basado en lo que estuvimos hablando:<br>
      <strong>${m.nombre}</strong><br>
      ${m.descripcion || ""}<br>
      <em>Categoría:</em> ${m.categoria || "-"} – <em>Dificultad:</em> ${
      m.dificultad || "-"
    }<br>
      ${
        motivo
          ? `<em>Motivo:</em> ${motivo}<br>`
          : ""
      }
      <a href="${m.archivo}" target="_blank" rel="noopener noreferrer">⬇️ Descargar STL</a>
    `;

    push("oppi", html, { allowHtml: true });

    // Guardamos una versión "texto plano" del resumen para el historial corto
    const resumenPlano = `STL sugerido: ${m.nombre} (${m.categoria || "-"})${
      motivo ? ". Motivo: " + motivo : ""
    }`;
    recordMessage("oppi", resumenPlano);
  } catch (err) {
    console.error("Error al sugerir STL con IA:", err);
    setTyping(false);
    const msgText =
      "Tuvimos un problema al buscar el STL. Probá de nuevo.";
    push("oppi", msgText);
    recordMessage("oppi", msgText);
  }
});

// ────────────────────────────────────────────────────────────────
// Saludo inicial + inicializar estado de sesión

window.addEventListener("load", () => {
  initAuthState();

  // Mostrar historial corto del thread actual (si existe)
  renderHistoryForThread(threadId);

  push(
    "oppi",
    "¡Hola! Soy Oppi 🤖. Te acompaño en tu impresión 3D.<br>Podés chatear, importar un .ini, generar uno nuevo automáticamente y ahora también pedir un modelo STL para probar.",
    { allowHtml: true }
  );
});

