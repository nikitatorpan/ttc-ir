// ===== Конфигурация =========================================================
const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
const API_KEY  = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
const RANGE    = 'Лист1!A:G'; // Категория | Субкатегория | Название | Дата | Описание | Ссылка | Логотип
const PORTAL_PASSWORD = 'Blacktech';

// ===== Утилиты ==============================================================
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const parseDate = (str) => {
  if(!str) return null;
  const t = String(str).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(t) ? t
            : /^\d{2}\.\d{2}\.\d{4}$/.test(t) ? t.split('.').reverse().join('-')
            : t;
  const d = new Date(iso);
  return isNaN(+d) ? null : d;
}
const fmtDate = (d) => d ? d.toLocaleDateString('ru-RU') : '—';

// ===== Состояние ============================================================
const state = {
  items: [],
  activeCat: 'all',  // 'all' | <категория>
  search: ''
};

// ===== Данные из Google Sheets =============================================
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
    subcategory: (r[iSub]||'').trim(),
    title: (r[iTitle]||'Без названия').trim(),
    date: parseDate(r[iDate]),
    description: (r[iDesc]||'').trim(),
    link: (r[iLink]||'#').trim(),
    logo: (r[iLogo]||'').trim()
  }));

  // Сортировка: новые сверху
  items.sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));
  state.items = items;
}

// ===== Рендер фильтров (категории) =========================================
function renderCategories(){
  const box = $('#categories');
  const cats = ['all', ...new Set(state.items.map(i => i.category))];
  box.innerHTML = cats.map(cat => `
    <button data-cat="${cat}" class="${state.activeCat===cat ? 'active':''}">
      ${cat==='all' ? 'Все' : cat}
    </button>
  `).join('');

  // клик по категории
  box.onclick = (e)=>{
    const btn = e.target.closest('button[data-cat]');
    if(!btn) return;
    const cat = btn.dataset.cat;
    if(cat === state.activeCat) return;
    state.activeCat = cat;
    state.search = '';
    $('#search').value = '';
    pushRoute();
    renderCategories();
    renderItems();
    toggleBack();
  };
}

// ===== Рендер карточек ======================================================
function renderItems(){
  const wrap = $('#items');
  const q = state.search.toLowerCase();
  let list = state.items;

  if(state.activeCat !== 'all'){
    list = list.filter(x => x.category === state.activeCat);
  }
  if(q){
    list = list.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.description.toLowerCase().includes(q) ||
      x.category.toLowerCase().includes(q) ||
      x.subcategory.toLowerCase().includes(q)
    );
  }

  wrap.innerHTML = list.map(it => `
    <article class="card">
      <div class="kicker">${it.category}${it.subcategory?` · ${it.subcategory}`:''} · ${fmtDate(it.date)}</div>
      <div class="title">
        ${it.logo ? `<img class="logo" src="${it.logo}" alt="">` : ''}
        ${it.title}
      </div>
      <div class="desc">${it.description || ''}</div>
      <div class="actions">
        <a href="${it.link}" target="_blank" rel="noopener">Открыть</a>
      </div>
    </article>
  `).join('');
}

// ===== Поиск ================================================================
function bindSearch(){
  $('#search').addEventListener('input', (e)=>{
    state.search = e.target.value.trim();
    renderItems();
  });
}

// ===== Back / Home ==========================================================
function toggleBack(){
  const show = state.activeCat !== 'all';
  $('#backBtn').hidden = !show;
}
function bindBack(){
  $('#backBtn').onclick = ()=>{ goHome(); };
  $('#brandHome').onclick = (e)=>{ e.preventDefault(); goHome(); };
  window.addEventListener('popstate', ()=>{
    // читаем состояние из URL
    const params = new URLSearchParams(location.search);
    const cat = params.get('cat') || 'all';
    state.activeCat = cat;
    $('#search').value = state.search = '';
    renderCategories();
    renderItems();
    toggleBack();
  });
}
function pushRoute(){
  const params = new URLSearchParams(location.search);
  if(state.activeCat==='all') params.delete('cat'); else params.set('cat', state.activeCat);
  const url = `${location.pathname}?${params.toString()}`.replace(/\?$/,'');
  history.pushState({}, '', url);
}
function goHome(){
  state.activeCat = 'all';
  state.search = '';
  $('#search').value = '';
  pushRoute();
  renderCategories();
  renderItems();
  toggleBack();
}

// ===== Пароль ===============================================================
function bindGate(){
  $('#enterBtn').onclick = ()=>{
    const ok = ($('#pwd').value||'').trim() === PORTAL_PASSWORD;
    if(ok){ $('#gate').style.display='none'; }
    else { $('#gateErr').textContent = 'Неверный пароль'; }
  };
  $('#pwd').addEventListener('keydown', (e)=>{ if(e.key==='Enter') $('#enterBtn').click(); });
}

// ===== Инициализация ========================================================
document.addEventListener('DOMContentLoaded', async ()=>{
  bindGate();
  bindSearch();
  bindBack();
  try{
    await loadFromSheet();
    // начальная категория из URL (если есть)
    const params = new URLSearchParams(location.search);
    state.activeCat = params.get('cat') || 'all';
    renderCategories();
    renderItems();
    toggleBack();
  }catch(err){
    console.error(err);
    // Пустой рендер, чтобы не «падало»
    renderCategories();
    renderItems();
  }
});
