// === Конфигурация
const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
const API_KEY  = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
const RANGE    = 'Лист1!A:G'; // B Название | C Категория | D Субкатегория | E Дата | F Пояснение | G Ссылка
const PORTAL_PASSWORD = 'Blacktech';

// === Утилиты
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
const escapeHtml = s => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#39;');

// === Состояние
const state = {
  tree: new Map(), // Map<Category, Map<Subcat, Item[]>>
  view: 'cats',    // 'cats' | 'subs' | 'items'
  cat: null,
  sub: null
};

// === Данные
async function loadFromSheet(){
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Sheets API: ${r.status}`);
  const j = await r.json();
  const rows = j.values || [];
  const header = rows[0] || [];

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

  // сортировка новые → старые
  items.sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));

  // строим дерево
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

// === Рендер уровней
function showOnly(section){
  // ЖЁСТКО скрываем другие уровни (как вы просили)
  $('#view-cats').hidden  = section !== 'cats';
  $('#view-subs').hidden  = section !== 'subs';
  $('#view-items').hidden = section !== 'items';

  // Дополнительно очищаем содержимое неактивных секций,
  // чтобы визуально ничего «не оставалось» от предыдущего уровня
  if(section !== 'cats')  $('#view-cats').innerHTML = '';
  if(section !== 'subs')  $('#view-subs').innerHTML = '';
  if(section !== 'items') $('#view-items').innerHTML = '';
}

function renderCats(){
  const wrap = $('#view-cats');
  wrap.innerHTML = [...state.tree.entries()].map(([cat, subs])=>{
    let count = 0; for(const arr of subs.values()) count += arr.length;
    return `
      <article class="folder" data-cat="${escapeHtml(cat)}">
        <div class="title">${escapeHtml(cat)}</div>
        <div class="meta">Подпапок: ${subs.size}</div>
        <span class="badge">${count} док.</span>
      </article>
    `;
  }).join('');

  wrap.onclick = e=>{
    const el = e.target.closest('.folder'); if(!el) return;
    state.cat = el.dataset.cat; state.sub = null; state.view = 'subs';
    renderSubs();
  };

  showOnly('cats'); toggleBack();
}

function renderSubs(){
  const subs = state.tree.get(state.cat) || new Map();
  const wrap = $('#view-subs');
  wrap.innerHTML = [...subs.entries()].map(([sub, arr])=>`
    <article class="folder" data-sub="${escapeHtml(sub)}">
      <div class="title">${escapeHtml(sub)}</div>
      <div class="meta">${escapeHtml(state.cat)}</div>
      <span class="badge">${arr.length} док.</span>
    </article>
  `).join('');

  wrap.onclick = e=>{
    const el = e.target.closest('.folder'); if(!el) return;
    state.sub = el.dataset.sub; state.view = 'items';
    renderItems();
  };

  showOnly('subs'); toggleBack();
}

function renderItems(){
  const subs = state.tree.get(state.cat) || new Map();
  const arr = (subs.get(state.sub) || []).slice();
  const wrap = $('#view-items');
  wrap.innerHTML = arr.map(it=>`
    <article class="card">
      <div class="kicker">${escapeHtml(state.cat)} · ${escapeHtml(state.sub)} · ${fmtDate(it.date)}</div>
      <div class="title">${escapeHtml(it.title)}</div>
      <div class="desc">${escapeHtml(it.description||'')}</div>
      <div class="actions">
        <a href="${encodeURI(it.link)}" target="_blank" rel="noopener">Открыть</a>
      </div>
    </article>
  `).join('');

  showOnly('items'); toggleBack();
}

// === Навигация
function toggleBack(){
  $('#backBtn').hidden = (state.view === 'cats');
}

function bindNav(){
  $('#backBtn').onclick = ()=>{
    if(state.view === 'items'){ state.view = 'subs'; renderSubs(); return; }
    if(state.view === 'subs'){ state.view = 'cats'; state.cat=null; renderCats(); return; }
  };
  $('#brandHome').onclick = (e)=>{
    e.preventDefault();
    state.view = 'cats'; state.cat=null; state.sub=null; renderCats();
  };
}

// === Пароль
function bindGate(){
  $('#enterBtn').onclick = ()=>{
    const ok = ($('#pwd').value||'').trim() === PORTAL_PASSWORD;
    if(ok){ $('#gate').style.display='none'; }
    else { $('#gateErr').textContent = 'Неверный пароль'; }
  };
  $('#pwd').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#enterBtn').click(); });
}

// === Запуск
document.addEventListener('DOMContentLoaded', async ()=>{
  bindGate(); bindNav();
  try{
    await loadFromSheet();
    renderCats(); // старт с главной
  }catch(err){
    console.error(err);
    $('#view-cats').innerHTML = '';
    showOnly('cats'); toggleBack();
  }
});
