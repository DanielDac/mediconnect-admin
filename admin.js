const SUPABASE_URL = 'https://htuagycwflhqxghhotjf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_y6Py69cWc_hxdXlZHE2ivw_HHweYutU';
const SESSION_KEY = 'mc_admin_user';

const sb = {
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Prefer': 'return=representation'
  },
  async select(table, query = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  },
  async update(table, id, body) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(body)
    });
    return response.ok;
  }
};

let donations = [];
let users = [];
let requests = [];

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.className = 'toast', 2600);
}

function getAdmin() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function setAdmin(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

async function loginAdmin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) return showToast('Completa correo y contraseña', 'error');

  try {
    const query = `select=*&email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(password)}&limit=1`;
    const data = await sb.select('usuarios', query);

    if (!data.length) return showToast('Credenciales incorrectas', 'error');

    const user = data[0];
    if (!['admin', 'validador'].includes(String(user.rol).toLowerCase())) {
      return showToast('Este usuario no tiene permisos administrativos', 'error');
    }

    setAdmin(user);
    startAdmin();
  } catch (error) {
    console.error(error);
    showToast('Error de conexión con Supabase', 'error');
  }
}

function logoutAdmin() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

function startAdmin() {
  const user = getAdmin();
  if (!user) return;

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminLayout').classList.remove('hidden');
  document.getElementById('adminName').textContent = user.nombre || user.email || 'Admin';
  loadAll();
}

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(v => v.classList.remove('active'));
  document.getElementById(`${view}View`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');

  const titles = {
    dashboard: ['Dashboard', 'Resumen general de MediConnect.'],
    donations: ['Donaciones', 'Control y validación de medicamentos.'],
    users: ['Usuarios', 'Administración de donantes, receptores y validadores.'],
    requests: ['Solicitudes de validadores', 'Aprobación de permisos especiales.']
  };
  document.getElementById('pageTitle').textContent = titles[view][0];
  document.getElementById('pageSubtitle').textContent = titles[view][1];
}

async function loadAll() {
  try {
    donations = await sb.select('donaciones', 'select=*,usuarios!donante_id(nombre,email)&order=created_at.desc');
    users = await sb.select('usuarios', 'select=*&order=created_at.desc');

    try {
      requests = await sb.select('solicitudes_validador', 'select=*&estado=eq.pendiente&order=created_at.desc');
    } catch (_) {
      requests = [];
    }

    renderDashboard();
    renderDonations();
    renderUsers();
    renderRequests();
  } catch (error) {
    console.error(error);
    showToast('No se pudieron cargar los datos', 'error');
  }
}

function getDonorName(d) {
  return d.usuarios?.nombre || d.donante || 'Donante anónimo';
}

function renderDashboard() {
  document.getElementById('totalDonations').textContent = donations.length;
  document.getElementById('reservedDonations').textContent = donations.filter(d => d.estado === 'reservado').length;
  document.getElementById('deliveredDonations').textContent = donations.filter(d => d.estado === 'entregado').length;
  document.getElementById('totalUsers').textContent = users.length;

  const recent = donations.slice(0, 5);
  document.getElementById('recentDonations').innerHTML = recent.length ? recent.map(d => `
    <div class="item">
      <div>
        <b>${escapeHtml(d.nombre)}</b>
        <small>${escapeHtml(d.tipo)} · ${d.cantidad} un. · ${escapeHtml(getDonorName(d))}</small>
      </div>
      <span class="badge ${d.estado}">${d.estado}</span>
    </div>
  `).join('') : '<p class="muted">No hay donaciones registradas.</p>';

  const states = ['disponible', 'reservado', 'aprobado', 'entregado', 'rechazado'];
  document.getElementById('statusSummary').innerHTML = states.map(s => `
    <div class="item">
      <b>${s}</b>
      <span class="badge ${s}">${donations.filter(d => d.estado === s).length}</span>
    </div>
  `).join('');
}

function renderDonations() {
  const search = document.getElementById('donationSearch')?.value.toLowerCase() || '';
  const filter = document.getElementById('statusFilter')?.value || 'todos';

  const filtered = donations.filter(d => {
    const text = `${d.nombre} ${d.tipo} ${getDonorName(d)} ${d.estado}`.toLowerCase();
    return text.includes(search) && (filter === 'todos' || d.estado === filter);
  });

  document.getElementById('donationsTable').innerHTML = filtered.length ? filtered.map(d => `
    <tr>
      <td><strong>${escapeHtml(d.nombre)}</strong><br><small>${escapeHtml(getDonorName(d))}</small></td>
      <td>${escapeHtml(d.tipo)}</td>
      <td>${d.cantidad}</td>
      <td>${d.fecha_vencimiento || '-'}</td>
      <td><span class="badge ${d.estado}">${d.estado}</span></td>
      <td>
        <div class="actions">
          ${d.estado === 'reservado' ? `<button class="btn approve" onclick="changeDonationStatus('${d.id}','aprobado')">Aprobar</button><button class="btn reject" onclick="changeDonationStatus('${d.id}','rechazado')">Rechazar</button>` : ''}
          ${d.estado === 'aprobado' ? `<button class="btn deliver" onclick="changeDonationStatus('${d.id}','entregado')">Entregado</button>` : ''}
          ${d.estado !== 'rechazado' ? `<button class="btn neutral" onclick="changeDonationStatus('${d.id}','disponible')">Liberar</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6">No se encontraron donaciones.</td></tr>';
}

function renderUsers() {
  const search = document.getElementById('userSearch')?.value.toLowerCase() || '';
  const filtered = users.filter(u => `${u.nombre} ${u.email} ${u.rol}`.toLowerCase().includes(search));

  document.getElementById('usersTable').innerHTML = filtered.length ? filtered.map(u => `
    <tr>
      <td><strong>${escapeHtml(u.nombre || 'Sin nombre')}</strong></td>
      <td>${escapeHtml(u.email || '-')}</td>
      <td><span class="badge aprobado">${escapeHtml(u.rol || 'usuario')}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <div class="actions">
          ${u.rol !== 'admin' ? `<button class="btn neutral" onclick="changeUserRole('${u.id}','admin')">Hacer admin</button>` : ''}
          ${u.rol !== 'validador' ? `<button class="btn approve" onclick="changeUserRole('${u.id}','validador')">Validador</button>` : ''}
          ${u.rol !== 'receptor' ? `<button class="btn reject" onclick="changeUserRole('${u.id}','receptor')">Receptor</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5">No se encontraron usuarios.</td></tr>';
}

function renderRequests() {
  const box = document.getElementById('validatorRequests');
  if (!requests.length) {
    box.innerHTML = '<p class="muted">No hay solicitudes pendientes o la tabla solicitudes_validador todavía no existe.</p>';
    return;
  }

  box.innerHTML = requests.map(r => `
    <div class="request-card">
      <h3>${escapeHtml(r.nombre || 'Usuario')}</h3>
      <p>${escapeHtml(r.email || '')}</p>
      <div class="actions">
        <button class="btn approve" onclick="processValidatorRequest('${r.id}','${r.usuario_id}','aprobado')">Aprobar</button>
        <button class="btn reject" onclick="processValidatorRequest('${r.id}','${r.usuario_id}','rechazado')">Rechazar</button>
      </div>
    </div>
  `).join('');
}

async function changeDonationStatus(id, estado) {
  if (!confirm(`¿Cambiar estado a ${estado}?`)) return;
  const body = { estado };
  if (estado === 'disponible') body.receptor_id = null;

  const ok = await sb.update('donaciones', id, body);
  if (!ok) return showToast('No se pudo actualizar la donación', 'error');

  showToast('Donación actualizada', 'success');
  await loadAll();
}

async function changeUserRole(id, rol) {
  if (!confirm(`¿Asignar rol ${rol} a este usuario?`)) return;
  const ok = await sb.update('usuarios', id, { rol });
  if (!ok) return showToast('No se pudo actualizar el usuario', 'error');
  showToast('Rol actualizado', 'success');
  await loadAll();
}

async function processValidatorRequest(requestId, userId, status) {
  if (!confirm(`¿${status === 'aprobado' ? 'Aprobar' : 'Rechazar'} esta solicitud?`)) return;

  let ok = await sb.update('solicitudes_validador', requestId, { estado: status });
  if (ok && status === 'aprobado' && userId) {
    ok = await sb.update('usuarios', userId, { rol: 'validador' });
  }

  if (!ok) return showToast('No se pudo procesar la solicitud', 'error');
  showToast('Solicitud procesada', 'success');
  await loadAll();
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-GT', { day:'2-digit', month:'short', year:'numeric' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[char]));
}

window.addEventListener('DOMContentLoaded', () => {
  if (getAdmin()) startAdmin();
});
