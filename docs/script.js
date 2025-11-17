// ────────────────────────────────────────────────────────────────
// Configuración de API
const API_BASE = "https://oppi-backend.onrender.com";
// const API_BASE = "";

// ────────────────────────────────────────────────────────────────
// Supabase (solo Auth)
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
window.supabase = supabase;

// ────────────────────────────────────────────────────────────────
// Estado de sesión / elementos de autenticación
let currentUser = null;

// DOM general
const box = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const resetBtn = document.getElementById("reset-btn");
const importBtn = document.getElementById("import-btn");
const iniFile = document.getElementById("ini-file");
const generateBtn = document.getElementById("generate-ini-btn");
const openIniFile = document.getElementById("open-ini-prusa-file");
const openIniBtn = document.getElementById("open-ini-prusa-btn");

// Sidebar
const threadList = document.getElementById("thread-list");
const newThreadBtn = document.getElementById("new-thread-btn");

// Auth modal
const authOpenBtn = document.getElementById("auth-open-btn");
const authModal = document.getElementById("auth-modal");
const authCloseBtn = document.getElementById("auth-close-btn");

// UI usuario logueado
const authUserInfo = document.getElementById("auth-user-info");
const authUserLabel = document.getElementById("auth-user-label");
const authLogoutBtn = document.getElementById("auth-logout-btn");

// STL
const suggestStlBtn = document.getElementById("suggest-stl-btn");

// Auth inputs
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

authOpenBtn?.addEventListener("click", () => openAuthModal());
authCloseBtn?.addEventListener("click", () => closeAuthModal());

authModal?.addEventListener("click", (e) => {
  if (e.target === authModal) closeAuthModal();
});

// ────────────────────────────────────────────────────────────────
// Manejo de sesión

function updateAuthUI() {
  if (currentUser) {
    authOpenBtn?.classList.add("hidden");
    authUserInfo?.classList.remove("hidden");
    if (authUserLabel) authUserLabel.textContent = currentUser.email || "Usuario";
  } else {
    authOpenBtn?.classList.remove("hidden");
    authUserInfo?.classList.add("hidden");
    if (authUserLabel) authUserLabel.textContent = "";
  }
}

async function initAuthState() {
  const { data, error } = await supabase.auth.getSession();
  if (!error && data.session?.user) {
    currentUser = data.session.user;
  } else {
    currentUser = null;
  }
  updateAuthUI();
  renderThreads(); // usamos solo localStorage por ahora
}

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  updateAuthUI();

  if (!currentUser) {
    // limpiar todo al desloguear
    threads = {};
    historyByThread = {};
    localStorage.removeItem(THREADS_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(CURRENT_KEY);
    threadId = null;
    ensureFirstThread();
    clearChatUI();
    renderThreads();
  }
});

// Cerrar sesión
authLogoutBtn?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
    push("oppi", "Cerraste sesión. Podés volver a iniciar cuando quieras.");
  } catch (err) {
    console.error("Error al cerrar sesión:", err);
    push("oppi", "No pude cerrar sesión, probá de nuevo.");
  }
});

// Helper login obligatorio
function ensureLoggedIn() {
  if (!currentUser) {
    push(
      "oppi",
      "Para usar todas las funciones de Oppi tenés que iniciar sesión."
    );
    openAuthModal();
    return false;
  }
  return true;
}

// Registro
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

// Login
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
      closeAuthModal();
    }
  });
}

// Debug /api/me (usa token, pero no afecta al resto si falla)
async function callBackend(path, options = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw new Error("Error al obtener la sesión");
  if (!session) throw new Error("No hay sesión activa");

  const token = session.access_token;
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Error en el backend");
  return body;
}

if (btnVerCuenta) {
  btnVerCuenta.addEventListener("click", async () => {
    meOutput.textContent = "Consultando /api/me...";
    try {
      const data = await callBackend("/api/me", { method: "GET" });
      meOutput.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      meOutput.textContent = "Error: " + err.message;
      console.error(err);
    }
  });
}

// Ocultar tarjeta "Abrir en Prusa" si backend remoto
if (typeof API_BASE === "string" && API_BASE) {
  document
    .querySelectorAll("#open-ini-prusa-file, #open-ini-prusa-btn")
    .forEach((el) => el?.closest(".card")?.remove());
}

// ────────────────────────────────────────────────────────────────
// Threads en localStorage + historial corto

const THREADS_KEY = "oppi.threads";
const CURRENT_KEY = "oppi.currentThread";
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

// Historial corto (3 mensajes)
function recordMessage(role, text) {
  if (!threadId || !text) return;
  if (!historyByThread[threadId]) historyByThread[threadId] = [];

  const arr = historyByThread[threadId];
  arr.push({ role, text, ts: Date.now() });
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
// Sidebar de conversaciones (botón + tres puntitos simples)

function renderThreads() {
  if (!threadList) return;
  threadList.innerHTML = "";

  const entries = Object.entries(threads).sort(
    (a, b) => a[1].created - b[1].created
  );
  if (!entries.length) return;

  for (const [id, t] of entries) {
    const row = document.createElement("div");
    row.className = "thread-row" + (id === threadId ? " active" : "");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "4px";

    const btn = document.createElement("button");
    btn.className = "thread-item";
    btn.textContent = t.name || "Chat sin título";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchThread(id);
    });

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "thread-menu-trigger";
    menuBtn.textContent = "⋮";
    menuBtn.title = "Opciones";
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openInlineMenu(id, row);
    });

    row.appendChild(btn);
    row.appendChild(menuBtn);
    threadList.appendChild(row);
  }

  // scroll vertical en la columna de chats
  const scrollHost = threadList.parentElement || threadList;
  scrollHost.style.overflowY = "auto";
  scrollHost.style.maxHeight = "calc(100vh - 160px)";
}

// Menú inline sencillo debajo de la fila
let currentInlineMenu = null;

function closeInlineMenu() {
  if (currentInlineMenu) {
    currentInlineMenu.remove();
    currentInlineMenu = null;
  }
}

function openInlineMenu(id, row) {
  closeInlineMenu();

  const menu = document.createElement("div");
  menu.className = "thread-inline-menu";
  menu.style.marginTop = "4px";
  menu.style.width = "100%";
  menu.style.background = "rgba(10,10,20,0.98)";
  menu.style.borderRadius = "10px";
  menu.style.border = "1px solid rgba(255,255,255,0.06)";
  menu.style.padding = "4px 0";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.gap = "2px";

  const addItem = (label, handler) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.border = "none";
    b.style.background = "transparent";
    b.style.textAlign = "left";
    b.style.width = "100%";
    b.style.padding = "6px 10px";
    b.style.fontSize = "0.85rem";
    b.style.cursor = "pointer";
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
      closeInlineMenu();
    });
    menu.appendChild(b);
  };

  addItem("Renombrar", () => renameThread(id));
  addItem("Eliminar", () => deleteThread(id));

  row.insertAdjacentElement("afterend", menu);
  currentInlineMenu = menu;
}

document.addEventListener("click", () => closeInlineMenu());

function switchThread(id) {
  if (!threads[id]) return;
  if (id === threadId) return;

  threadId = id;
  localStorage.setItem(CURRENT_KEY, id);

  clearChatUI();
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

  threads[id] = { name: `Conversación ${count}`, created: Date.now() };
  saveThreads(threads);

  threadId = id;
  localStorage.setItem(CURRENT_KEY, id);

  clearChatUI();
  push("oppi", "Nuevo chat creado. Contame qué querés imprimir.");
  renderThreads();
}

async function renameThread(id) {
  if (!threads[id]) return;
  if (!ensureLoggedIn()) return;

  const currentName = threads[id].name || "Chat sin título";
  const newName = prompt("Nuevo nombre para la conversación:", currentName);
  if (!newName) return;

  threads[id].name = newName;
  saveThreads(threads);
  renderThreads();

  // si más adelante tenés endpoint /api/threads/rename, se puede llamar acá
}

async function deleteThread(id) {
  if (!threads[id]) return;
  if (!ensureLoggedIn()) return;

  const confirmed = confirm(
    "¿Seguro que querés borrar esta conversación? (Solo se borra del dispositivo por ahora)"
  );
  if (!confirmed) return;

  delete threads[id];
  saveThreads(threads);
  delete historyByThread[id];
  saveHistory(historyByThread);

  if (id === threadId) {
    const remaining = Object.keys(threads);
    if (remaining.length > 0) {
      threadId = remaining[0];
      localStorage.setItem(CURRENT_KEY, threadId);
      clearChatUI();
      renderHistoryForThread(threadId);
      push(
        "oppi",
        `Estás en: ${
          threads[threadId].name || "Nuevo chat"
        }. Podés seguir hablando o empezar un tema nuevo.`
      );
    } else {
      threadId = null;
      ensureFirstThread();
      clearChatUI();
      renderHistoryForThread(threadId);
      push("oppi", "Nuevo chat creado. Contame qué querés imprimir.");
    }
  }

  renderThreads();
}

newThreadBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  createNewThread();
});

// ────────────────────────────────────────────────────────────────
// Render chat y utilidades

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
  btnDl.textContent = "Descargar .ini";
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
// Eventos principales (TODOS con fetch directo)

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ensureLoggedIn()) return;

  const text = input.value.trim();
  if (!text) return;

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


resetBtn?.addEventListener("click", async () => {
  if (!ensureLoggedIn()) return;

  try {
    await callBackend("/reset-thread", {
      method: "POST",
      body: JSON.stringify({ threadId }),
    });
    push("oppi", "Memoria reiniciada.");
    historyByThread[threadId] = [];
    saveHistory(historyByThread);
  } catch (err) {
    console.error("Error al reiniciar memoria:", err);
    push("oppi", `Error al reiniciar memoria: ${err.message}`);
  }
});


importBtn?.addEventListener("click", () => {
  if (!ensureLoggedIn()) return;
  iniFile?.click();
});

iniFile?.addEventListener("change", async () => {
  const file = iniFile.files?.[0];
  if (!file) return;
  if (!ensureLoggedIn()) return;

  const msgUser = `Importando perfil: ${file.name} ...`;
  push("user", msgUser);
  recordMessage("user", msgUser);

  const fd = new FormData();
  fd.append("file", file);
  fd.append("threadId", threadId);

  try {
    const data = await callBackend("/import-ini", {
      method: "POST",
      body: fd,
    });

    if (!data.ok) {
      const msg = `No pude importar: ${data.error || "Error desconocido"}`;
      push("oppi", msg);
      recordMessage("oppi", msg);
      return;
    }

    const msg = `Perfil importado.\n${data.summary || ""}`;
    push("oppi", toSimpleHtml(msg), { allowHtml: true });
    recordMessage("oppi", msg);
  } catch (err) {
    console.error("Error importando .ini:", err);
    const msg = `Error de red importando el .ini: ${err.message}`;
    push("oppi", msg);
    recordMessage("oppi", msg);
  } finally {
    iniFile.value = "";
  }
});


generateBtn?.addEventListener("click", async () => {
  if (!ensureLoggedIn()) return;

  const userMsg = "(Generar .ini con Oppi)";
  push("user", userMsg);
  recordMessage("user", userMsg);
  setTyping(true);

  try {
    const data = await callBackend("/generate-ini-ai", {
      method: "POST",
      body: JSON.stringify({ threadId }),
    });
    setTyping(false);

    if (!data.ok) {
      const msgError = data.error || "Error desconocido";
      const msg = `No pude generar el .ini: ${msgError}`;
      push("oppi", msg);
      recordMessage("oppi", msg);
      return;
    }

    const msgText = "Perfil generado automáticamente.";
    const msgEl = push("oppi", msgText);
    recordMessage("oppi", msgText);
    attachIniActions(msgEl, data.iniText);
  } catch (err) {
    console.error("Error generando ini:", err);
    setTyping(false);
    const msg = `Error de red generando el .ini: ${err.message}`;
    push("oppi", msg);
    recordMessage("oppi", msg);
  }
});


suggestStlBtn?.addEventListener("click", async () => {
  if (!ensureLoggedIn()) return;

  const userMsg = "(Pedir modelo STL a Oppi)";
  push("user", userMsg);
  recordMessage("user", userMsg);
  setTyping(true);

  try {
    const data = await callBackend("/api/stl/suggest-ai", {
      method: "POST",
      body: JSON.stringify({ threadId }),
    });
    setTyping(false);

    if (!data.ok || !data.model) {
      const msgText =
        data.error ||
        `Por ahora no pude elegir un modelo STL a partir de lo que hablamos. Probá contarme mejor qué querés imprimir.`;
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
      ${motivo ? `<em>Motivo:</em> ${motivo}<br>` : ""}
      <a href="${m.archivo}" target="_blank" rel="noopener noreferrer">Descargar STL</a>
    `;

    push("oppi", html, { allowHtml: true });

    const resumenPlano = `STL sugerido: ${m.nombre} (${m.categoria || "-"})${
      motivo ? ". Motivo: " + motivo : ""
    }`;
    recordMessage("oppi", resumenPlano);
  } catch (err) {
    console.error("Error al sugerir STL:", err);
    setTyping(false);
    const msgText = "Tuvimos un problema al buscar el STL. Probá de nuevo.";
    push("oppi", msgText);
    recordMessage("oppi", msgText);
  }
});


    const m = data.model;
    const motivo = data.motivo;

    const html = `
      Te recomiendo este modelo STL basado en lo que estuvimos hablando:<br>
      <strong>${m.nombre}</strong><br>
      ${m.descripcion || ""}<br>
      <em>Categoría:</em> ${m.categoria || "-"} – <em>Dificultad:</em> ${
      m.dificultad || "-"
    }<br>
      ${motivo ? `<em>Motivo:</em> ${motivo}<br>` : ""}
      <a href="${m.archivo}" target="_blank" rel="noopener noreferrer">Descargar STL</a>
    `;

    push("oppi", html, { allowHtml: true });

    const resumenPlano = `STL sugerido: ${m.nombre} (${m.categoria || "-"})${
      motivo ? ". Motivo: " + motivo : ""
    }`;
    recordMessage("oppi", resumenPlano);
  } catch (err) {
    console.error("Error al sugerir STL:", err);
    setTyping(false);
    const msgText = "Tuvimos un problema al buscar el STL. Probá de nuevo.";
    push("oppi", msgText);
    recordMessage("oppi", msgText);
  }
});

// ────────────────────────────────────────────────────────────────
// Saludo inicial

window.addEventListener("load", () => {
  initAuthState();

  if (threadList) {
    const scrollHost = threadList.parentElement || threadList;
    scrollHost.style.overflowY = "auto";
    scrollHost.style.maxHeight = "calc(100vh - 160px)";
  }

  renderHistoryForThread(threadId);

  push(
    "oppi",
    "Hola, soy Oppi. Te acompaño en tu impresión 3D. Podés chatear, importar un .ini, generar uno nuevo automáticamente y pedir un modelo STL para probar.",
    { allowHtml: true }
  );
});

