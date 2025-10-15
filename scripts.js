// ===== НАСТРОЙКИ (оставил ваши значения) ===================================
const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
const API_KEY  = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
const RANGE    = 'Лист1!A:G'; // Категория | Субкатегория | Название | Дата | Описание | Ссылка | Логотип
const PORTAL_PASSWORD = 'Blacktech';

// === УТИЛЫ ==================================================================
const $ = s => document.querySelector(s);
const parseDate = (str) => {
  if(!str) return null;
  const trimmed = String(str).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed
            : /^\d{2}\.\d{2}\.\d{4}$/.test(trimmed) ? trimmed.split('.').reverse().join('-')
            : trimmed;
  const d = new Date(iso);
  return isNaN(+d) ? null : d;
}
const fmtDate = (d) => d ? d.toLocaleDateString('ru-RU') : '—';

// === СОСТОЯНИЕ ==============================================================
const state = {
  view: 'cats',    // cats | subs | items
  cat: null,
  sub: null,
  items: [],
  tree: new Map(), // Map<Категория, Map<Субкатегория, Item[]>>
  search: ''
};

// === ЗАГРУЗКА И ПОСТРОЕНИЕ ДЕРЕВА ==========================================
async function loadFromSheet(){
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Sheets API: ${res.status}`);
  const data = await res.json();
  const rows = data.values || [];
  const header = rows[0] || [];

  const idx = name => header.indexOf(name);
  const iCat = idx('Категория');
  const iSub = idx('Субкатегория');
  const iTitle = idx('Название');
  const iDate = idx('Дата');
  const iDesc = idx('Описание');
  const iLink = idx('Ссылка');
  const iLogo = idx('Логотип');

  const items = rows.slice(1).map((r, id) => ({
    id,
    category: (r[iCat]||'Без категории').trim(),
    subcategory: (r[iSub]||'Без раздела').trim(),
    title: (r[iTitle]||'Без названия').trim(),
    date: parseDate(r[iDate]),
    description: (r[iDesc]||'').trim(),
    link: (r[iLink]||'#').trim(),
    logo: (r[iLogo]||'').trim()
  }));

  // новые → старые
  items.sort((a,b) => (b.date?.getTime()||0)-(a.date?.getTime()||0));
  state.items = items;

  // дерево
  const tree = new Map();
  for(const it of items){
    if(!tree.has(it.category)) tree.set(it.category, new Map());
    const subs = tree.get(it.category);
    const key = it.subcategory || 'Без раздела';
    if(!subs.has(key)) subs.set(key, []);
    subs.get(key).push(it);
  }
  state.tree = tree;
}

// === РЕНДЕР =================================================================
function renderBreadcrumbs(){
  const parts = [];
  parts.push(`<a href="#" data-nav="root">Главная</a>`);
  if(state.view!=='cats' && state.cat) parts.push(`<span class="sep">/</span><a href="#" data-nav="cat">${state.cat}</a>`);
  if(state.view==='items' && state.sub) parts.push(`<span class="sep">/</span><span>${state.sub}</span>`);
  $('#breadcrumbs').innerHTML = parts.join(' ');
  $('#breadcrumbs').onclick = (e)=>{
    const a = e.target.closest('a[data-nav]');
    if(!a) return;
    e.preventDefault();
    const nav = a.dataset.nav;
    if(nav==='root'){ state.view='cats'; state.cat=null; state.sub=null; state.search=''; $('#search').value=''; }
    if(nav==='cat'){ state.view='subs'; state.sub=null; }
    draw();
  };
}

function renderCategories(){
  const wrap = $('#view-categories');
  wrap.hidden = false; $('#view-subcategories').hidden=true; $('#view-items').hidden=true;

  const cards = [];
  for(const [cat, subs] of state.tree.entries()){
    let count = 0; for(const arr of subs.values()) count += arr.length;
    cards.push(`
      <article class="folder" data-cat="${cat}">
        <div class="title">${cat}</div>
        <div class="meta">Разделов: ${subs.size}</div>
        <span class="badge">${count} док.</span>
      </article>
    `);
  }
  wrap.innerHTML = cards.join('');
  wrap.onclick = (e)=>{
    const el = e.target.closest('.folder'); if(!el) return;
    state.cat = el.dataset.cat; state.view='subs';
    renderBreadcrumbs(); renderSubcategories();
  };
}

function renderSubcategories(){
  const wrap = $('#view-subcategories');
  wrap.hidden = false; $('#view-categories').hidden=true; $('#view-items').hidden=true;

  const subs = state.tree.get(state.cat) || new Map();
  const cards = [];
  for(const [sub, arr] of subs.entries()){
    cards.push(`
      <article class="folder" data-sub="${sub}">
        <div class="title">${sub}</div>
        <div class="meta">${state.cat}</div>
        <span class="badge">${arr.length} док.</span>
      </article>
    `);
  }
  wrap.innerHTML = cards.join('');
  wrap.onclick = (e)=>{
    const el = e.target.closest('.folder'); if(!el) return;
    state.sub = el.dataset.sub; state.view='items';
    renderBreadcrumbs(); renderItems();
  };
}

function renderItems(){
  const wrap = $('#view-items');
  wrap.hidden = false; $('#view-categories').hidden=true; $('#view-subcategories').hidden=true;

  let list = state.items;
  if(state.cat) list = list.filter(x=>x.category===state.cat);
  if(state.sub) list = list.filter(x=>x.subcategory===state.sub);
  if(state.search){
    const q = state.search.toLowerCase();
    list = list.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.description.toLowerCase().includes(q) ||
      x.category.toLowerCase().includes(q) ||
      x.subcategory.toLowerCase().includes(q)
    );
  }

  wrap.innerHTML = list.map(it => `
    <article class="card">
      <div class="kicker">${it.category} · ${it.subcategory} · ${fmtDate(it.date)}</div>
      <div class="title">${it.logo?`<img class="logo" src="${it.logo}" alt="">`:''}${it.title}</div>
      <div class="desc">${it.description || ''}</div>
      <div class="actions">
        <a href="${it.link}" target="_blank" rel="noopener">Открыть</a>
      </div>
    </article>
  `).join('');
}

function draw(){
  renderBreadcrumbs();
  if(state.view==='cats') renderCategories();
  else if(state.view==='subs') renderSubcategories();
  else renderItems();
}

// === ПОИСК ==================================================================
function bindSearch(){
  $('#search').addEventListener('input', e=>{
    state.search = e.target.value.trim();
    state.view = 'items'; // поиск всегда показывает документы
    draw();
  });
}

// === ПАРОЛЬ ================================================================
function bindGate(){
  $('#enterBtn').onclick = ()=>{
    const ok = ($('#pwd').value||'').trim() === PORTAL_PASSWORD;
    if(ok){ $('#gate').style.display='none'; }
    else $('#gateErr').textContent = 'Неверный пароль';
  };
  $('#pwd').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#enterBtn').click(); });
}

// === ЗАПУСК ================================================================
document.addEventListener('DOMContentLoaded', async()=>{
  bindGate();
  bindSearch();
  try{
    await loadFromSheet();
    draw();
  }catch(err){
    console.error(err);
    // Фолбэк на случай ошибки API — пустая главная
    state.items=[]; state.tree=new Map(); draw();
  }
});
