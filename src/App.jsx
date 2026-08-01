import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, MenuItem, Select, Snackbar, Stack,
  Switch, TextField, Tooltip, Typography
} from '@mui/material';
import {
  Add, ChevronLeft, ChevronRight, Close, DarkMode, Delete, Edit,
  LightMode, Login, Logout, RestartAlt, Save, Today
} from '@mui/icons-material';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ADMIN_EMAIL, auth, db, googleProvider } from './firebase';

const DOC_REF = doc(db, 'escala', 'principal');
const fmtKey = (d) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
const parseKey = (k) => { const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); };
const ptDate = (d) => d.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric'});
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isWeekday = (d) => d.getDay() >= 1 && d.getDay() <= 5;
const diffCalendarDays = (a,b) => Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())-Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000);
const businessDaysBetween = (start, end) => {
  let count = 0;
  const step = end >= start ? 1 : -1;
  const cur = new Date(start);
  while (fmtKey(cur) !== fmtKey(end)) {
    cur.setDate(cur.getDate()+step);
    if (isWeekday(cur)) count += step;
  }
  return count;
};
const saturdaysBetween = (start, end) => Math.floor(diffCalendarDays(end,start)/7);

const defaults = {
  team: [
    {id:'andrey', name:'Andrey', color:'#16c8ff', active:true},
    {id:'vinicius', name:'Vinicius', color:'#ff4f81', active:true},
    {id:'jonatas', name:'Jonatas', color:'#42d392', active:true},
  ],
  weekdayStart: '2026-08-03',
  weekdayFirstId: 'andrey',
  saturdayStart: '2026-08-01',
  saturdayGroupA: ['andrey','vinicius'],
  saturdayGroupB: ['jonatas'],
  overrides: {},
  history: [],
};

function mergeData(value) {
  return {
    ...defaults,
    ...(value || {}),
    team: Array.isArray(value?.team) && value.team.length ? value.team : defaults.team,
    saturdayGroupA: Array.isArray(value?.saturdayGroupA)
      ? value.saturdayGroupA
      : Array.isArray(value?.saturdayGroups?.group1)
        ? value.saturdayGroups.group1
        : Array.isArray(value?.saturdayGroups?.[0])
          ? value.saturdayGroups[0]
          : defaults.saturdayGroupA,
    saturdayGroupB: Array.isArray(value?.saturdayGroupB)
      ? value.saturdayGroupB
      : Array.isArray(value?.saturdayGroups?.group2)
        ? value.saturdayGroups.group2
        : Array.isArray(value?.saturdayGroups?.[1])
          ? value.saturdayGroups[1]
          : defaults.saturdayGroupB,
    overrides: value?.overrides || {},
    history: value?.history || [],
  };
}

function App() {
  const now = new Date();
  const [view, setView] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [data, setData] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(true);
  const [selected, setSelected] = useState(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => onSnapshot(DOC_REF, (snap) => {
    const next = snap.exists() ? mergeData(snap.data()) : defaults;
    setData(next); setLoading(false);
  }, (err) => { setError(`Erro ao carregar o Firestore: ${err.message}`); setLoading(false); }), []);

  async function persist(next, message='Alterações salvas') {
    if (!isAdmin) return setError('Somente o administrador pode editar.');
    try {
      const clean = {...next};
      delete clean.saturdayGroups;
      await setDoc(DOC_REF, {...clean, updatedAt: serverTimestamp(), updatedBy: user.email, appVersion:'4.2.0'}, {merge:false});
      setToast(message);
    } catch (err) { setError(err.message); }
  }

  function automaticFor(date) {
    const day = date.getDay();
    const active = data.team.filter(p=>p.active);
    if (day === 0) return {kind:'off', people:[]};
    if (day === 6) {
      const start = parseKey(data.saturdayStart);
      const index = ((saturdaysBetween(start,date)%2)+2)%2;
      const ids = index === 0 ? (data.saturdayGroupA || []) : (data.saturdayGroupB || []);
      return {kind:'extra', people:ids.map(id=>data.team.find(p=>p.id===id)).filter(Boolean)};
    }
    if (!isWeekday(date) || !active.length) return {kind:'off', people:[]};
    const firstIndex = Math.max(0, active.findIndex(p=>p.id===data.weekdayFirstId));
    const offset = businessDaysBetween(parseKey(data.weekdayStart), date);
    const index = ((firstIndex + offset) % active.length + active.length) % active.length;
    return {kind:'extra', people:[active[index]]};
  }

  function assignmentFor(date) {
    const key = fmtKey(date);
    const override = data.overrides[key];
    if (!override) return automaticFor(date);
    if (override.kind === 'none') return {kind:'none', people:[], note:override.note};
    return {kind:'extra', people:(override.people||[]).map(id=>data.team.find(p=>p.id===id)).filter(Boolean), note:override.note};
  }

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(),view.getMonth(),1);
    const start = new Date(first); start.setDate(1-first.getDay());
    return Array.from({length:42},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  }, [view]);

  const todayAssignment = assignmentFor(now);
  const monthLabel = view.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  async function login() {
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { setError(err.message); }
  }

  return <Box className={dark ? 'app dark' : 'app light'}>
    <header>
      <Box><Typography variant="h5" fontWeight={800}>Escala de Hora Extra</Typography><Typography className="muted">Calendário compartilhado da equipe · v4.2</Typography></Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label={loading?'Carregando...':'Atualização em tempo real'} color={loading?'default':'success'} variant="outlined" />
        <Tooltip title={dark?'Tema claro':'Tema escuro'}><IconButton onClick={()=>setDark(!dark)}>{dark?<LightMode/>:<DarkMode/>}</IconButton></Tooltip>
        {user ? <Button startIcon={<Logout/>} onClick={()=>signOut(auth)} variant="outlined">Sair</Button> : <Button startIcon={<Login/>} onClick={login} variant="contained">Entrar</Button>}
      </Stack>
    </header>

    <main>
      <section className="calendar-card">
        <div className="calendar-toolbar">
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()-1,1))}><ChevronLeft/></IconButton>
            <Typography variant="h5" textTransform="capitalize" fontWeight={750}>{monthLabel}</Typography>
            <IconButton onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()+1,1))}><ChevronRight/></IconButton>
          </Stack>
          <Button startIcon={<Today/>} onClick={()=>setView(new Date(now.getFullYear(),now.getMonth(),1))}>Hoje</Button>
        </div>
        <div className="weekdays">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=><div key={x}>{x}</div>)}</div>
        <div className="calendar-grid">
          {cells.map(date=>{
            const asg=assignmentFor(date); const key=fmtKey(date);
            const outside=date.getMonth()!==view.getMonth(); const isToday=key===fmtKey(now);
            return <button key={key} className={`day ${outside?'outside':''} ${isToday?'today':''}`} onClick={()=>setSelected(date)}>
              <span className="day-number">{date.getDate()}</span>
              <div className="events">
                {asg.kind==='none' ? <div className="event none">Sem hora extra</div> : asg.people.map(p=><div key={p.id} className="event" style={{'--person':p.color}}>{p.name}</div>)}
              </div>
            </button>
          })}
        </div>
      </section>

      <aside>
        <div className="panel hero-panel">
          <Typography className="muted">Hoje · {ptDate(now)}</Typography>
          <Typography variant="h6" fontWeight={800}>{todayAssignment.kind==='none'?'Sem hora extra':todayAssignment.people.map(p=>p.name).join(' + ') || 'Sem escala'}</Typography>
          <Typography className="muted">{user ? (isAdmin?'Administrador conectado':'Conta sem permissão de edição') : 'Visualização pública'}</Typography>
        </div>
        <div className="panel">
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={800}>Equipe</Typography>{isAdmin&&<IconButton onClick={()=>setTeamOpen(true)}><Edit/></IconButton>}</Stack>
          <Stack spacing={1.2} mt={2}>{data.team.map(p=><Stack key={p.id} direction="row" spacing={1.3} alignItems="center"><Avatar sx={{width:28,height:28,bgcolor:p.color}}>{p.name[0]}</Avatar><Typography>{p.name}</Typography>{!p.active&&<Chip size="small" label="Inativo"/>}</Stack>)}</Stack>
        </div>
        <div className="panel">
          <Typography variant="h6" fontWeight={800}>Legenda</Typography>
          <Stack spacing={1} mt={2}>{data.team.filter(p=>p.active).map(p=><Stack key={p.id} direction="row" spacing={1} alignItems="center"><span className="dot" style={{background:p.color}}/><Typography>{p.name}</Typography></Stack>)}<Stack direction="row" spacing={1} alignItems="center"><span className="dot none-dot"/><Typography>Sem hora extra</Typography></Stack></Stack>
        </div>
        {isAdmin&&<Button fullWidth variant="outlined" onClick={()=>setConfigOpen(true)}>Configurar rodízio</Button>}
      </aside>
    </main>

    <DayDialog open={!!selected} date={selected} data={data} assignment={selected?assignmentFor(selected):null} admin={isAdmin} onClose={()=>setSelected(null)} onSave={async(result)=>{
      const key=fmtKey(selected); const auto=automaticFor(selected);
      const history={id:uid(),date:key,at:new Date().toISOString(),by:user.email,description:result.kind==='none'?'Marcado sem hora extra':`Responsável: ${result.people.map(id=>data.team.find(p=>p.id===id)?.name).filter(Boolean).join(' + ')}`};
      const next={...data,overrides:{...data.overrides,[key]:result},history:[history,...data.history].slice(0,200)};
      await persist(next); setSelected(null);
    }} onReset={async()=>{
      const key=fmtKey(selected); const overrides={...data.overrides}; delete overrides[key];
      await persist({...data,overrides},'Rodízio automático restaurado'); setSelected(null);
    }}/>
    <TeamDialog open={teamOpen} data={data} onClose={()=>setTeamOpen(false)} onSave={async(team)=>{await persist({...data,team});setTeamOpen(false)}} />
    <ConfigDialog open={configOpen} data={data} onClose={()=>setConfigOpen(false)} onSave={async(changes)=>{await persist({...data,...changes});setConfigOpen(false)}} />
    <Snackbar open={!!toast} autoHideDuration={3000} onClose={()=>setToast('')} message={toast}/>
    <Snackbar open={!!error} autoHideDuration={6000} onClose={()=>setError('')}><Alert severity="error" onClose={()=>setError('')}>{error}</Alert></Snackbar>
  </Box>
}

function DayDialog({open,date,data,assignment,admin,onClose,onSave,onReset}) {
  const [kind,setKind]=useState('extra'); const [people,setPeople]=useState([]); const [note,setNote]=useState('');
  useEffect(()=>{ if(open&&assignment){setKind(assignment.kind==='none'?'none':'extra');setPeople(assignment.people.map(p=>p.id));setNote(assignment.note||'')} },[open,assignment]);
  const toggle=(id)=>setPeople(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Escala de {date?ptDate(date):''}</DialogTitle><DialogContent>
    {!admin&&<Alert severity="info" sx={{mb:2}}>Você está no modo de visualização.</Alert>}
    <Typography gutterBottom>Status</Typography><Select fullWidth value={kind} onChange={e=>setKind(e.target.value)} disabled={!admin}><MenuItem value="extra">Hora extra</MenuItem><MenuItem value="none">Sem hora extra</MenuItem></Select>
    {kind==='extra'&&<><Typography mt={2} gutterBottom>Responsável(is)</Typography><Stack direction="row" gap={1} flexWrap="wrap">{data.team.filter(p=>p.active).map(p=><Chip key={p.id} clickable disabled={!admin} onClick={()=>toggle(p.id)} label={p.name} variant={people.includes(p.id)?'filled':'outlined'} sx={people.includes(p.id)?{bgcolor:p.color,color:'#061018'}:{}}/>)}</Stack></>}
    <TextField fullWidth multiline minRows={2} label="Observação" value={note} onChange={e=>setNote(e.target.value)} disabled={!admin} sx={{mt:2}}/>
  </DialogContent><DialogActions><Button onClick={onClose}>Fechar</Button>{admin&&<Button startIcon={<RestartAlt/>} onClick={onReset}>Restaurar</Button>}{admin&&<Button variant="contained" startIcon={<Save/>} disabled={kind==='extra'&&!people.length} onClick={()=>onSave({kind,people:kind==='none'?[]:people,note})}>Salvar</Button>}</DialogActions></Dialog>
}

function TeamDialog({open,data,onClose,onSave}) {
  const [team,setTeam]=useState([]); useEffect(()=>{if(open)setTeam(data.team.map(x=>({...x})))},[open,data]);
  const add=()=>setTeam([...team,{id:uid(),name:'Novo integrante',color:'#f5b942',active:true}]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Personalizar equipe</DialogTitle><DialogContent><Stack spacing={1.5} mt={1}>{team.map((p,i)=><Stack key={p.id} direction="row" spacing={1} alignItems="center"><input type="color" value={p.color} onChange={e=>setTeam(team.map(x=>x.id===p.id?{...x,color:e.target.value}:x))}/><TextField size="small" fullWidth value={p.name} onChange={e=>setTeam(team.map(x=>x.id===p.id?{...x,name:e.target.value}:x))}/><Switch checked={p.active} onChange={e=>setTeam(team.map(x=>x.id===p.id?{...x,active:e.target.checked}:x))}/><IconButton onClick={()=>setTeam(team.filter(x=>x.id!==p.id))}><Delete/></IconButton></Stack>)}</Stack><Button startIcon={<Add/>} onClick={add} sx={{mt:2}}>Adicionar integrante</Button></DialogContent><DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" onClick={()=>onSave(team)}>Salvar</Button></DialogActions></Dialog>
}

function ConfigDialog({open,data,onClose,onSave}) {
 const [form,setForm]=useState({}); useEffect(()=>{if(open)setForm({weekdayStart:data.weekdayStart,weekdayFirstId:data.weekdayFirstId,saturdayStart:data.saturdayStart,saturdayGroupA:[...(data.saturdayGroupA||[])],saturdayGroupB:[...(data.saturdayGroupB||[])]})},[open,data]);
 if(!form.saturdayGroupA || !form.saturdayGroupB)return null;
 const setGroup=(group,val)=>setForm({...form,[group]:val});
 return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Configurar rodízio</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField type="date" label="Data inicial — segunda a sexta" InputLabelProps={{shrink:true}} value={form.weekdayStart} onChange={e=>setForm({...form,weekdayStart:e.target.value})}/><Select value={form.weekdayFirstId} onChange={e=>setForm({...form,weekdayFirstId:e.target.value})}>{data.team.filter(p=>p.active).map(p=><MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</Select><Divider/><TextField type="date" label="Primeiro sábado do ciclo" InputLabelProps={{shrink:true}} value={form.saturdayStart} onChange={e=>setForm({...form,saturdayStart:e.target.value})}/><Typography>Sábado A</Typography><Select multiple value={form.saturdayGroupA} onChange={e=>setGroup('saturdayGroupA',e.target.value)}>{data.team.map(p=><MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</Select><Typography>Sábado B</Typography><Select multiple value={form.saturdayGroupB} onChange={e=>setGroup('saturdayGroupB',e.target.value)}>{data.team.map(p=><MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</Select></Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" onClick={()=>onSave(form)}>Salvar</Button></DialogActions></Dialog>
}

export default App;
