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

// Helper para llamar a tu backend con el token de Supabase
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

// Botón para sugerir STL
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
    authOpenBtn?.classList.add("hidden");
    authUserInfo?.classList.remove("hidden");
    if (authUserLabel) authUserLabel.textContent = currentUser.email || "Usuario";
  } else {
    authOpenBtn?.classList.remove("hidden");
    authUserInfo?.classList.add("hidden");
    if (authUserLabel) authUserLabel.textContent = "";
  }
}

// Sincronizar hilos desde Supabase para el usuario actual
async function syncThreadsFromSupabase() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("oppi_threads")
    .select("thread_id, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error cargando hilos desde Supabase:", error);
    return;
  }

  if (!data || data.length === 0) {
    // Usuario nuevo: se queda con las conversaciones locales (si hubiera)
    renderThreads();
    return;
  }

  threads = {};
  for (const row of data) {
    threads[row.thread_id] = {
      name: row.name || "Chat sin título",
      created: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    };
  }
  saveThreads(threads);

  // Si el hilo actual no existe, elegimos el primero
  if (!threads[threadId]) {
    const ids = Object.keys(threads);
    if (ids.length > 0) {
      threadId = ids[0];
      localStorage.setItem(CURRENT_KEY, threadId);
    }
  }

  renderThreads();
  clearChatUI();
  if (threadId) {
    renderHistoryForThread(threadId);
    push(
      "oppi",
      `Estás en: ${threads[threadId].name || "Nuevo chat"}. Podés seguir hablando o empezar un tema nuevo.`
    );
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
  if (currentUser) {
    syncThreadsFromSupabase();
  }
}

// Escuchar cambios de sesión (login / logout / registro)
supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  updateAuthUI();

  if (currentUser) {
    // Al loguearse: cargar hilos de la cuenta
    await syncThreadsFromSupabase();
  } else {
    // Al desloguearse: limpiar hilos locales para no ver los de otra cuenta
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
    // El listener onAuthStateChange se encarga de limpiar todo
    push("oppi", "Cerraste sesión. Podés volver a iniciar cuando quieras.");
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
      "Para usar todas las funciones de Oppi tenés que iniciar sesión."
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
// Menú global de tres puntos (renombrar / borrar)

let menuThreadId = null;
let threadMenu = null;

function ensureThreadMenu() {
  if (threadMenu) return threadMenu;

  const menu = document.createElement("div");
  menu.id = "thread-context-menu";
  menu.className = "thread-context-menu";
  menu.style.position = "fixed";
  menu.style.minWidth = "160px";
  menu.style.background = "rgba(10,10,20,0.98)";
  menu.style.border = "1px solid rgba(255,255,255,0.05)";
  menu.style.borderRadius = "8px";
  menu.style.padding = "4px 0";
  menu.style.display = "none";
  menu.style.zIndex = "9999";

  const btnRename = document.createElement("button");
  btnRename.type = "button";
  btnRename.textContent = "Renombrar";
  btnRename.style.display = "block";
  btnRename.style.width = "100%";
  btnRename.style.textAlign = "left";
  btnRename.style.padding = "6px 12px";
  btnRename.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = menuThreadId;
    hideThreadMenu();
    if (id) renameThread(id);
  });

  const btnDelete = document.createElement("button");
  btnDelete.type = "button";
  btnDelete.textContent = "Eliminar conversación";
  btnDelete.style.display = "block";
  btnDelete.style.width = "100%";
  btnDelete.style.textAlign = "left";
  btnDelete.style.padding = "6px 12px";
  btnDelete.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = menuThreadId;
    hideThreadMenu();
    if (id) deleteThread(id);
  });

  menu.appendChild(btnRename);
  menu.appendChild(btnDelete);

  menu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.body.appendChild(menu);
  threadMenu = menu;
  return menu;
}

function showThreadMenu(threadIdParam, anchorEl) {
  const menu = ensureThreadMenu();
  menuThreadId = threadIdParam;

  const rect = anchorEl.getBoundingClientRect();
  const menuWidth = 180;

  menu.style.top = rect.bottom + 4 + "px";
  menu.style.left = rect.right - menuWidth + "px";
  menu.style.display = "block";
}

function hideThreadMenu() {
  if (!threadMenu) return;
  threadMenu.style.display = "none";
  menuThreadId = null;
}

document.addEventListener("click", () => {
  hideThreadMenu();
});

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
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const already = menuThreadId === id && threadMenu?.style.display === "block";
      if (already) {
        hideThreadMenu();
      } else {
        showThreadMenu(id, menuBtn);
      }
    });

    row.appendChild(btn);
    row.appendChild(menuBtn);

    threadList.appendChild(row);
  }
}

// Cambiar de conversación
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

// Crear nueva conversación (local + Supabase)
async function createNewThread() {
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
  push("oppi", "Nuevo chat creado. Contame qué querés imprimir.");

  renderThreads();

  // Guardar en Supabase
  try {
    await supabase.from("oppi_threads").insert({
      user_id: currentUser.id,
      thread_id: id,
      name: threads[id].name,
    });
  } catch (err) {
    console.error("Error guardando hilo en Supabase:", err);
  }
}

// Renombrar hilo (local + Supabase)
async function renameThread(id) {
  if (!threads[id]) return;
  if (!ensureLoggedIn()) return;

  const currentName = threads[id].name || "Chat sin título";
  const newName = prompt("Nuevo nombre para la conversación:", currentName);
  if (!newName) return;

  threads[id].name = newName;
  saveThreads(threads);
  renderThreads();

  try {
    await supabase.from("oppi_threads").upsert({
      user_id: currentUser.id,
      thread_id: id,
      name: newName,
    });
  } catch (err) {
    console.error("Error renombrando hilo en Supabase:", err);
  }
}

// Borrar hilo (local + Supabase)
async function deleteThread(id) {
  if (!threads[id]) return;
  if (!ensureLoggedIn()) return;

  const confirmed = confirm(
    "¿Seguro que querés borrar esta conversación? Se va a eliminar también de la base de datos."
  );
  if (!confirmed) return;

  // Borrar en Supabase
  try {
    await supabase
      .from("oppi_threads")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("thread_id", id);
  } catch (err) {
    console.error("Error borrando hilo en Supabase:", err);
  }

  // Borrar en el frontend
  delete threads[id];
  saveThreads(threads);

  delete historyByThread[id];
  saveHistory(historyByThread);

  if (id === threadId) {
    const remainingIds = Object.keys(threads);
    if (remainingIds.length > 0) {
      threadId = remainingIds[0];
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

// Botón "Nuevo chat"
newThreadBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  createNewThread();
});

// Render inicial de threads
renderThreads();

// Forzar que la barra de chats tenga scroll
if (threadList) {
  const scrollHost = threadList.parentElement || threadList;
  scrollHost.style.overflowY = "auto";
  scrollHost.style.maxHeight = "calc(100vh - 160px)";
}

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
// Enviar mensaje al backend (chat principal)

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
    const threadName = threads[threadId]?.name || null;

    const data = await callBackend("/chat-oppi", {
      method: "POST",
      body: JSON.stringify({ message: text, threadId, threadName }),
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

// ────────────────────────────────────────────────────────────────
// Reset de conversación

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
  recordMessage("user", `Importando perfil: ${file.name} ...`);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("threadId", threadId);

  try {
    const data = await callBackend("/import-ini", {
      method: "POST",
      body: fd,
    });

    if (data.ok) {
      const msg = `Perfil importado.\n${data.summary || ""}`;
      push("oppi", toSimpleHtml(msg), { allowHtml: true });
      recordMessage("oppi", msg);
    } else {
      const msg = `No pude importar: ${
        data.error || "Error desconocido al importar"
      }`;
      push("oppi", msg);
      recordMessage("oppi", msg);
    }
  } catch (err) {
    console.error("Error de red importando el .ini:", err);
    const msg = `Error de red importando el .ini: ${err.message}`;
    push("oppi", msg);
    recordMessage("oppi", msg);
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
    const data = await callBackend("/generate-ini-ai", {
      method: "POST",
      body: JSON.stringify({ threadId }),
    });

    setTyping(false);

    if (!data.ok) {
      const msgError = data?.error || "Error al generar el .ini";
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

// ────────────────────────────────────────────────────────────────
// Sugerir modelo STL con Oppi

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
        data?.error ||
        "Por ahora no pude elegir un modelo STL a partir de lo que hablamos. Probá contarme mejor qué querés imprimir.";
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
    console.error("Error al sugerir STL con IA:", err);
    setTyping(false);
    const msgText = "Tuvimos un problema al buscar el STL. Probá de nuevo.";
    push("oppi", msgText);
    recordMessage("oppi", msgText);
  }
});

// ────────────────────────────────────────────────────────────────
// Saludo inicial + inicializar estado de sesión

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
