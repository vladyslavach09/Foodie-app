'use strict';
const KEY = 'kbzhu-data-v1';
const MEALS = [['breakfast','Сніданок'],['lunch','Обід'],['dinner','Вечеря'],['snack','Перекуси']];
const $ = s => document.querySelector(s);

let data = load();
let tab = 'today';
let date = fmt(new Date());
let draft = {meal: null, product: null};
let editingId = null;
let fromAdd = false;

function load(){
  try{
    const d = JSON.parse(localStorage.getItem(KEY));
    if(d && d.products && d.log && d.goals) return d;
  }catch(e){}
  return {products: [], log: [], goals: {kcal: 2000, protein: 100, fat: 70, carbs: 250}};
}
function save(){ localStorage.setItem(KEY, JSON.stringify(data)); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function fmt(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function shiftDate(n){
  const [y,m,d] = date.split('-').map(Number);
  date = fmt(new Date(y, m-1, d+n));
}
function dateLabel(){
  if(date === fmt(new Date())) return 'Сьогодні';
  const [y,m,d] = date.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('uk-UA', {weekday:'short', day:'numeric', month:'long'});
}
function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function num(v){
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) || n < 0 ? 0 : n;
}
const r0 = n => Math.round(n);
const r1 = n => Math.round(n*10)/10;

function macros(e){
  const k = e.grams / 100;
  return {kcal: e.kcal100*k, p: e.p100*k, f: e.f100*k, c: e.c100*k};
}
function totals(list){
  return list.reduce((t,e) => {
    const m = macros(e);
    t.kcal += m.kcal; t.p += m.p; t.f += m.f; t.c += m.c;
    return t;
  }, {kcal:0, p:0, f:0, c:0});
}

/* ---------- Екрани ---------- */
function render(){
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.id === tab));
  const main = $('#main');
  if(tab === 'today') main.innerHTML = viewToday();
  else if(tab === 'products') main.innerHTML = viewProducts();
  else main.innerHTML = viewSettings();
}

function bar(label, val, goal, unit){
  const pct = goal > 0 ? Math.min(100, val/goal*100) : 0;
  const over = goal > 0 && val > goal;
  return `<div class="bar"><div class="barhead"><span>${label}</span><span>${r1(val)} / ${r1(goal)} ${unit}</span></div><div class="track"><div class="fill ${over?'over':''}" style="width:${pct}%"></div></div></div>`;
}

function viewToday(){
  const day = data.log.filter(e => e.date === date);
  const t = totals(day), g = data.goals;
  const left = g.kcal - t.kcal;
  let h = `<div class="datenav"><button data-a="prev">‹</button><strong>${dateLabel()}</strong><button data-a="next">›</button></div>`;
  h += `<section class="card"><div class="big">${r0(t.kcal)}<small> / ${r0(g.kcal)} ккал</small></div>`;
  h += `<div class="muted">${left >= 0 ? 'Залишилось '+r0(left)+' ккал' : 'Перебір '+r0(-left)+' ккал'}</div>`;
  h += bar('Білки', t.p, g.protein, 'г') + bar('Жири', t.f, g.fat, 'г') + bar('Вуглеводи', t.c, g.carbs, 'г');
  h += `</section>`;
  MEALS.forEach(([key, name]) => {
    const items = day.filter(e => e.meal === key);
    const mt = totals(items);
    h += `<section class="card"><div class="mealhead"><strong>${name}</strong><span class="muted">${r0(mt.kcal)} ккал</span></div>`;
    items.forEach(e => {
      const m = macros(e);
      h += `<div class="row"><div><div>${esc(e.name)}</div><div class="muted">${r1(e.grams)} г · Б ${r1(m.p)} Ж ${r1(m.f)} В ${r1(m.c)}</div></div><div class="rowright">${r0(m.kcal)}<button class="x" data-a="delEntry" data-id="${e.id}">✕</button></div></div>`;
    });
    h += `<button class="add" data-a="addFood" data-id="${key}">+ Додати</button></section>`;
  });
  return h;
}

function productList(q, action){
  const s = q.trim().toLowerCase();
  const list = data.products
    .filter(p => p.name.toLowerCase().includes(s))
    .sort((a,b) => a.name.localeCompare(b.name, 'uk'));
  if(!list.length) return `<p class="muted">${data.products.length ? 'Нічого не знайдено.' : 'Список порожній. Додай перший продукт.'}</p>`;
  return list.map(p => `<button class="item" data-a="${action}" data-id="${p.id}"><span>${esc(p.name)}</span><span class="muted">${r0(p.kcal100)} ккал · Б ${r1(p.p100)} Ж ${r1(p.f100)} В ${r1(p.c100)} (на 100 г)</span></button>`).join('');
}

function viewProducts(){
  return `<h1>Продукти</h1><input id="pq" class="input" placeholder="Пошук" autocomplete="off"><div id="plist">${productList('', 'editProduct')}</div><button class="primary" data-a="newProduct">+ Новий продукт</button>`;
}

function viewSettings(){
  const g = data.goals;
  return `<h1>Налаштування</h1>
  <section class="card"><h3>Денна ціль</h3>
    <label>Ккал<input id="g_kcal" class="input" inputmode="decimal" value="${g.kcal}"></label>
    <label>Білки, г<input id="g_p" class="input" inputmode="decimal" value="${g.protein}"></label>
    <label>Жири, г<input id="g_f" class="input" inputmode="decimal" value="${g.fat}"></label>
    <label>Вуглеводи, г<input id="g_c" class="input" inputmode="decimal" value="${g.carbs}"></label>
    <button class="primary" data-a="saveGoals">Зберегти ціль</button>
  </section>
  <section class="card"><h3>Резервна копія</h3>
    <p class="muted">Дані зберігаються лише на цьому телефоні. Раз на тиждень зберігай копію у «Файли».</p>
    <button class="primary" data-a="export">Експорт у файл</button>
    <button class="ghost" data-a="import">Імпорт з файлу</button>
    <input type="file" id="file" accept=".json,application/json" hidden>
  </section>`;
}

/* ---------- Нижнє вікно ---------- */
function openSheet(html){
  const s = $('#sheet');
  s.innerHTML = `<div class="sheetbox">${html}</div>`;
  s.hidden = false;
}
function closeSheet(){
  const s = $('#sheet');
  s.hidden = true;
  s.innerHTML = '';
}

function openAdd(meal){
  draft = {meal, product: null};
  const name = MEALS.find(m => m[0] === meal)[1];
  openSheet(`<h2>${name}</h2>
    <input id="aq" class="input" placeholder="Пошук продукту" autocomplete="off">
    <div id="alist">${productList('', 'pick')}</div>
    <button class="primary" data-a="newProduct" data-id="fromAdd">+ Новий продукт</button>
    <button class="ghost" data-a="close">Скасувати</button>`);
}

function pickProduct(id){
  const p = data.products.find(x => x.id === id);
  if(!p) return;
  draft.product = p;
  openSheet(`<h2>${esc(p.name)}</h2>
    <div class="muted">На 100 г: ${r0(p.kcal100)} ккал · Б ${r1(p.p100)} Ж ${r1(p.f100)} В ${r1(p.c100)}</div>
    <label>Грами<input id="grams" class="input" inputmode="decimal" value="100"></label>
    <div id="preview" class="card"></div>
    <button class="primary" data-a="confirmAdd">Додати</button>
    <button class="ghost" data-a="back">Назад</button>`);
  updatePreview();
  const gi = $('#grams'); gi.focus(); gi.select();
}

function updatePreview(){
  const p = draft.product;
  const g = num($('#grams').value);
  const m = macros({grams: g, kcal100: p.kcal100, p100: p.p100, f100: p.f100, c100: p.c100});
  $('#preview').innerHTML = `<strong>${r0(m.kcal)} ккал</strong><div class="muted">Б ${r1(m.p)} · Ж ${r1(m.f)} · В ${r1(m.c)}</div>`;
}

function openProductForm(id, returnToAdd){
  editingId = id || null;
  fromAdd = !!returnToAdd;
  const p = id ? data.products.find(x => x.id === id) : {name:'', kcal100:'', p100:'', f100:'', c100:''};
  openSheet(`<h2>${id ? 'Редагувати продукт' : 'Новий продукт'}</h2>
    <p class="muted">Усі значення на 100 г</p>
    <label>Назва<input id="f_name" class="input" value="${esc(p.name)}"></label>
    <label>Ккал<input id="f_kcal" class="input" inputmode="decimal" value="${p.kcal100}"></label>
    <label>Білки, г<input id="f_p" class="input" inputmode="decimal" value="${p.p100}"></label>
    <label>Жири, г<input id="f_f" class="input" inputmode="decimal" value="${p.f100}"></label>
    <label>Вуглеводи, г<input id="f_c" class="input" inputmode="decimal" value="${p.c100}"></label>
    <button class="primary" data-a="saveProduct">Зберегти</button>
    ${id ? '<button class="danger" data-a="delProduct">Видалити</button>' : ''}
    <button class="ghost" data-a="close">Скасувати</button>`);
}

function saveProduct(){
  const name = $('#f_name').value.trim();
  if(!name){ alert('Введи назву'); return; }
  const obj = {
    name,
    kcal100: num($('#f_kcal').value),
    p100: num($('#f_p').value),
    f100: num($('#f_f').value),
    c100: num($('#f_c').value)
  };
  if(editingId){
    Object.assign(data.products.find(x => x.id === editingId), obj);
  }else{
    data.products.push(Object.assign({id: uid()}, obj));
  }
  save();
  if(fromAdd){ openAdd(draft.meal); }
  else{ closeSheet(); render(); }
}

/* ---------- Резервна копія ---------- */
async function exportData(){
  const json = JSON.stringify(data, null, 2);
  const name = 'kbzhu-' + fmt(new Date()) + '.json';
  const file = new File([json], name, {type: 'application/json'});
  if(navigator.canShare && navigator.canShare({files: [file]})){
    try{ await navigator.share({files: [file]}); return; }
    catch(e){ if(e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
}

/* ---------- Дії ---------- */
const actions = {
  tab: id => { tab = id; render(); window.scrollTo(0,0); },
  prev: () => { shiftDate(-1); render(); },
  next: () => { shiftDate(1); render(); },
  addFood: id => openAdd(id),
  pick: id => pickProduct(id),
  back: () => openAdd(draft.meal),
  confirmAdd: () => {
    const g = num($('#grams').value);
    if(g <= 0){ alert('Введи кількість грамів'); return; }
    const p = draft.product;
    data.log.push({id: uid(), date, meal: draft.meal, name: p.name, grams: g,
      kcal100: p.kcal100, p100: p.p100, f100: p.f100, c100: p.c100});
    save(); closeSheet(); render();
  },
  delEntry: id => {
    if(confirm('Видалити запис?')){
      data.log = data.log.filter(e => e.id !== id);
      save(); render();
    }
  },
  newProduct: id => openProductForm(null, id === 'fromAdd'),
  editProduct: id => openProductForm(id, false),
  saveProduct: () => saveProduct(),
  delProduct: () => {
    if(confirm('Видалити продукт? Старі записи в щоденнику залишаться.')){
      data.products = data.products.filter(p => p.id !== editingId);
      save(); closeSheet(); render();
    }
  },
  close: () => closeSheet(),
  saveGoals: () => {
    data.goals = {
      kcal: num($('#g_kcal').value),
      protein: num($('#g_p').value),
      fat: num($('#g_f').value),
      carbs: num($('#g_c').value)
    };
    save(); alert('Збережено');
  },
  export: () => exportData(),
  import: () => $('#file').click()
};

document.addEventListener('click', e => {
  if(e.target.id === 'sheet'){ closeSheet(); return; }
  const el = e.target.closest('[data-a]');
  if(!el) return;
  const fn = actions[el.dataset.a];
  if(fn) fn(el.dataset.id, el);
});

document.addEventListener('input', e => {
  const id = e.target.id;
  if(id === 'pq') $('#plist').innerHTML = productList(e.target.value, 'editProduct');
  else if(id === 'aq') $('#alist').innerHTML = productList(e.target.value, 'pick');
  else if(id === 'grams') updatePreview();
});

document.addEventListener('change', e => {
  if(e.target.id !== 'file') return;
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      if(!d.products || !d.log || !d.goals) throw new Error('bad');
      if(confirm('Замінити поточні дані даними з файлу?')){
        data = d; save(); render(); alert('Готово');
      }
    }catch(err){ alert('Цей файл не підходить'); }
  };
  r.readAsText(f);
});

if(navigator.storage && navigator.storage.persist) navigator.storage.persist();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();