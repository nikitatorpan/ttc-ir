const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
const API_KEY  = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
const RANGE    = 'Лист1!A:G';
const PORTAL_PASSWORD = 'Blacktech';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const parseDate = (str) => { if(!str) return null; const t=String(str).trim(); const iso=/^\d{4}-\d{2}-\d{2}$/.test(t)?t:/^\d{2}\.\d{2}\.\d{4}$/.test(t)?t.split('.').reverse().join('-'):t; const d=new Date(iso); return isNaN(+d)?null:d; };
const fmtDate = d => d?d.toLocaleDateString('ru-RU'):'—';
const state = { items:[], activeCat:'all', search:'' };
async function loadFromSheet(){
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
  const res=await fetch(url);
  if(!res.ok) throw new Error('Sheets API '+res.status);
  const data=await res.json();
  const rows=data.values||[]; const header=rows[0]||[]; const idx=n=>header.indexOf(n);
  const iCat=idx('Категория'), iSub=idx('Субкатегория'), iTitle=idx('Название'), iDate=idx('Дата'), iDesc=idx('Описание'), iLink=idx('Ссылка'), iLogo=idx('Логотип');
  const items=rows.slice(1).map((r,id)=>({ id, category:(r[iCat]||'Без категории').trim(), subcategory:(r[iSub]||'').trim(), title:(r[iTitle]||'Без названия').trim(), date:parseDate(r[iDate]), description:(r[iDesc]||'').trim(), link:(r[iLink]||'#').trim(), logo:(r[iLogo]||'').trim() }));
  items.sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));
  state.items=items;
}
function renderCategories(){
  const box=$('#categories');
  const cats=['all',...new Set(state.items.map(i=>i.category))];
  box.innerHTML=cats.map(c=>`<button data-cat="${c}" class="${state.activeCat===c?'active':''}">${c==='all'?'Все':c}</button>`).join('');
  box.onclick=e=>{const b=e.target.closest('button[data-cat]'); if(!b) return; state.activeCat=b.dataset.cat; state.search=''; $('#search').value=''; pushRoute(); renderCategories(); renderItems(); toggleBack();};
}
function renderItems(){
  const wrap=$('#items');
  const q=state.search.toLowerCase();
  let list=state.items;
  if(state.activeCat!=='all') list=list.filter(x=>x.category===state.activeCat);
  if(q) list=list.filter(x=>[x.title,x.description,x.category,x.subcategory].some(v=>String(v).toLowerCase().includes(q)));
  wrap.innerHTML=list.map(it=>`<article class="card"><div class="kicker">${it.category}${it.subcategory?` · ${it.subcategory}`:''} · ${fmtDate(it.date)}</div><div class="title">${it.logo?`<img class=\"logo\" src=\"${it.logo}\" alt=\"\">`:''}${it.title}</div><div class="desc">${it.description||''}</div><div class="actions"><a href="${it.link}" target="_blank" rel="noopener">Открыть</a></div></article>`).join('');
}
function bindSearch(){ $('#search').addEventListener('input',e=>{ state.search=e.target.value.trim(); renderItems(); }); }
function toggleBack(){ $('#backBtn').hidden = (state.activeCat==='all'); }
function bindBack(){ $('#backBtn').onclick=()=>goHome(); $('#brandHome').onclick=e=>{e.preventDefault(); goHome();}; window.addEventListener('popstate',()=>{ const params=new URLSearchParams(location.search); state.activeCat=params.get('cat')||'all'; $('#search').value=state.search=''; renderCategories(); renderItems(); toggleBack(); }); }
function pushRoute(){ const params=new URLSearchParams(location.search); if(state.activeCat==='all') params.delete('cat'); else params.set('cat',state.activeCat); const url=`${location.pathname}?${params.toString()}`.replace(/\?$/,''); history.pushState({},'',url); }
function goHome(){ state.activeCat='all'; state.search=''; $('#search').value=''; pushRoute(); renderCategories(); renderItems(); toggleBack(); }
function bindGate(){ $('#enterBtn').onclick=()=>{ const ok=(($('#pwd').value)||'').trim()===PORTAL_PASSWORD; if(ok) $('#gate').style.display='none'; else $('#gateErr').textContent='Неверный пароль'; }; $('#pwd').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#enterBtn').click(); }); }

document.addEventListener('DOMContentLoaded',async()=>{ bindGate(); bindSearch(); bindBack(); try{ await loadFromSheet(); const params=new URLSearchParams(location.search); state.activeCat=params.get('cat')||'all'; renderCategories(); renderItems(); toggleBack(); }catch(err){ console.error(err); renderCategories(); renderItems(); } });
