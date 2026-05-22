const SUPABASE_URL = "https://htuagycwflhqxghhotjf.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dWFneWN3ZmxocXhnaGhvdGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTM5MzgsImV4cCI6MjA5MzA4OTkzOH0.i_u0YEuO3DLyhTVjpf0jUNW0ZLnf4p0eG5yCGCzi_Tw";
const SESSION_KEY = "mc_admin_user";

const sb = {
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    Prefer: "return=representation",
  },
  async select(table, query = "") {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  },
  async insert(table, body) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error("Error al insertar:", await response.text());
      return null;
    }
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  },
  async update(table, id, body) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
      {
        method: "PATCH",
        headers: this.headers,
        body: JSON.stringify(body),
      },
    );
    return response.ok;
  },
};

let donations = [];
let users = [];
let requestsValidador = [];
let requestsDonante = [];

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 2600);
}

function getAdmin() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function setAdmin(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

async function loginAdmin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password)
    return showToast("Completa correo y contraseña", "error");

  try {
    const query = `select=*&email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(password)}&limit=1`;
    const data = await sb.select("usuarios", query);

    if (!data.length) return showToast("Credenciales incorrectas", "error");

    const user = data[0];
    if (!["admin", "validador"].includes(String(user.rol).toLowerCase())) {
      return showToast(
        "Este usuario no tiene permisos administrativos",
        "error",
      );
    }

    setAdmin(user);
    startAdmin();
  } catch (error) {
    console.error(error);
    showToast("Error de conexión con Supabase", "error");
  }
}

function logoutAdmin() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

function startAdmin() {
  const user = getAdmin();
  if (!user) return;

  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("adminLayout").classList.remove("hidden");
  document.getElementById("adminName").textContent =
    user.nombre || user.email || "Admin";
  loadAll();
}

function showView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(v => v.classList.remove("active"));
  
  const viewEl = document.getElementById(`${view}View`);
  const navEl = document.querySelector(`[data-view="${view}"]`);
  
  if (viewEl) viewEl.classList.add("active");
  if (navEl) navEl.classList.add("active");

  const titles = {
    dashboard: ["Dashboard", "Resumen general de MediConnect."],
    donations: ["Donaciones", "Control y validación de medicamentos."],
    users: ["Usuarios", "Administración de donantes, receptores y validadores."],
    requests: ["Solicitudes", "Validador y Donante."],
    notifications: ["🔔 Notificaciones", "Envía avisos a los usuarios."],
  };
  
  const title = titles[view] || [view, ""];
  document.getElementById("pageTitle").textContent = title[0];
  document.getElementById("pageSubtitle").textContent = title[1];

  if (view === 'notifications') cargarHistorialNotificaciones();
  if (view === 'requests') loadAll(); // Recargar solicitudes
  if (view === 'dashboard') loadAll();
  if (view === 'donations') loadAll();
  if (view === 'users') loadAll();
}

async function loadAll() {
  try {
    donations = await sb.select(
      "donaciones",
      "select=*,usuarios!donante_id(nombre,email)&order=created_at.desc",
    );
    users = await sb.select("usuarios", "select=*&order=created_at.desc");

    requestsValidador = [];
    requestsDonante = [];

    try {
      requestsValidador = await sb.select(
        "solicitudes_validador",
        "select=*&estado=eq.pendiente&order=created_at.desc",
      );
    } catch (_) {
      requestsValidador = [];
    }

    try {
      requestsDonante = await sb.select(
        "solicitudes_donante",
        "select=*&estado=eq.pendiente&order=created_at.desc",
      );
    } catch (_) {
      requestsDonante = [];
    }

    renderDashboard();
    renderDonations();
    renderUsers();
    renderRequests();
  } catch (error) {
    console.error(error);
    showToast("No se pudieron cargar los datos", "error");
  }
}

function getDonorName(d) {
  return d.usuarios?.nombre || d.donante || "Donante anónimo";
}

function renderDashboard() {
  document.getElementById("totalDonations").textContent = donations.length;
  document.getElementById("reservedDonations").textContent = donations.filter(
    (d) => d.estado === "reservado",
  ).length;
  document.getElementById("deliveredDonations").textContent = donations.filter(
    (d) => d.estado === "entregado",
  ).length;
  document.getElementById("totalUsers").textContent = users.length;

  const recent = donations.slice(0, 5);
  document.getElementById("recentDonations").innerHTML = recent.length
    ? recent
      .map(
        (d) => `
    <div class="item">
      <div>
        <b>${escapeHtml(d.nombre)}</b>
        <small>${escapeHtml(d.tipo)} · ${d.cantidad} un. · ${escapeHtml(getDonorName(d))}</small>
      </div>
      <span class="badge ${d.estado}">${d.estado}</span>
    </div>
  `,
      )
      .join("")
    : '<p class="muted">No hay donaciones registradas.</p>';

  const states = [
    "disponible",
    "reservado",
    "aprobado",
    "entregado",
    "rechazado",
  ];
  document.getElementById("statusSummary").innerHTML = states
    .map(
      (s) => `
    <div class="item">
      <b>${s}</b>
      <span class="badge ${s}">${donations.filter((d) => d.estado === s).length}</span>
    </div>
  `,
    )
    .join("");
}

function renderDonations() {
  const search =
    document.getElementById("donationSearch")?.value.toLowerCase() || "";
  const filter = document.getElementById("statusFilter")?.value || "todos";

  const filtered = donations.filter((d) => {
    const text =
      `${d.nombre} ${d.tipo} ${getDonorName(d)} ${d.estado}`.toLowerCase();
    return text.includes(search) && (filter === "todos" || d.estado === filter);
  });

  document.getElementById("donationsTable").innerHTML = filtered.length
    ? filtered
      .map(
        (d) => `
    <tr>
      <td><strong>${escapeHtml(d.nombre)}</strong><br><small>${escapeHtml(getDonorName(d))}</small></td>
      <td>${escapeHtml(d.tipo)}</td>
      <td>${d.cantidad}</td>
      <td>${d.fecha_vencimiento || "-"}</td>
      <td><span class="badge ${d.estado}">${d.estado}</span></td>
      <td>
  <div class="actions">

    <!-- BLOQUE A -->
    <div class="action-block">
      <select 
        class="status-select status-${d.estado}"
        onchange="handleDonationStatusChange('${d.id}', this.value)"
      >
        <option value="">${d.estado.toUpperCase()}</option>

        ${d.estado !== "disponible"
          ? `<option value="disponible">Disponible</option>`
          : ""}

        ${d.estado !== "reservado"
          ? `<option value="reservado">Reservado</option>`
          : ""}

        ${d.estado !== "aprobado"
          ? `<option value="aprobado">Aprobado</option>`
          : ""}

        ${d.estado !== "entregado"
          ? `<option value="entregado">Entregado</option>`
          : ""}

        ${d.estado !== "rechazado"
          ? `<option value="rechazado">Rechazado</option>`
          : ""}
      </select>
    </div>

    <!-- BLOQUE B -->
    <div class="action-block action-extra">

    </div>

  </div>
</td>
    </tr>
  `,
      )
      .join("")
    : '<tr><td colspan="6">No se encontraron donaciones.</td></tr>';
}

function renderUsers() {
  const search =
    document.getElementById("userSearch")?.value.toLowerCase() || "";
  const filtered = users.filter((u) =>
    `${u.nombre} ${u.email} ${u.rol}`.toLowerCase().includes(search),
  );

  document.getElementById("usersTable").innerHTML = filtered.length
    ? filtered
      .map(
        (u) => `
    <tr>
      <td><strong>${escapeHtml(u.nombre || "Sin nombre")}</strong></td>
      <td>${escapeHtml(u.email || "-")}</td>
      <td><span class="badge aprobado">${escapeHtml(u.rol || "usuario")}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <div class="actions">
          ${u.rol !== "admin" ? `<button class="btn neutral" onclick="changeUserRole('${u.id}','admin')">Hacer admin</button>` : ""}
          ${u.rol !== "validador" ? `<button class="btn approve" onclick="changeUserRole('${u.id}','validador')">Validador</button>` : ""}
          ${u.rol !== "receptor" ? `<button class="btn reject" onclick="changeUserRole('${u.id}','receptor')">Receptor</button>` : ""}
        </div>
      </td>
    </tr>
  `,
      )
      .join("")
    : '<tr><td colspan="5">No se encontraron usuarios.</td></tr>';
}

function renderRequests() {
  const box = document.getElementById("validatorRequests");

  let html = "<h3>🛡️ Solicitudes de Validador</h3>";

  if (!requestsValidador || !requestsValidador.length) {
    html += '<p class="muted">No hay solicitudes pendientes de validador.</p>';
  } else {
    html += requestsValidador
      .map(
        (r) => `
      <div class="request-card">
        <h3>${escapeHtml(r.nombre || "Usuario")}</h3>
        <p>📧 ${escapeHtml(r.email || "")}</p>
        <p>📝 Motivo: ${escapeHtml(r.motivo || "No especificado")}</p>
        <p>🩺 Experiencia: ${escapeHtml(r.experiencia || "No especificada")}</p>
        <p>📅 ${formatDate(r.created_at)}</p>
        <div class="actions">
          <button class="btn approve" onclick="processRequest('validador','${r.id}','${r.usuario_id}','aprobado')">✅ Aprobar</button>
          <button class="btn reject" onclick="processRequest('validador','${r.id}','${r.usuario_id}','rechazado')">❌ Rechazar</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  html += '<h3 style="margin-top:24px;">🩺 Solicitudes de Donante</h3>';

  if (!requestsDonante || !requestsDonante.length) {
    html += '<p class="muted">No hay solicitudes pendientes de donante.</p>';
  } else {
    html += requestsDonante
      .map(
        (r) => `
      <div class="request-card">
        <h3>${escapeHtml(r.nombre || "Usuario")}</h3>
        <p>📧 ${escapeHtml(r.email || "")}</p>
        <p>📝 Motivo: ${escapeHtml(r.motivo || "No especificado")}</p>
        <p>💊 Tipo: ${escapeHtml(r.tipo_medicamentos || "No especificado")}</p>
        <p>📅 ${formatDate(r.created_at)}</p>
        <div class="actions">
          <button class="btn approve" onclick="processRequest('donante','${r.id}','${r.usuario_id}','aprobado')">✅ Aprobar</button>
          <button class="btn reject" onclick="processRequest('donante','${r.id}','${r.usuario_id}','rechazado')">❌ Rechazar</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  box.innerHTML = html;
}

async function processRequest(tipo, requestId, userId, status) {
  const tabla =
    tipo === "validador" ? "solicitudes_validador" : "solicitudes_donante";
  const nuevoRol = tipo === "validador" ? "validador" : "donante";

  if (
    !confirm(
      `¿${status === "aprobado" ? "Aprobar" : "Rechazar"} esta solicitud de ${tipo}?`,
    )
  )
    return;

  // Actualizar solicitud
  let ok = await sb.update(tabla, requestId, { estado: status });

  // Si es aprobado, cambiar rol del usuario
  if (ok && status === "aprobado" && userId) {
    ok = await sb.update("usuarios", userId, { rol: nuevoRol });
  }

  if (!ok) return showToast("No se pudo procesar la solicitud", "error");
  showToast(
    `Solicitud de ${tipo} ${status === "aprobado" ? "aprobada" : "rechazada"}`,
    "success",
  );
  await loadAll();
}

function handleDonationStatusChange(id, estado) {
  if (!estado) return;

  changeDonationStatus(id, estado);
}

async function changeDonationStatus(id, estado) {
  if (!confirm(`¿Cambiar estado a ${estado}?`)) return;
  const body = { estado };
  if (estado === "disponible") body.receptor_id = null;

  const ok = await sb.update("donaciones", id, body);
  if (!ok) return showToast("No se pudo actualizar la donación", "error");

  showToast("Donación actualizada", "success");
  await loadAll();
}

async function changeUserRole(id, rol) {
  if (!confirm(`¿Asignar rol ${rol} a este usuario?`)) return;
  const ok = await sb.update("usuarios", id, { rol });
  if (!ok) return showToast("No se pudo actualizar el usuario", "error");
  showToast("Rol actualizado", "success");
  await loadAll();
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char],
  );
}
// ===== NOTIFICACIONES =====

// Mostrar/ocultar selector de usuario
document.getElementById('notifTipo')?.addEventListener('change', async function() {
  const selectUsuario = document.getElementById('notifUsuario');
  if (this.value === 'personal') {
    selectUsuario.style.display = 'block';
    const users = await sb.select('usuarios', 'select=id,nombre,email&order=nombre');
    selectUsuario.innerHTML = '<option value="">Selecciona...</option>' + 
      users.map(u => `<option value="${u.id}">${u.nombre} (${u.email})</option>`).join('');
  } else {
    selectUsuario.style.display = 'none';
  }
});

async function enviarNotificacion() {
  const tipo = document.getElementById('notifTipo').value;
  const titulo = document.getElementById('notifTitulo').value.trim();
  const mensaje = document.getElementById('notifMensaje').value.trim();
  
  if (!titulo || !mensaje) return showToast('Completa título y mensaje', 'error');
  
  try {
    if (tipo === 'personal') {
      const usuarioId = document.getElementById('notifUsuario').value;
      if (!usuarioId) return showToast('Selecciona un usuario', 'error');
      
      const result = await sb.insert('notificaciones', {
        usuario_id: usuarioId, titulo, mensaje, tipo: 'personal'
      });
      if (!result) throw new Error('No se pudo insertar');
      
    } else if (tipo === 'todos') {
      const result = await sb.insert('notificaciones', {
        usuario_id: null, titulo, mensaje, tipo: 'general'
      });
      if (!result) throw new Error('No se pudo insertar');
      
    } else {
      const usuarios = await sb.select('usuarios', `rol=eq.${tipo}&select=id`);
      for (const u of usuarios) {
        await sb.insert('notificaciones', {
          usuario_id: u.id, titulo, mensaje, tipo: 'general'
        });
      }
    }
    
    showToast('Notificación enviada ✅', 'success');
    document.getElementById('notifTitulo').value = '';
    document.getElementById('notifMensaje').value = '';
    cargarHistorialNotificaciones();
  } catch (error) {
    console.error(error);
    showToast('Error al enviar', 'error');
  }
}

async function cargarHistorialNotificaciones() {
  const box = document.getElementById('historialNotificaciones');
  if (!box) return;
  
  try {
    const notifs = await sb.select('notificaciones', 'order=created_at.desc&limit=20');
    box.innerHTML = notifs.length ? notifs.map(n => `
      <div class="item">
        <div>
          <b>${escapeHtml(n.titulo)}</b>
          <small>${n.usuario_id ? '👤 Personal' : '📢 General'} · ${formatDate(n.created_at)}</small>
        </div>
        <span class="badge ${n.tipo === 'personal' ? 'reservado' : 'aprobado'}">${n.tipo}</span>
      </div>
    `).join('') : '<p class="muted">No hay notificaciones enviadas.</p>';
  } catch (e) {
    box.innerHTML = '<p class="muted">Tabla notificaciones no encontrada. Ejecuta el SQL para crearla.</p>';
  }
}
window.addEventListener("DOMContentLoaded", () => {
  if (getAdmin()) startAdmin();
});
