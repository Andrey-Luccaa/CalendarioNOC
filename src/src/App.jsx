import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Drawer, IconButton, MenuItem, Select, Snackbar, Stack,
  Switch, TextField, Tooltip, Typography, ThemeProvider, createTheme, CssBaseline
} from '@mui/material';
import {
  Add, ChevronLeft, ChevronRight, Close, DarkMode, Delete, Edit,
  LightMode, Login, Logout, RestartAlt, Save, Today, CheckCircle, DoNotDisturbAlt
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
    if (isWeekday(cur) && !isHoliday(cur)) count += step;
  }
  return count;
};
const saturdaysBetween = (start, end) => {
  let count = 0;
  const step = end >= start ? 1 : -1;
  const cur = new Date(start);
  while (fmtKey(cur) !== fmtKey(end)) {
    cur.setDate(cur.getDate()+step);
    if (cur.getDay() === 6 && !isHoliday(cur)) count += step;
  }
  return count;
};
const easterSunday = (year) => {
  // Algoritmo de Meeus/Jones/Butcher — Páscoa no calendário gregoriano.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Feriados nacionais do Brasil. A lista é calculada para qualquer ano,
// incluindo os feriados móveis ligados à Páscoa.
const getBrazilHolidays = (year) => {
  const easter = easterSunday(year);
  return [
    {date:new Date(year,0,1), name:'Confraternização Universal'},
    {date:addDays(easter,-2), name:'Paixão de Cristo'},
    {date:new Date(year,3,21), name:'Tiradentes'},
    {date:new Date(year,4,1), name:'Dia Mundial do Trabalho'},
    {date:new Date(year,8,7), name:'Independência do Brasil'},
    {date:new Date(year,9,12), name:'Nossa Senhora Aparecida'},
    {date:new Date(year,10,2), name:'Finados'},
    {date:new Date(year,10,15), name:'Proclamação da República'},
    {date:new Date(year,10,20), name:'Dia Nacional de Zumbi e da Consciência Negra'},
    {date:new Date(year,11,25), name:'Natal'},
  ];
};

const holidayFor = (date) => {
  const holiday = getBrazilHolidays(date.getFullYear()).find(h => fmtKey(h.date) === fmtKey(date));
  return holiday || null;
};

const isHoliday = (date) => !!holidayFor(date);

const defaults = {
  team: [
    {id:'andrey', name:'Andrey', color:'#16c8ff', active:true},
    {id:'vinicius', name:'Vinicius', color:'#ff4f81', active:true},
    {id:'jonatas', name:'Jonatas', color:'#42d392', active:true},
  ],
  weekdayStart: '2026-07-31',
  weekdayFirstId: 'jonatas',
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

const getHolidayClass = (name) => {
  const classes = {
    'Confraternização Universal': 'new-year',
    'Paixão de Cristo': 'easter-passion',
    'Tiradentes': 'tiradentes',
    'Dia Mundial do Trabalho': 'workers',
    'Independência do Brasil': 'independence',
    'Nossa Senhora Aparecida': 'aparecida',
    'Finados': 'all-souls',
    'Proclamação da República': 'republic',
    'Dia Nacional de Zumbi e da Consciência Negra': 'black-consciousness',
    'Natal': 'christmas',
  };

  return classes[name] || 'default-holiday';
};

const HolidayEffects = ({ type }) => {
  if (type === 'new-year') {
    return (
      <div className="holiday-effect new-year-effect" aria-hidden="true">
        <span className="firework firework-one">
          <i/><i/><i/><i/><i/><i/><i/><i/>
        </span>
        <span className="firework firework-two">
          <i/><i/><i/><i/><i/><i/><i/><i/>
        </span>
        <span className="firework firework-three">
          <i/><i/><i/><i/><i/><i/><i/><i/>
        </span>
      </div>
    );
  }

  if (type === 'christmas') {
    return (
      <div className="holiday-effect snow-effect" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ '--snow-delay': `${(i % 9) * 0.7}s`, '--snow-left': `${(i * 17) % 100}%` }} />
        ))}
      </div>
    );
  }

  if (type === 'easter-passion') {
    return (
      <div className="holiday-effect passion-effect" aria-hidden="true">
        <span/>
        <span/>
        <span/>
      </div>
    );
  }

  if (type === 'workers') {
    return (
      <div className="holiday-effect workers-effect" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <span key={i} />)}
      </div>
    );
  }

  if (type === 'independence') {
    return (
      <div className="holiday-effect independence-effect" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => <span key={i} />)}
      </div>
    );
  }

  if (type === 'all-souls') {
    return (
      <div className="holiday-effect fog-effect" aria-hidden="true">
        <span/>
        <span/>
      </div>
    );
  }

  if (type === 'republic') {
    return (
      <div className="holiday-effect republic-effect" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <span key={i} />)}
      </div>
    );
  }

  if (type === 'black-consciousness') {
    return (
      <div className="holiday-effect consciousness-effect" aria-hidden="true">
        <span/>
        <span/>
        <span/>
      </div>
    );
  }

  return (
    <div className="holiday-effect default-effect" aria-hidden="true">
      <span/>
    </div>
  );
};

function App() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [view, setView] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [data, setData] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('escala-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });
  const [selected, setSelected] = useState(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: dark ? '#22d3ee' : '#0284c7' },
      success: { main: '#10b981' },
      background: {
        default: dark ? '#030507' : '#eef5f9',
        paper: dark ? '#0a0f14' : '#ffffff',
      },
      text: {
        primary: dark ? '#f8fbff' : '#10212d',
        secondary: dark ? '#91a2af' : '#607481',
      },
    },
    shape: { borderRadius: 14 },
    typography: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif' },
    components: {
      MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 800 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 22 } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: 12 } } },
    },
  }), [dark]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    localStorage.setItem('escala-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);
  useEffect(() => onSnapshot(DOC_REF, (snap) => {
    const next = snap.exists() ? mergeData(snap.data()) : defaults;
    setData(next); setLoading(false);
  }, (err) => { setError(`Erro ao carregar o Firestore: ${err.message}`); setLoading(false); }), []);

  async function persist(next, message='Alterações salvas') {
    if (!isAdmin) return setError('Somente o administrador pode editar.');
    try {
      const clean = {...next};
      delete clean.saturdayGroups;
      await setDoc(DOC_REF, {...clean, updatedAt: serverTimestamp(), updatedBy: user.email, appVersion:'8.0.0'}, {merge:false});
      setToast(message);
    } catch (err) { setError(err.message); }
  }

  function isNoExtraOverride(date) {
    return data.overrides?.[fmtKey(date)]?.kind === 'none';
  }

  function earliestRelevantDate(anchor, target, type) {
    let earliest = new Date(anchor);
    if (target < earliest) earliest = new Date(target);

    Object.entries(data.overrides || {}).forEach(([key, value]) => {
      if (value?.kind !== 'none') return;
      const date = parseKey(key);
      const valid = type === 'weekday' ? isWeekday(date) : date.getDay() === 6;
      if (isHoliday(date)) return;
      if (!valid || date > target) return;
      if (date < earliest) earliest = date;
    });

    return earliest;
  }

  function consumedWeekdayTurns(anchor, target) {
    const earliest = earliestRelevantDate(anchor, target, 'weekday');
    let offset = businessDaysBetween(anchor, earliest);
    const cursor = new Date(earliest);

    while (cursor < target) {
      if (isWeekday(cursor) && !isHoliday(cursor) && !isNoExtraOverride(cursor)) offset++;
      cursor.setDate(cursor.getDate() + 1);
    }

    return offset;
  }

  function consumedSaturdayTurns(anchor, target) {
    const earliest = earliestRelevantDate(anchor, target, 'saturday');
    let offset = saturdaysBetween(anchor, earliest);
    const cursor = new Date(earliest);

    while (cursor < target) {
      if (cursor.getDay() === 6 && !isHoliday(cursor) && !isNoExtraOverride(cursor)) offset++;
      cursor.setDate(cursor.getDate() + 1);
    }

    return offset;
  }

  function automaticFor(date) {
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    date = normalizedDate;
    const day = date.getDay();
    const holiday = holidayFor(date);
    if (holiday) return {kind:'holiday', people:[], holidayName:holiday.name, optional:!!holiday.optional};
    const active = data.team.filter(p=>p.active);
    if (day === 0) return {kind:'off', people:[]};

    if (day === 6) {
      const start = parseKey(data.saturdayStart);
      const completed = consumedSaturdayTurns(start, date);
      const index = ((completed % 2) + 2) % 2;
      const ids = index === 0 ? (data.saturdayGroupA || []) : (data.saturdayGroupB || []);
      return {kind:'extra', people:ids.map(id=>data.team.find(p=>p.id===id)).filter(Boolean)};
    }

    if (!isWeekday(date) || !active.length) return {kind:'off', people:[]};
    const firstIndex = Math.max(0, active.findIndex(p=>p.id===data.weekdayFirstId));
    const completed = consumedWeekdayTurns(parseKey(data.weekdayStart), date);
    const index = ((firstIndex + completed) % active.length + active.length) % active.length;
    return {kind:'extra', people:[active[index]]};
  }

  function assignmentFor(date) {
    const key = fmtKey(date);
    const holiday = holidayFor(date);
    if (holiday) return {kind:'holiday', people:[], holidayName:holiday.name, optional:!!holiday.optional};
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

  const todayAssignment = assignmentFor(today);
  const monthLabel = view.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const visibleMonthDays = cells.filter(d=>d.getMonth()===view.getMonth());
  const noExtraCount = visibleMonthDays.filter(d=>assignmentFor(d).kind==='none').length;
  const holidayCount = visibleMonthDays.filter(d=>assignmentFor(d).kind==='holiday').length;
  const extraDaysCount = visibleMonthDays.filter(d=>assignmentFor(d).kind==='extra' && assignmentFor(d).people.length).length;
  const nextWorkDate = (() => {
    const d = new Date(today);
    for (let i=0;i<14;i++) {
      if (d.getDay() !== 0 && assignmentFor(d).kind === 'extra') return d;
      d.setDate(d.getDate()+1);
    }
    return now;
  })();
  const nextAssignment = assignmentFor(nextWorkDate);

  async function login() {
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { setError(err.message); }
  }

  return <ThemeProvider theme={muiTheme}><CssBaseline/><Box className={dark ? 'app dark' : 'app light'}>
    <header>
      <Box><Typography variant="h5" fontWeight={800}>Escala de Hora Extra</Typography><Typography className="muted">Painel inteligente da equipe · v8.0</Typography></Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip icon={<CheckCircle/>} label={loading?'Conectando...':'Sincronizado'} color={loading?'default':'success'} variant="outlined" />
        <Tooltip title={dark?'Ativar tema claro':'Ativar tema escuro'}><IconButton className="theme-toggle" onClick={()=>setDark(v=>!v)} aria-label="Alternar tema">{dark?<LightMode/>:<DarkMode/>}</IconButton></Tooltip>
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
        <div className="summary-strip">
          <div><strong>{extraDaysCount}</strong><span>Dias com extra</span></div>
          <div><strong>{holidayCount}</strong><span>Feriados</span></div>
          <div><strong>{nextAssignment.people.map(p=>p.name).join(' + ') || '—'}</strong><span>Próximo da fila</span></div>
        </div>
        <div className="weekdays">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=><div key={x}>{x}</div>)}</div>
        <div className="calendar-grid">
          {cells.map(date=>{
            const asg=assignmentFor(date); const key=fmtKey(date);
            const outside=date.getMonth()!==view.getMonth(); const isToday=key===fmtKey(today);
            return <button key={key} className={`day ${outside?'outside':''} ${isToday?'today':''} ${asg.kind==='none'?'no-extra-day':''} ${asg.kind==='holiday'?'holiday-day':''}`} onClick={()=>setSelected(date)}>
              <span className="day-number">{date.getDate()}</span>
              <div className="events">
                {asg.kind === 'holiday' ? (
  <div
    className={`event holiday holiday-${getHolidayClass(asg.holidayName)}`}
    title={asg.holidayName}
  >
    <HolidayEffects type={getHolidayClass(asg.holidayName)} />

    <span className="holiday-content">
      <span className="holiday-symbol">
        {getHolidayClass(asg.holidayName) === 'new-year' ? '✦' :
         getHolidayClass(asg.holidayName) === 'christmas' ? '✧' :
         getHolidayClass(asg.holidayName) === 'independence' ? '✦' :
         getHolidayClass(asg.holidayName) === 'all-souls' ? '◌' :
         '✦'}
      </span>

      <span className="holiday-name">
        {asg.holidayName}
      </span>
    </span>
  </div>
) : asg.kind === 'none' ? (
  <div className="event none">
    <DoNotDisturbAlt fontSize="inherit"/>
    Sem hora extra
  </div>
) : (
  asg.people.map(p => (
    <div
      key={p.id}
      className="event"
      style={{ '--person': p.color }}
    >
      {p.name}
    </div>
  ))
)}
              </div>
            </button>
          })}
        </div>
      </section>

      <aside>
        <div className="panel hero-panel">
          <span className="eyebrow">HOJE · {ptDate(today)}</span>
          <Typography variant="h5" fontWeight={900}>{todayAssignment.kind==='holiday'?todayAssignment.holidayName:todayAssignment.kind==='none'?'Sem hora extra':todayAssignment.people.map(p=>p.name).join(' + ') || 'Sem escala'}</Typography>
          <Typography className="muted">{todayAssignment.kind==='holiday'?'Feriado nacional — não conta como dia de hora extra e não avança o rodízio.':todayAssignment.kind==='none'?'A vez permanece com a mesma pessoa para o próximo dia útil.':'Escala ativa para hoje.'}</Typography>
          <div className="access-pill">{user ? (isAdmin?'● Administrador conectado':'● Somente visualização') : '● Visualização pública'}</div>
        </div>
        <div className="panel">
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={800}>Equipe</Typography>{isAdmin&&<IconButton onClick={()=>setTeamOpen(true)}><Edit/></IconButton>}</Stack>
          <Stack spacing={1.2} mt={2}>{data.team.map(p=><Stack key={p.id} direction="row" spacing={1.3} alignItems="center"><Avatar sx={{width:28,height:28,bgcolor:p.color}}>{p.name[0]}</Avatar><Typography>{p.name}</Typography>{!p.active&&<Chip size="small" label="Inativo"/>}</Stack>)}</Stack>
        </div>
        <div className="panel rule-panel">
          <span className="eyebrow">REGRA DO RODÍZIO</span>
          <Typography fontWeight={800} mt={1}>A fila só avança quando há hora extra.</Typography>
          <Typography className="muted" mt={1}>Ao marcar “Sem hora extra”, a pessoa continua como próxima responsável.</Typography>
        </div>
        <div className="panel">
          <Typography variant="h6" fontWeight={800}>Legenda</Typography>
          <Stack spacing={1} mt={2}>{data.team.filter(p=>p.active).map(p=><Stack key={p.id} direction="row" spacing={1} alignItems="center"><span className="dot" style={{background:p.color}}/><Typography>{p.name}</Typography></Stack>)}<Stack direction="row" spacing={1} alignItems="center"><span className="dot none-dot"/><Typography>Sem hora extra</Typography></Stack><Stack direction="row" spacing={1} alignItems="center"><span className="dot holiday-dot">★</span><Typography>Feriado nacional</Typography></Stack></Stack>
        </div>
        {isAdmin&&<Button fullWidth variant="outlined" onClick={()=>setConfigOpen(true)}>Configurar rodízio</Button>}
      </aside>
    </main>

    <DayDialog open={!!selected} date={selected} data={data} assignment={selected?assignmentFor(selected):null} admin={isAdmin} onClose={()=>setSelected(null)} onSave={async(result)=>{
      const key=fmtKey(selected); const auto=automaticFor(selected);
      const history={id:uid(),date:key,at:new Date().toISOString(),by:user.email,description:result.kind==='none'?'Sem hora extra — fila mantida':`Responsável: ${result.people.map(id=>data.team.find(p=>p.id===id)?.name).filter(Boolean).join(' + ')}`};
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
  </Box></ThemeProvider>
}

function DayDialog({open,date,data,assignment,admin,onClose,onSave,onReset}) {
  const holiday = date ? holidayFor(date) : null;
  const [kind,setKind]=useState('extra'); const [people,setPeople]=useState([]); const [note,setNote]=useState('');
  useEffect(()=>{ if(open&&assignment){setKind(assignment.kind==='none'?'none':'extra');setPeople(assignment.people.map(p=>p.id));setNote(assignment.note||'')} },[open,assignment]);
  const toggle=(id)=>setPeople(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{className:'day-drawer'}}>
    <Box className="drawer-shell">
      <Box className="drawer-head">
        <Box><span className="eyebrow">EDITAR ESCALA</span><Typography variant="h5" fontWeight={900}>{date?ptDate(date):''}</Typography></Box>
        <IconButton onClick={onClose}><Close/></IconButton>
      </Box>
      <Box className="drawer-content">
        {!admin&&<Alert severity="info">Você está no modo de visualização.</Alert>}
        {holiday&&<Alert severity="warning"><strong>{holiday.name}</strong><br/>Feriado nacional. Este dia não é contado como hora extra e não avança o rodízio.</Alert>}
        {!holiday&&<Box className="drawer-section">
          <Typography fontWeight={900}>Status do dia</Typography>
          <Box className="status-grid">
            <button className={`status-card ${kind==='extra'?'active':''}`} disabled={!admin} onClick={()=>setKind('extra')}><CheckCircle/><strong>Hora extra realizada</strong><span>Avança a fila normalmente</span></button>
            <button className={`status-card ${kind==='none'?'active':''}`} disabled={!admin} onClick={()=>setKind('none')}><DoNotDisturbAlt/><strong>Sem hora extra</strong><span>Mantém a vez para o próximo dia</span></button>
          </Box>
        </Box>}
        {!holiday&&kind==='extra'&&<Box className="drawer-section"><Typography fontWeight={900}>Quem realizou?</Typography><div className="people-grid">{data.team.filter(p=>p.active).map(p=><button key={p.id} disabled={!admin} onClick={()=>toggle(p.id)} className={`person-choice ${people.includes(p.id)?'selected':''}`} style={{'--person':p.color}}><Avatar sx={{bgcolor:p.color,width:38,height:38}}>{p.name[0]}</Avatar><span>{p.name}</span><CheckCircle className="check"/></button>)}</div></Box>}
        {!holiday&&kind==='none'&&<Alert severity="info">A mesma pessoa ou grupo continuará como próximo responsável.</Alert>}
        <Box className="drawer-section">{!holiday&&<TextField fullWidth multiline minRows={4} label="Observação" placeholder="Ex.: equipe liberada no horário normal" value={note} onChange={e=>setNote(e.target.value)} disabled={!admin}/>}</Box>
      </Box>
      <Box className="drawer-actions">
        {admin&&!holiday&&<Button startIcon={<RestartAlt/>} onClick={onReset}>Restaurar automático</Button>}
        <Box sx={{flex:1}}/>
        <Button onClick={onClose}>Cancelar</Button>
        {admin&&!holiday&&<Button variant="contained" startIcon={<Save/>} disabled={kind==='extra'&&!people.length} onClick={()=>onSave({kind,people:kind==='none'?[]:people,note})}>Salvar alteração</Button>}
      </Box>
    </Box>
  </Drawer>
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
