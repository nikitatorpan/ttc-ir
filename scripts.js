// ===== Конфигурация =========================================================
const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
const API_KEY  = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
const RANGE    = 'Лист1!A:G'; // B Название документа | C Категория | D Субкатегория | E Дата | F Пояснение | G Ссылка
const PORTAL_PASSWORD = 'Blacktech';

// ===== Утилиты ==============================================================
const $ = s => document.querySelector(s);
const fmtDate = d => d ? d.toLocaleDateString('ru-RU') : '—';
const parseDate = s => {
  if(!s) return null;
  const t = String(s).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(t) ? t
           : /^\d{2}\.\d{2}\.\d{4}$/.test(t) ? t.split('.').reverse().join('-')
           : t;
  const d = new Date(iso);
  return isNaN(+d) ? null : d;
};

// ===== Состояние ============================================================
const state = {
  tree: new Map(),  // Map<Category, Map<Subcat, Item[]>>
  view: 'cats',     // 'cats' | 'subs' | 'items'
  cat: null,
  sub: null
};

// ===== Загрузка из Google Sheets ===========================================
async function loadFromSheet(){
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Sheets API: ${r.status}`);
  const j = await r.json();
  const rows = j.values || [];
  const header = rows[0] || [];

  // Индексы нужных столбцов
  const idx = name => header.indexOf(name);
  const iTitle = idx('Название документа');
  const iCat   = idx('Категория');
  const iSub   = idx('Субкатегория');
  const iDate  = idx('Дата обновления');
  const iDesc  = idx('Пояснение');
  const iLink  = idx('Ссылка');

  const items = rows.slice(1).map((r, id) => ({
    id,
    title: (r[iTitle]||'Без названия').trim(),
    category: (r[iCat]||'Без категории').trim(),
    subcategory: (r[iSub]||'Без раздела').trim(),
    date: parseDate(r[iDate]),
    description: (r[iDesc]||'').trim(),
    link: (r[iLink]||'#').trim()
  }));

  // Сортировка внутри каждой папки: новые сверху
  items.sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));

  // Строим дерево: Категория → Субкатегория → Items[]
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

// ===== Рендер ===============================================================
function draw(){
  if(state.view === 'cats') return renderCats();
  if(state.view === 'subs') return renderSubs();
  return renderItems();
}

// Главная: папки категорий
function renderCats(){
  $('#view-cats').hidden = false;
  $('#view-subs').hidden = true;
  $('#view-items').hidden = true;

  const wrap = $('#view-cats');
  const cards = [];
  for(const [cat, subs] of state.tree.entries()){
    let count = 0; for(const arr of subs.values()) count += arr.length;
    cards.push(`
      <article class="folder" data-cat="${escapeAttr(cat)}">
        <div class="title">${escapeHtml(cat)}</div>
        <div class="meta">Подпапок: ${subs.size}</div>
        <span class="badge">${count} док.</span>
      </article>
    `);
  }
  wrap.innerHTML = cards.join('');
  wrap.onclick = e=>{
    const el = e.target.closest('.folder'); if(!el) return;
    state.cat = el.dataset.cat;
    state.sub = null;
    state.view = 'subs';
    toggleBack();
    renderSubs();
  };
}

// Внутри категории: папки субкатегорий
function renderSubs(){
  $('#view-cats').hidden = true;
  $('#view-subs').hidden = false;
  $('#view-items').hidden = true;

  const wrap = $('#view-subs');
  const subs = state.tree.get(state.cat) || new Map();
  const cards = [];
  for(const [sub, arr] of subs.entries()){
    cards.push(`
      <article class="folder" data-sub="${escapeAttr(sub)}">
        <div class="title">${escapeHtml(sub)}</div>
        <div class="meta">${escapeHtml(state.cat)}</div>
        <span class="badge">${arr.length} док.</span>
      </article>
    `);
  }
  wrap.innerHTML = cards.join('');
  wrap.onclick = e=>{
    const el = e.target.closest('.folder'); if(!el) return;
    state.sub = el.dataset.sub;
    state.view = 'items';
    toggleBack();
    renderItems();
  };
}

// Внутри субкатегории: документы
function renderItems(){
  $('#view-cats').hidden = true;
  $('#view-subs').hidden = true;
  $('#view-items').hidden = false;

  const wrap = $('#view-items');
  const subs = state.tree.get(state.cat) || new Map();
  const list = (subs.get(state.sub) || []).slice(); // уже отсортировано

  wrap.innerHTML = list.map(it => `
    <article class="card">
      <div class="kicker">${escapeHtml(state.cat)} · ${escapeHtml(state.sub)} · ${fmtDate(it.date)}</div>
      <div class="title">${escapeHtml(it.title)}</div>
      <div class="desc">${escapeHtml(it.description||'')}</div>
      <div class="actions">
        <a href="${encodeURI(it.link)}" target="_blank" rel="noopener">Открыть</a>
      </div>
    </article>
  `).join('');
}

// ===== Навигация: Назад / Домой ============================================
function bindNav(){
  $('#backBtn').onclick = ()=>{
    if(state.view === 'items'){ state.view = 'subs'; }
    else if(state.view === 'subs'){ state.view = 'cats'; state.cat=null; }
    toggleBack();
    draw();
  };
  $('#brandHome').onclick = (e)=>{
    e.preventDefault();
    state.view = 'cats'; state.cat=null; state.sub=null;
    toggleBack();
    draw();
  };
}
function toggleBack(){
  const show = !(state.view === 'cats');
  $('#backBtn').hidden = !show;
}

// ===== Пароль ===============================================================
function bindGate(){
  $('#enterBtn').onclick = ()=>{
    const ok = ($('#pwd').value||'').trim() === PORTAL_PASSWORD;
    if(ok){ $('#gate').style.display='none'; }
    else { $('#gateErr').textContent = 'Неверный пароль'; }
  };
  $('#pwd').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#enterBtn').click(); });
}

// ===== Безопасный текст =====================================================
function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function escapeAttr(s){ return escapeHtml(s).replaceAll('"','&quot;'); }

// ===== Инициализация ========================================================
document.addEventListener('DOMContentLoaded', async ()=>{
  bindGate();
  bindNav();
  try{
    await loadFromSheet();
    state.view = 'cats';
    toggleBack();
    draw();
  }catch(err){
    console.error(err);
    $('#view-cats').innerHTML = '';
  }
});
