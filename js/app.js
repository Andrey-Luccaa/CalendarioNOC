(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'escalaHoraExtraV3';
  const DAY_MS = 86400000;
  const defaultState = {
    team: [
      { id: 'andrey', name: 'Andrey', color: '#12d9c4' },
      { id: 'vinicius', name: 'Vinicius', color: '#ff5d73' },
      { id: 'jonatas', name: 'Jonatas', color: '#7c6cff' }
    ],
    rotationStart: '2026-08-03',
    rotationFirstId: 'andrey',
    saturdayStart: '2026-08-01',
    saturdayGroups: [['andrey', 'vinicius'], ['jonatas']],
    overrides: {},
    history: [],
    theme: 'dark',
    updatedAt: Date.now()
  };

  let state = clone(defaultState);
  let viewDate = new Date();
  let isAdmin = false;
  let firebaseReady = false;
  let dbRef = null;
  let currentUser = null;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid() { return (crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`); }
  function iso(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function parseISO(value) { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d,12); }
  function formatDate(value, opts={day:'2-digit',month:'long',year:'numeric'}) { return parseISO(value).toLocaleDateString('pt-BR', opts); }
  function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function member(id) { return state.team.find(p => p.id === id); }
  function nameList(ids=[]) { return ids.map(id => member(id)?.name).filter(Boolean).join(' / '); }
  function showToast(text, error=false) { const t=$('toast'); t.textContent=text; t.className=`toast show${error?' error':''}`; setTimeout(()=>t.className='toast',2600); }

  function normalize(data) {
    const merged = {...clone(defaultState), ...(data || {})};
    merged.team = Array.isArray(merged.team) && merged.team.length ? merged.team : clone(defaultState.team);
    merged.saturdayGroups = Array.isArray(merged.saturdayGroups) && merged.saturdayGroups.length === 2 ? merged.saturdayGroups : clone(defaultState.saturdayGroups);
    merged.overrides = merged.overrides || {};
    merged.history = Array.isArray(merged.history) ? merged.history : [];
    return merged;
  }

  function configured() {
    const c=window.APP_CONFIG?.firebase || {};
    return Boolean(c.apiKey && c.authDomain && c.databaseURL && c.projectId && c.appId && !c.apiKey.includes('COLE'));
  }

  async function initStorage() {
    if (!configured()) {
      state = normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
      firebaseReady = false;
      $('setupBanner').classList.remove('hidden');
      setSync('Modo local', false);
      isAdmin = true; // somente demonstração local
      applyAccess();
      renderAll();
      return;
    }

    try {
      firebase.initializeApp(window.APP_CONFIG.firebase);
      const db = firebase.database();
      dbRef = db.ref(window.APP_CONFIG.databasePath || 'escalaHoraExtra');
      firebaseReady = true;
      $('setupBanner').classList.add('hidden');

      dbRef.on('value', snap => {
        if (snap.exists()) state = normalize(snap.val());
        else if (isAdmin) saveState();
        else state = normalize(defaultState);
        setSync('Sincronizado', true);
        renderAll();
      }, err => {
        console.error(err); setSync('Erro de conexão', false); showToast('Não foi possível ler a escala online.', true);
      });

      firebase.auth().onAuthStateChanged(user => {
        currentUser = user;
        const allowed = (window.APP_CONFIG.adminEmail || '').trim().toLowerCase();
        isAdmin = Boolean(user && user.email && user.email.toLowerCase() === allowed);
        if (user && !isAdmin) showToast('Esta conta pode apenas visualizar a escala.', true);
        applyAccess(); renderAll();
      });
    } catch (err) {
      console.error(err);
      setSync('Falha no Firebase', false);
      showToast('Erro ao iniciar o Firebase. Verifique firebase-config.js.', true);
    }
  }

  async function saveState() {
    state.updatedAt = Date.now();
    if (firebaseReady) {
      if (!isAdmin) { showToast('Somente o administrador pode editar.', true); return false; }
      try { await dbRef.set(state); setSync('Sincronizado', true); return true; }
      catch(err) { console.error(err); showToast('Erro ao salvar online.', true); return false; }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  }

  function setSync(text, ok) { $('syncStatus').innerHTML=`<span class="sync-dot${ok?' ok':''}"></span> ${text}`; }
  function applyAccess() {
    document.body.classList.toggle('is-admin', isAdmin);
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
    document.querySelectorAll('.visitor-close').forEach(el => el.classList.toggle('hidden', isAdmin));
    $('loginBtn').classList.toggle('hidden', Boolean(currentUser));
    $('logoutBtn').classList.toggle('hidden', !currentUser);
    $('accessBadge').textContent = isAdmin ? 'Administrador' : (currentUser ? 'Somente leitura' : 'Visitante');
    $('accessBadge').classList.toggle('admin', isAdmin);
    $('calendarTip').textContent = isAdmin ? 'Clique em um dia para editar ou ver detalhes' : 'Clique em um dia para ver os detalhes';
  }

  function weekdayIndex(date) {
    const start=parseISO(state.rotationStart); const target=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
    if (target < start || [0,6].includes(target.getDay())) return -1;
    let count=0; const cursor=new Date(start);
    while (cursor < target) { cursor.setDate(cursor.getDate()+1); if (![0,6].includes(cursor.getDay())) count++; }
    return count;
  }

  function automaticFor(date) {
    const dow=date.getDay();
    if (dow===0) return {status:'none', people:[], automatic:true, label:'Domingo'};
    if (dow===6) {
      const start=parseISO(state.saturdayStart);
      if (date < start) return {status:'none',people:[],automatic:true,label:'Sem escala'};
      const weeks=Math.floor((new Date(date.getFullYear(),date.getMonth(),date.getDate(),12)-start)/(7*DAY_MS));
      const group=state.saturdayGroups[((weeks%2)+2)%2] || [];
      return {status:group.length?'extra':'none',people:group,automatic:true,label:group.length?'Hora extra':'Sem hora extra'};
    }
    const idx=weekdayIndex(date);
    if (idx<0 || !state.team.length) return {status:'none',people:[],automatic:true,label:'Sem escala'};
    const first=Math.max(0,state.team.findIndex(p=>p.id===state.rotationFirstId));
    const p=state.team[(first+idx)%state.team.length];
    return {status:'extra',people:p?[p.id]:[],automatic:true,label:'Hora extra'};
  }

  function scheduleFor(date) {
    const key=iso(date); const auto=automaticFor(date); const o=state.overrides[key];
    return o ? {...auto,...o,automatic:false} : auto;
  }

  function renderAll() { applyTheme(); renderHeader(); renderSidebar(); renderCalendar(); }
  function applyTheme() { document.documentElement.dataset.theme=state.theme || 'dark'; }
  function renderHeader() { $('monthTitle').textContent=viewDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase()); }

  function renderSidebar() {
    const today=new Date(); const s=scheduleFor(today);
    $('todayDate').textContent=today.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
    $('todayPerson').textContent=s.status==='none'?'Sem hora extra':nameList(s.people) || 'Não definido';
    $('todayStatus').textContent=s.status==='none'?'Saída no horário normal':today.getDay()===6?'Escala de sábado':'Hora extra';
    const colors=s.people.map(id=>member(id)?.color).filter(Boolean);
    $('todayColor').style.background=colors.length>1?`linear-gradient(90deg,${colors.join(',')})`:(colors[0]||'#64748b');

    $('rotationList').innerHTML=state.team.map((p,i)=>`<div class="rotation-item"><span class="order">${i+1}</span><span class="person-dot" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span></div>`).join('');
    $('legendList').innerHTML=state.team.map(p=>`<div class="legend-item"><span class="legend-dash" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span></div>`).join('');
    $('saturdaySummary').innerHTML=`<div><b>A</b> ${escapeHtml(nameList(state.saturdayGroups[0])||'Ninguém')}</div><div><b>B</b> ${escapeHtml(nameList(state.saturdayGroups[1])||'Ninguém')}</div>`;
  }

  function renderCalendar() {
    const grid=$('calendarGrid'); grid.innerHTML='';
    const y=viewDate.getFullYear(), m=viewDate.getMonth();
    const first=new Date(y,m,1), start=new Date(y,m,1-first.getDay());
    const todayKey=iso(new Date());
    for(let i=0;i<42;i++) {
      const d=new Date(start); d.setDate(start.getDate()+i); const key=iso(d); const s=scheduleFor(d);
      const cell=document.createElement('button'); cell.className='day-cell'; cell.type='button';
      if(d.getMonth()!==m) cell.classList.add('outside'); if(key===todayKey) cell.classList.add('today'); if(!s.automatic) cell.classList.add('changed');
      const people=s.people.map(id=>member(id)).filter(Boolean);
      let bars='';
      if(s.status==='none') bars='<span class="event no-extra-event">Sem hora extra</span>';
      else bars=people.map(p=>`<span class="event" style="--event-color:${p.color}">${escapeHtml(p.name)}</span>`).join('');
      cell.innerHTML=`<span class="day-number">${d.getDate()}</span><div class="events">${bars}</div>${!s.automatic?'<span class="edited-mark">✎</span>':''}`;
      cell.addEventListener('click',()=>openDay(d)); grid.appendChild(cell);
    }
  }

  function openModal(id) { $(id).classList.add('open'); $(id).setAttribute('aria-hidden','false'); }
  function closeModal(id) { $(id).classList.remove('open'); $(id).setAttribute('aria-hidden','true'); }

  function openDay(date) {
    const key=iso(date), s=scheduleFor(date); $('selectedDate').value=key; $('dayModalTitle').textContent=formatDate(key,{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    $('dayReadOnly').innerHTML=`<div class="detail-status"><span>${s.status==='none'?'Sem hora extra':'Hora extra'}</span><strong>${s.status==='none'?'Todos saem no horário normal':escapeHtml(nameList(s.people)||'Não definido')}</strong>${s.note?`<small>${escapeHtml(s.note)}</small>`:''}</div>`;
    document.querySelector(`input[name="dayStatus"][value="${s.status}"]`).checked=true;
    $('dayNote').value=s.note||'';
    $('peopleChoices').innerHTML=state.team.map(p=>`<label class="person-choice"><input type="checkbox" value="${p.id}" ${s.people.includes(p.id)?'checked':''}><span class="person-dot" style="background:${p.color}"></span>${escapeHtml(p.name)}</label>`).join('');
    togglePeopleField(); openModal('dayModal');
  }

  function togglePeopleField() { const none=document.querySelector('input[name="dayStatus"]:checked')?.value==='none'; $('peopleField').classList.toggle('hidden',none); }

  function renderTeamEditor() {
    $('teamEditor').innerHTML=state.team.map((p,i)=>`<div class="team-row" data-id="${p.id}"><span class="drag-handle">⋮⋮</span><input class="team-color" type="color" value="${p.color}"><input class="team-name" value="${escapeHtml(p.name)}" maxlength="30"><button class="move-btn" data-dir="-1" ${i===0?'disabled':''}>↑</button><button class="move-btn" data-dir="1" ${i===state.team.length-1?'disabled':''}>↓</button><button class="remove-member" title="Remover">×</button></div>`).join('');
    $('rotationStartInput').value=state.rotationStart; $('saturdayStartInput').value=state.saturdayStart;
    updateSettingsChoices();
  }

  function updateSettingsChoices() {
    const rows=[...document.querySelectorAll('.team-row')].map(r=>({id:r.dataset.id,name:r.querySelector('.team-name').value.trim()||'Sem nome'}));
    $('rotationFirstSelect').innerHTML=rows.map(p=>`<option value="${p.id}" ${p.id===state.rotationFirstId?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
    for(const [idx,id] of [[0,'saturdayGroupA'],[1,'saturdayGroupB']]) {
      $(id).innerHTML=rows.map(p=>`<label><input type="checkbox" value="${p.id}" ${(state.saturdayGroups[idx]||[]).includes(p.id)?'checked':''}>${escapeHtml(p.name)}</label>`).join('');
    }
  }

  function renderHistory() {
    const list=$('historyList');
    if(!state.history.length){list.innerHTML='<p class="empty-state">Nenhuma alteração registrada.</p>';return;}
    list.innerHTML=state.history.slice().reverse().map(h=>`<article class="history-item"><div><strong>${formatDate(h.date,{day:'2-digit',month:'2-digit',year:'numeric'})}</strong><span>${escapeHtml(h.action)}</span></div><small>${new Date(h.at).toLocaleString('pt-BR')}${h.by?` • ${escapeHtml(h.by)}`:''}</small></article>`).join('');
  }

  $('prevMonthBtn').onclick=()=>{viewDate.setMonth(viewDate.getMonth()-1);renderAll();};
  $('nextMonthBtn').onclick=()=>{viewDate.setMonth(viewDate.getMonth()+1);renderAll();};
  $('todayBtn').onclick=()=>{viewDate=new Date();renderAll();};
  $('themeBtn').onclick=async()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme(); if(!firebaseReady)localStorage.setItem(STORAGE_KEY,JSON.stringify(state));};
  $('historyBtn').onclick=()=>{renderHistory();openModal('historyModal');};
  $('manageTeamBtn').onclick=()=>{if(!isAdmin)return;renderTeamEditor();openModal('teamModal');};
  document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>closeModal(el.dataset.close)));
  document.querySelectorAll('input[name="dayStatus"]').forEach(el=>el.addEventListener('change',togglePeopleField));

  $('dayForm').addEventListener('submit',async e=>{
    e.preventDefault(); if(!isAdmin)return;
    const date=$('selectedDate').value, status=document.querySelector('input[name="dayStatus"]:checked').value;
    const people=status==='extra'?[...$('peopleChoices').querySelectorAll('input:checked')].map(i=>i.value):[];
    if(status==='extra'&&!people.length){showToast('Escolha pelo menos um responsável.',true);return;}
    const note=$('dayNote').value.trim(); state.overrides[date]={status,people,note};
    state.history.push({date,action:status==='none'?'Definido como sem hora extra':`Responsável(is): ${nameList(people)}`,at:Date.now(),by:currentUser?.email||'Administrador'});
    if(await saveState()){closeModal('dayModal');renderAll();showToast('Escala atualizada.');}
  });

  $('restoreDayBtn').onclick=async()=>{
    if(!isAdmin)return; const date=$('selectedDate').value; delete state.overrides[date]; state.history.push({date,action:'Rodízio automático restaurado',at:Date.now(),by:currentUser?.email||'Administrador'});
    if(await saveState()){closeModal('dayModal');renderAll();showToast('Rodízio restaurado.');}
  };

  $('addMemberBtn').onclick=()=>{
    const row=document.createElement('div'); row.className='team-row'; row.dataset.id=uid(); row.innerHTML=`<span class="drag-handle">⋮⋮</span><input class="team-color" type="color" value="#f59e0b"><input class="team-name" value="Novo integrante" maxlength="30"><button class="move-btn" data-dir="-1">↑</button><button class="move-btn" data-dir="1">↓</button><button class="remove-member">×</button>`; $('teamEditor').appendChild(row); updateSettingsChoices();
  };
  $('teamEditor').addEventListener('input',e=>{if(e.target.classList.contains('team-name'))updateSettingsChoices();});
  $('teamEditor').addEventListener('click',e=>{
    const row=e.target.closest('.team-row'); if(!row)return;
    if(e.target.classList.contains('remove-member')){if(document.querySelectorAll('.team-row').length<=1)return showToast('A equipe precisa ter ao menos uma pessoa.',true);row.remove();updateSettingsChoices();}
    if(e.target.classList.contains('move-btn')){const dir=Number(e.target.dataset.dir);const sibling=dir<0?row.previousElementSibling:row.nextElementSibling;if(sibling)dir<0?row.parentNode.insertBefore(row,sibling):row.parentNode.insertBefore(sibling,row);updateSettingsChoices();}
  });

  $('saveTeamBtn').onclick=async()=>{
    const rows=[...document.querySelectorAll('.team-row')]; const newTeam=rows.map(r=>({id:r.dataset.id,name:r.querySelector('.team-name').value.trim(),color:r.querySelector('.team-color').value}));
    if(newTeam.some(p=>!p.name))return showToast('Preencha o nome de todos.',true);
    const gA=[...$('saturdayGroupA').querySelectorAll('input:checked')].map(i=>i.value), gB=[...$('saturdayGroupB').querySelectorAll('input:checked')].map(i=>i.value);
    if(!gA.length||!gB.length)return showToast('Escolha pelo menos uma pessoa em cada grupo de sábado.',true);
    state.team=newTeam; state.rotationStart=$('rotationStartInput').value; state.rotationFirstId=$('rotationFirstSelect').value; state.saturdayStart=$('saturdayStartInput').value; state.saturdayGroups=[gA,gB];
    state.history.push({date:iso(new Date()),action:'Configurações da equipe e dos sábados atualizadas',at:Date.now(),by:currentUser?.email||'Administrador'});
    if(await saveState()){closeModal('teamModal');renderAll();showToast('Configurações salvas.');}
  };

  $('clearHistoryBtn').onclick=async()=>{if(!isAdmin||!confirm('Limpar todo o histórico?'))return;state.history=[];if(await saveState()){renderHistory();showToast('Histórico limpo.');}};
  $('loginBtn').onclick=async()=>{if(!firebaseReady)return showToast('Configure o Firebase antes de usar o login.',true);try{await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){console.error(e);showToast('Não foi possível entrar com o Google.',true);}};
  $('logoutBtn').onclick=()=>firebase.auth().signOut();

  initStorage();
})();
