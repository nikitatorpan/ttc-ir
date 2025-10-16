// ===== Конфигурация =========================================================
const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
const API_KEY  = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
const RANGE    = 'Лист1!A:G'; // Категория | Субкатегория | Название | Дата | Описание | Ссылка | Логотип
const PORTAL_PASSWORD = 'Blacktech';

// ===== Утилиты ==============================================================
const $ = s => document.querySelector(s);
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
  items: [],           // все документы
  categories: [],      // уникальные категории (для чипов)
  activeCat: 'all',    // выбранная категория
  activeSub: null,     // выбранная подкатегория
  search: '',
  view: 'items'        // 'items' | 'subs'
};

// ===== Загрузка данных ======================================================
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
  items.sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));
  state.items = items;
  state.categories = ['all', ...new Set(items.map(i => i.category))];
}

// ===== Категории (чипы) ====================================================
function renderCategories(){
  const box = $('#categories');
  box.innerHTML = state.categories.map(cat => `
    <button data-cat="${cat}" class="${state.activeCat===cat ? 'active':''}">
      ${cat==='all' ? 'Все' : cat}
    </button>
  `).join('');

  box.onclick = (e)=>{
    const btn = e.target.closest('button[data-cat]');
    if(!btn) return;
    state.activeCat = btn.dataset.cat;
    state.activeSub = null;
    state.search = '';
    $('#search').value = '';
    if(state.activeCat === 'all') {
      state.view = 'items';
      renderItems();
      toggleViews();
      toggleBack();
    } else {
      state.view = 'subs';
      renderSubcategories();
      toggleViews();
      toggleBack();
    }
    renderCategories(); // подсветка активной
  };
}

// ===== Показ/скрытие секций =================================================
function toggleViews(){
  const subs = $('#view-subcategories');
  const items = $('#view-items');
  if(state.view === 'subs'){ subs.hidden = false; items.hidden = true; }
  else { subs.hidden = true; items.hidden = false; }
}
function toggleBack(){
  $('#backBtn').hidden = (state.activeCat === 'all' && state.view === 'items');
}

// ===== Рендер субкатегорий (папок) =========================================
function renderSubcategories(){
  const wrap = $('#view-subcategories');
  if(state.activeCat === 'all'){ wrap.innerHTML=''; return; }

  // собрать подкатегории внутри выбранной категории
  const subs = new Map(); // Map<subcat, count>
  for(const it of state.items){
    if(it.category !== state.activeCat) continue;
    const key = it.subcategory || 'Без раздела';
    subs.set(key, (subs.get(key)||0)+1);
  }

  // папки
  wrap.innerHTML = [...subs.entries()].map(([sub, count]) => `
    <article class="folder" data-sub="${sub}">
      <div class="title">${sub}</div>
      <div class="meta">${state.activeCat}</div>
      <span class="badge">${count} док.</span>
    </article>
  `).join('');

  // клик по папке → показываем документы этой подкатегории
  wrap.onclick = (e)=>{
    const el = e.target.closest('.folder'); if(!el) return;
    state.activeSub = el.dataset.sub;
    state.view = 'items';
    renderItems();
    toggleViews();
    toggleBack();
  };
}

// ===== Рендер документов ====================================================
function renderItems(){
  const wrap = $('#view-items');
  const q = state.search.toLowerCase();
  let list = state.items;

  if(state.activeCat !== 'all'){
    list = list.filter(x => x.category === state.activeCat);
  }
  if(state.activeSub){
    list = list.filter(x => (x.subcategory || 'Без раздела') === state.activeSub);
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
    // при поиске всегда показываем документы текущего скоупа
    state.view = 'items';
    renderItems();
    toggleViews();
    toggleBack();
  });
}

// ===== Back / Home ==========================================================
function bindBack(){
  $('#backBtn').onclick = ()=> {
    if(state.view === 'items' && state.activeSub){       // из документов в подкатегории → назад к папкам
      state.activeSub = null;
      state.view = 'subs';
      renderSubcategories();
      toggleViews(); toggleBack();
      return;
    }
    if(state.activeCat !== 'all'){                       // из папок → на главную
      state.activeCat = 'all';
      state.activeSub = null;
      state.view = 'items';
      renderItems(); renderCategories();
      toggleViews(); toggleBack();
    }
  };

  $('#brandHome').onclick = (e)=>{
    e.preventDefault();
    state.activeCat = 'all';
    state.activeSub = null;
    state.search = '';
    $('#search').value = '';
    state.view = 'items';
    renderItems(); renderCategories();
    toggleViews(); toggleBack();
  };
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

// ===== Запуск ===============================================================
document.addEventListener('DOMContentLoaded', async ()=>{
  bindGate();
  bindSearch();
  bindBack();
  try{
    await loadFromSheet();
    renderCategories();            // чипы
    renderItems();                 // стартовый список (Все)
    toggleViews();                 // документы видимы, папки скрыты
    toggleBack();                  // «Назад» скрыта на главной
  }catch(err){
    console.error(err);
    $('#view-items').innerHTML = '';
    $('#view-subcategories').innerHTML = '';
  }
});
