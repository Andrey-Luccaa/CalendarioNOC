const STORAGE_KEY = 'escalaHoraExtraV2';

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.createId();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const DEFAULT_STATE = {
  team: [
    { id: createId(), name: 'Andrey', color: '#16d9ee', active: true },
    { id: createId(), name: 'Vinicius', color: '#ff3347', active: true },
    { id: createId(), name: 'Jonatas', color: '#35eb25', active: true }
  ],
  rotationStart: '2026-07-13',
  firstMemberId: null,
  overrides: {},
  history: [],
  theme: 'dark'
};

let state = loadLocalState();
if (!state.firstMemberId || !state.team.some(m => m.id === state.firstMemberId)) state.firstMemberId = state.team[0]?.id || null;
let viewedDate = new Date();
let cloud = { enabled: false, dbUrl: '', workspace: window.ESCALA_WORKSPACE || 'equipe-noc' };

const $ = (id) => document.getElementById(id);
const els = {
  syncStatus: $('syncStatus'), todayDate: $('todayDate'), todayColor: $('todayColor'), todayPerson: $('todayPerson'), todayStatus: $('todayStatus'),
  rotationList: $('rotationList'), legendList: $('legendList'), footerLegend: $('footerLegend'), monthTitle: $('monthTitle'), calendarGrid: $('calendarGrid'), startDateLabel: $('startDateLabel'),
  dayModal: $('dayModal'), dayModalTitle: $('dayModalTitle'), selectedDate: $('selectedDate'), personSelect: $('personSelect'), personField: $('personField'), dayNote: $('dayNote'),
  teamModal: $('teamModal'), teamEditor: $('teamEditor'), rotationStartInput: $('rotationStartInput'), rotationFirstSelect: $('rotationFirstSelect'),
  historyModal: $('historyModal'), historyList: $('historyList'), settingsModal: $('settingsModal'), cloudInfo: $('cloudInfo'), toast: $('toast')
};

function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...deepCopy(DEFAULT_STATE), ...saved } : deepCopy(DEFAULT_STATE);
  } catch { return deepCopy(DEFAULT_STATE); }
}
function saveLocalState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function formatKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function parseLocalDate(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); }
function formatDate(date, opts={}) { return new Intl.DateTimeFormat('pt-BR', opts).format(date); }
function activeTeam() { return state.team.filter(m => m.active !== false); }
function memberById(id) { return state.team.find(m => m.id === id); }
function isWeekend(date) { return date.getDay() === 0 || date.getDay() === 6; }
function businessDaysBetween(start, end) {
  let count = 0; const cursor = new Date(start);
  if (end >= start) {
    while (cursor < end) { cursor.setDate(cursor.getDate()+1); if (!isWeekend(cursor)) count++; }
    return count;
  }
  while (cursor > end) { cursor.setDate(cursor.getDate()-1); if (!isWeekend(cursor)) count--; }
  return count;
}
function automaticMemberFor(date) {
  const team = activeTeam();
  if (!team.length || isWeekend(date)) return null;
  const start = parseLocalDate(state.rotationStart);
  const firstIdx = Math.max(0, team.findIndex(m => m.id === state.firstMemberId));
  const offset = businessDaysBetween(start, date);
  const index = ((firstIdx + offset) % team.length + team.length) % team.length;
  return team[index];
}
function assignmentFor(date) {
  if (isWeekend(date)) return { status: 'weekend', member: null, note: '' };
  const key = formatKey(date); const override = state.overrides[key];
  if (override) return { ...override, member: override.memberId ? memberById(override.memberId) : null };
  return { status: 'extra', member: automaticMemberFor(date), note: '' };
}
function escapeHTML(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function render() {
  document.documentElement.dataset.theme = state.theme || 'dark';
  renderToday(); renderTeamPanels(); renderCalendar(); renderFooter(); updateCloudInfo();
}
function renderToday() {
  const today = new Date(); const item = assignmentFor(today);
  els.todayDate.textContent = formatDate(today, { weekday:'long', day:'2-digit', month:'long' });
  if (item.status === 'weekend') {
    els.todayPerson.textContent = 'Fim de semana'; els.todayStatus.textContent = 'Sem escala'; els.todayColor.style.background = '#45576a';
  } else if (item.status === 'none') {
    els.todayPerson.textContent = 'Sem hora extra'; els.todayStatus.textContent = 'Saída no horário normal'; els.todayColor.style.background = 'var(--muted)';
  } else {
    els.todayPerson.textContent = item.member?.name || 'Sem responsável'; els.todayStatus.textContent = 'Hora extra'; els.todayColor.style.background = item.member?.color || 'var(--muted)';
  }
}
function renderTeamPanels() {
  const team = activeTeam();
  els.rotationList.innerHTML = team.map((m,i) => `<div class="rotation-item" style="color:${m.color}"><span class="rotation-number">${i+1}</span><span style="color:var(--text)">${escapeHTML(m.name)}</span></div>`).join('') || '<p class="muted">Nenhum integrante.</p>';
  els.legendList.innerHTML = team.map(m => `<div class="legend-item"><span class="legend-dot" style="background:${m.color}"></span><span>${escapeHTML(m.name)}</span></div>`).join('');
  els.footerLegend.innerHTML = team.map(m => `<span><i style="background:${m.color}"></i>${escapeHTML(m.name)}</span>`).join('') + '<span><i style="background:#526274"></i>Fim de semana</span>';
  els.startDateLabel.textContent = formatDate(parseLocalDate(state.rotationStart), { day:'2-digit', month:'2-digit', year:'numeric', weekday:'long' });
}
function renderCalendar() {
  const year = viewedDate.getFullYear(), month = viewedDate.getMonth();
  els.monthTitle.textContent = formatDate(new Date(year, month, 1), { month:'long', year:'numeric' });
  const first = new Date(year, month, 1); const start = new Date(year, month, 1 - first.getDay());
  const todayKey = formatKey(new Date()); let html = '';
  for (let i=0;i<42;i++) {
    const date = new Date(start); date.setDate(start.getDate()+i);
    const key = formatKey(date); const assignment = assignmentFor(date);
    const classes = ['day-cell'];
    if (date.getMonth() !== month) classes.push('other-month');
    if (isWeekend(date)) classes.push('weekend');
    if (key === todayKey) classes.push('today');
    let marker = '', person = '';
    if (assignment.status === 'none') { marker = '<span class="day-marker none"></span>'; person = '<span class="day-person">Sem hora extra</span>'; }
    else if (assignment.status === 'extra' && assignment.member) { marker = `<span class="day-marker" style="background:${assignment.member.color}"></span>`; person = `<span class="day-person">${escapeHTML(assignment.member.name)}</span>`; }
    html += `<button class="${classes.join(' ')}" data-date="${key}" ${isWeekend(date)?'disabled':''}><span class="day-number">${date.getDate()}</span>${marker}${person}</button>`;
  }
  els.calendarGrid.innerHTML = html;
  els.calendarGrid.querySelectorAll('[data-date]:not([disabled])').forEach(btn => btn.addEventListener('click', () => openDayModal(btn.dataset.date)));
}
function renderFooter() {}

function openModal(id) { const el=$(id); el.classList.add('open'); el.setAttribute('aria-hidden','false'); }
function closeModal(id) { const el=$(id); el.classList.remove('open'); el.setAttribute('aria-hidden','true'); }
function openDayModal(key) {
  const date = parseLocalDate(key), item = assignmentFor(date), override = state.overrides[key];
  els.selectedDate.value = key; els.dayModalTitle.textContent = formatDate(date, { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  els.personSelect.innerHTML = activeTeam().map(m => `<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');
  document.querySelector(`input[name="dayStatus"][value="${item.status === 'none' ? 'none' : 'extra'}"]`).checked = true;
  if (item.member) els.personSelect.value = item.member.id;
  els.dayNote.value = override?.note || '';
  togglePersonField(); openModal('dayModal');
}
function togglePersonField() { const status = document.querySelector('input[name="dayStatus"]:checked')?.value; els.personField.style.display = status === 'none' ? 'none' : 'block'; }
function addHistory(entry) { state.history.unshift({ id: createId(), timestamp: new Date().toISOString(), ...entry }); state.history = state.history.slice(0, 200); }
async function persist(message='Salvo') { saveLocalState(); render(); await saveCloud(); showToast(message); }

function renderTeamEditor() {
  els.teamEditor.innerHTML = state.team.map((m,i) => `<div class="team-row" data-id="${m.id}">
    <input class="member-color" type="color" value="${m.color}" title="Cor" />
    <input class="member-name" type="text" value="${escapeHTML(m.name)}" placeholder="Nome" />
    <button class="move" title="Mover para cima" data-move="${i}">↕</button>
    <button class="remove" title="Remover">×</button>
  </div>`).join('');
  els.rotationStartInput.value = state.rotationStart;
  els.rotationFirstSelect.innerHTML = state.team.map(m => `<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');
  els.rotationFirstSelect.value = state.firstMemberId || state.team[0]?.id || '';
  els.teamEditor.querySelectorAll('.remove').forEach(btn => btn.onclick = () => { if (state.team.length <= 1) return showToast('A equipe precisa de pelo menos uma pessoa'); btn.closest('.team-row').remove(); });
  els.teamEditor.querySelectorAll('[data-move]').forEach(btn => btn.onclick = () => {
    const row = btn.closest('.team-row'); const prev = row.previousElementSibling;
    if (prev) row.parentElement.insertBefore(row, prev); else row.parentElement.appendChild(row);
  });
}
function collectTeamEditor() {
  const rows = [...els.teamEditor.querySelectorAll('.team-row')];
  const team = rows.map(row => ({ id: row.dataset.id || createId(), name: row.querySelector('.member-name').value.trim(), color: row.querySelector('.member-color').value, active: true })).filter(m => m.name);
  if (!team.length) throw new Error('Adicione pelo menos uma pessoa.');
  return team;
}
function renderHistory() {
  if (!state.history.length) { els.historyList.innerHTML = '<p class="muted">Nenhuma alteração registrada.</p>'; return; }
  els.historyList.innerHTML = state.history.map(h => `<div class="history-item"><strong>${escapeHTML(h.title || 'Alteração')}</strong><div>${escapeHTML(h.description || '')}</div><small>${formatDate(new Date(h.timestamp), { dateStyle:'short', timeStyle:'short' })}</small></div>`).join('');
}
function showToast(text) { els.toast.textContent = text; els.toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>els.toast.classList.remove('show'),2200); }

// Firebase Realtime Database via REST: sem dependências externas e sem travar a interface.
function setupCloud() {
  const cfg = window.FIREBASE_CONFIG || {};
  cloud.enabled = Boolean(cfg.databaseURL && cfg.apiKey);
  cloud.dbUrl = String(cfg.databaseURL || '').replace(/\/$/, '');
  els.syncStatus.innerHTML = `<span class="sync-dot"></span>${cloud.enabled ? 'Conectando...' : 'Salvo neste navegador'}`;
  if (cloud.enabled) loadCloud();
}
function cloudEndpoint() { return `${cloud.dbUrl}/escala/${encodeURIComponent(cloud.workspace)}.json`; }
async function loadCloud() {
  try {
    const response = await fetch(cloudEndpoint());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remote = await response.json();
    if (remote && remote.team) { state = { ...state, ...remote }; saveLocalState(); render(); }
    els.syncStatus.innerHTML = '<span class="sync-dot"></span>Sincronizado';
  } catch (err) {
    console.error(err); els.syncStatus.innerHTML = '<span class="sync-dot"></span>Modo local';
  }
}
async function saveCloud() {
  if (!cloud.enabled) return;
  try {
    const response = await fetch(cloudEndpoint(), { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(state) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    els.syncStatus.innerHTML = '<span class="sync-dot"></span>Sincronizado';
  } catch (err) { console.error(err); els.syncStatus.innerHTML = '<span class="sync-dot"></span>Erro ao sincronizar'; }
}
function updateCloudInfo() {
  els.cloudInfo.innerHTML = cloud.enabled ? '<strong>Sincronização configurada.</strong><br>As alterações são enviadas ao Firebase Realtime Database.' : '<strong>Modo local ativo.</strong><br>Preencha <code>firebase-config.js</code> para compartilhar a escala entre máquinas.';
}

$('prevMonthBtn').onclick = () => { viewedDate.setMonth(viewedDate.getMonth()-1); renderCalendar(); };
$('nextMonthBtn').onclick = () => { viewedDate.setMonth(viewedDate.getMonth()+1); renderCalendar(); };
$('todayBtn').onclick = () => { viewedDate = new Date(); renderCalendar(); };
$('themeBtn').onclick = () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; persist('Tema alterado'); };
$('manageTeamBtn').onclick = $('manageTeamBtn2').onclick = () => { renderTeamEditor(); openModal('teamModal'); };
$('historyBtn').onclick = () => { renderHistory(); openModal('historyModal'); };
$('openSettingsBtn').onclick = () => openModal('settingsModal');
document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => closeModal(el.dataset.closeModal)));
document.querySelectorAll('input[name="dayStatus"]').forEach(el => el.addEventListener('change', togglePersonField));
$('dayForm').onsubmit = async (e) => {
  e.preventDefault(); const key=els.selectedDate.value; const status=document.querySelector('input[name="dayStatus"]:checked').value; const before=assignmentFor(parseLocalDate(key));
  state.overrides[key] = { status, memberId: status==='extra' ? els.personSelect.value : null, note: els.dayNote.value.trim() };
  const afterName = status==='none' ? 'Sem hora extra' : memberById(els.personSelect.value)?.name || 'Sem responsável';
  addHistory({ title: formatDate(parseLocalDate(key), {dateStyle:'short'}), description: `${before.status==='none'?'Sem hora extra':before.member?.name || 'Escala automática'} → ${afterName}${els.dayNote.value.trim() ? ` — ${els.dayNote.value.trim()}` : ''}` });
  closeModal('dayModal'); await persist('Dia atualizado');
};
$('restoreDayBtn').onclick = async () => { const key=els.selectedDate.value; if (state.overrides[key]) { delete state.overrides[key]; addHistory({title:formatDate(parseLocalDate(key),{dateStyle:'short'}),description:'Rodízio automático restaurado'}); } closeModal('dayModal'); await persist('Rodízio restaurado'); };
$('addMemberBtn').onclick = () => {
  const row=document.createElement('div'); row.className='team-row'; row.dataset.id=createId(); row.innerHTML='<input class="member-color" type="color" value="#f5b82e"><input class="member-name" type="text" placeholder="Nome"><button class="move" title="Mover">↕</button><button class="remove" title="Remover">×</button>';
  row.querySelector('.remove').onclick=()=>row.remove(); row.querySelector('.move').onclick=()=>{const prev=row.previousElementSibling; if(prev)row.parentElement.insertBefore(row,prev);}; els.teamEditor.appendChild(row); row.querySelector('.member-name').focus();
};
$('saveTeamBtn').onclick = async () => {
  try {
    const oldNames=state.team.map(m=>m.name).join(', '); state.team=collectTeamEditor(); state.rotationStart=els.rotationStartInput.value || formatKey(new Date());
    state.firstMemberId = state.team.some(m=>m.id===els.rotationFirstSelect.value) ? els.rotationFirstSelect.value : state.team[0].id;
    addHistory({title:'Equipe atualizada',description:`${oldNames} → ${state.team.map(m=>m.name).join(', ')}`}); closeModal('teamModal'); await persist('Equipe atualizada');
  } catch(err) { showToast(err.message); }
};
$('clearHistoryBtn').onclick = async () => { state.history=[]; renderHistory(); await persist('Histórico limpo'); };
window.addEventListener('storage', (e) => { if (e.key===STORAGE_KEY) { state=loadLocalState(); render(); } });

render(); setupCloud();
