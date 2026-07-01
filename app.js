import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ================================================================
   FIREBASE INIT
================================================================ */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginScreen = document.getElementById('loginScreen');
const loginBtn = document.getElementById('googleSignInBtn');
const loginError = document.getElementById('loginError');
const loginSpinner = document.getElementById('loginSpinner');
const appRoot = document.getElementById('appRoot');
const syncStatus = document.getElementById('syncStatus');
const userCard = document.getElementById('userCard');
const signoutBtn = document.getElementById('signoutBtn');

let currentUser = null;
let dataLoaded = false;

loginBtn.addEventListener('click', async () => {
  loginError.textContent = '';
  loginSpinner.style.display = 'inline-block';
  loginBtn.style.display = 'none';
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    loginError.textContent = 'Sign-in failed: ' + (err.message || err.code || 'unknown error');
    loginSpinner.style.display = 'none';
    loginBtn.style.display = 'flex';
  }
});

signoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userCard.innerHTML = `
      <img src="${user.photoURL || ''}" referrerpolicy="no-referrer" onerror="this.style.display='none'">
      <div style="overflow:hidden;">
        <div class="uname">${user.displayName || 'User'}</div>
        <div class="uemail">${user.email || ''}</div>
      </div>`;
    loginScreen.style.display = 'none';
    appRoot.classList.add('ready');
    await loadUserData();
    initUI();
  } else {
    currentUser = null;
    dataLoaded = false;
    appRoot.classList.remove('ready');
    loginScreen.style.display = 'flex';
    loginSpinner.style.display = 'none';
    loginBtn.style.display = 'flex';
  }
});

/* ================================================================
   APP STATE (default values for a brand-new user)
================================================================ */
let state = {
  habits: [
    {emoji:"\u23F0", name:"Wake up at 6"},
    {emoji:"\uD83D\uDEBF", name:"Cold shower"},
    {emoji:"\uD83D\uDCA7", name:"Hydrate"},
    {emoji:"\uD83E\uDD38", name:"Stretching"},
    {emoji:"\uD83C\uDF4E", name:"Healthy Lunch"},
    {emoji:"\uD83D\uDCD6", name:"Study"},
    {emoji:"\uD83C\uDFCB\uFE0F", name:"Exercise"},
    {emoji:"\uD83D\uDCBC", name:"Work"},
  ],
  habitData: [
    [1,0,1,1,0,1,0,0],[1,1,0,1,1,1,0,0],[0,0,0,1,0,1,0,0],[0,0,0,1,1,0,0,0],
    [0,1,0,0,0,0,0,0],[1,0,1,1,0,0,0,0],[1,0,0,0,1,0,0,0],[0,1,1,1,0,0,0,0],
  ],
  habitGoal: 80,
  weekPlan: ['Back & Biceps','Chest & Triceps','Legs & Shoulders','Back & Biceps','Chest & Triceps','Legs & Shoulders','Rest'],
  workoutDays: [],
  dayIdCounter: 0,
  monthlyIncome: 0,
  budgetCategories: [
    {name:'Needs (Rent, Bills, Groceries)', pct:50, color:'#2383e2'},
    {name:'Wants (Lifestyle, Eating out)', pct:30, color:'#e8a83c'},
    {name:'Savings / Investments', pct:20, color:'#2f9e6f'},
  ],
  expenses: [],
  expenseIdCounter: 0,
};

/* ================================================================
   FIRESTORE LOAD / SAVE
   Firestore does not support nested arrays (array of arrays).
   habitData is [[1,0,...],[0,1,...]] so we serialize it to a plain
   object { "r0": "10110100", "r1": "11011100", ... } before saving
   and deserialize it back after loading.
================================================================ */
function serializeState(s) {
  const out = { ...s };
  // Convert habitData: array of arrays → object of strings
  const hd = {};
  (s.habitData || []).forEach((row, i) => { hd['r' + i] = row.join(''); });
  out.habitData = hd;
  return out;
}

function deserializeState(data) {
  const out = { ...data };
  // Convert habitData back: object of strings → array of arrays
  if (data.habitData && !Array.isArray(data.habitData)) {
    const keys = Object.keys(data.habitData).sort((a,b) => {
      return parseInt(a.slice(1)) - parseInt(b.slice(1));
    });
    out.habitData = keys.map(k => data.habitData[k].split('').map(Number));
  }
  return out;
}

async function loadUserData() {
  try {
    const ref = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = deserializeState(snap.data());
      state = { ...state, ...data };
    } else {
      await setDoc(ref, serializeState(state));
    }
    dataLoaded = true;
  } catch (err) {
    console.error('Failed to load data:', err);
    setSyncStatus('error', 'Failed to load data');
  }
}

let saveTimer = null;
function scheduleSave() {
  if (!currentUser || !dataLoaded) return;
  setSyncStatus('saving', 'Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const ref = doc(db, 'users', currentUser.uid);
      await setDoc(ref, serializeState(state));
      setSyncStatus('ok', 'Saved');
    } catch (err) {
      console.error('Save failed:', err);
      setSyncStatus('error', 'Save failed');
    }
  }, 600);
}

function setSyncStatus(kind, label) {
  syncStatus.className = kind === 'saving' ? 'saving' : (kind === 'error' ? 'error' : '');
  syncStatus.innerHTML = `<span class="dot"></span>${label}`;
}

/* ================================================================
   UI INIT — called once per login (and re-renders all pages)
================================================================ */
function initUI() {
  setupNavigation();
  renderHabits();
  renderProgress();
  renderWeekGrid();
  renderDays();
  renderAllExpensePage();
}

/* ================================================================
   NAVIGATION
================================================================ */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const crumbs = document.getElementById('crumbs');
  const crumbMap = {
    habits: '<span>&#128293; My Habit Tracker</span><span class="sep">/</span><span>This month</span>',
    exercise: '<span>&#128170; Exercise Planner</span><span class="sep">/</span><span class="dim">Weekly Split</span>',
    expenses: '<span>&#128176; Expense Tracker</span><span class="sep">/</span><span class="dim">This Month</span>',
  };
  navItems.forEach(item=>{
    item.onclick = () => {
      navItems.forEach(n=>n.classList.remove('active'));
      item.classList.add('active');
      const target = item.dataset.page;
      pages.forEach(p=>p.classList.remove('active'));
      document.getElementById('page-'+target).classList.add('active');
      crumbs.innerHTML = crumbMap[target];
    };
  });
}

/* ================================================================
   PAGE 1 — HABIT TRACKER
================================================================ */
function renderHabits() {
  const habitTbody = document.querySelector('#habitTable tbody');
  habitTbody.innerHTML = '';
  state.habits.forEach((h, rowIdx)=>{
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.className = 'habit-cell';
    nameTd.innerHTML = `<div class="habit-name"><span>${h.emoji}</span><span contenteditable="true" class="habit-name-text">${h.name}</span></div>`;
    nameTd.querySelector('.habit-name-text').addEventListener('blur', (e)=>{
      state.habits[rowIdx].name = e.target.textContent.trim() || h.name;
      scheduleSave();
    });
    tr.appendChild(nameTd);

    const openTd = document.createElement('td');
    openTd.className = 'open-cell'; openTd.textContent = '✕';
    openTd.title = 'Delete habit';
    openTd.addEventListener('click', ()=>{
      if(confirm(`Delete habit "${h.name}"?`)){
        state.habits.splice(rowIdx,1);
        state.habitData.splice(rowIdx,1);
        renderHabits(); renderProgress(); scheduleSave();
      }
    });
    tr.appendChild(openTd);

    if (!state.habitData[rowIdx]) state.habitData[rowIdx] = new Array(8).fill(0);
    state.habitData[rowIdx].forEach((val, colIdx)=>{
      const td = document.createElement('td'); td.className='check-cell';
      const box = document.createElement('span'); box.className='checkbox'+(val?' checked':'');
      td.appendChild(box);
      td.addEventListener('click', ()=>{
        const checked = box.classList.toggle('checked');
        state.habitData[rowIdx][colIdx] = checked ? 1 : 0;
        renderProgress();
        scheduleSave();
      });
      tr.appendChild(td);
    });
    habitTbody.appendChild(tr);
  });
}

document.getElementById('addHabitRow').addEventListener('click', ()=>{
  const name = prompt('New habit name:', 'New habit');
  if(name && name.trim()){
    state.habits.push({emoji:'\u2B50', name:name.trim()});
    state.habitData.push(new Array(8).fill(0));
    renderHabits(); renderProgress(); scheduleSave();
  }
});

function renderProgress() {
  const totalCells = state.habitData.reduce((s,row)=>s+row.length,0);
  const checkedCells = state.habitData.reduce((s,row)=>s+row.reduce((a,b)=>a+b,0),0);
  const pct = totalCells ? Math.round((checkedCells/totalCells)*100) : 0;
  document.getElementById('progressPct').textContent = pct + '%';
  document.getElementById('goalText').textContent = `Goal : ${state.habitGoal} %`;

  const circumference = 2 * Math.PI * 68;
  const dash = (pct/100) * circumference;
  const arc = document.getElementById('progressArc');
  arc.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
  document.getElementById('donutCallout').textContent = `${pct}% (${pct}%)`;
}

document.getElementById('editGoalBtn').addEventListener('click', ()=>{
  const g = prompt('Set your monthly goal %:', state.habitGoal);
  const n = parseFloat(g);
  if(!isNaN(n)){ state.habitGoal = Math.max(0, Math.min(100, n)); renderProgress(); scheduleSave(); }
});

/* ================================================================
   PAGE 2 — EXERCISE PLANNER
================================================================ */
const dowList = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const splitOptions = ['Rest','Back & Biceps','Chest & Triceps','Legs & Shoulders'];

function renderWeekGrid() {
  const weekGrid = document.getElementById('weekGrid');
  weekGrid.innerHTML = '';
  dowList.forEach((d,i)=>{
    const cell = document.createElement('div');
    cell.className = 'week-cell';
    const sel = document.createElement('select');
    splitOptions.forEach(opt=>{
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if(opt === state.weekPlan[i]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', ()=>{ state.weekPlan[i] = sel.value; scheduleSave(); });
    cell.innerHTML = `<div class="dow">${d}</div>`;
    cell.appendChild(sel);
    weekGrid.appendChild(cell);
  });
}

const dayCardsWrap = document.getElementById('dayCards');

function renderDays() {
  dayCardsWrap.innerHTML = '';
  state.workoutDays.forEach(day=>{
    const card = document.createElement('div');
    card.className = 'day-card';

    const header = document.createElement('div');
    header.className = 'day-card-header';
    header.innerHTML = `
      <div class="day-title">&#128170; <span class="day-title-text">${day.title}</span> <span class="tag">${day.exercises.length} exercises</span></div>
      <div class="day-card-actions">
        <button class="btn secondary small rename-btn">Rename</button>
        <button class="btn danger small delete-day-btn">Delete</button>
      </div>`;
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'day-card-body';

    const table = document.createElement('table');
    table.className = 'ex-table';
    table.innerHTML = `
      <thead><tr>
        <th class="col-name">Exercise</th>
        <th class="col-sets">Sets</th>
        <th class="col-reps">Reps</th>
        <th class="col-weight">Weight</th>
        <th class="col-notes">Notes</th>
        <th class="col-action"></th>
      </tr></thead>
      <tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    day.exercises.forEach((ex, exIdx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" value="${ex.name}" data-field="name"></td>
        <td><input type="text" value="${ex.sets}" data-field="sets"></td>
        <td><input type="text" value="${ex.reps}" data-field="reps"></td>
        <td><input type="text" value="${ex.weight}" data-field="weight"></td>
        <td><input type="text" value="${ex.notes}" data-field="notes"></td>
        <td class="check-cell"><button class="btn danger small del-ex-btn">✕</button></td>`;
      tr.querySelectorAll('input').forEach(inp=>{
        inp.addEventListener('input', ()=>{ ex[inp.dataset.field] = inp.value; scheduleSave(); });
      });
      tr.querySelector('.del-ex-btn').addEventListener('click', ()=>{
        day.exercises.splice(exIdx,1);
        renderDays(); scheduleSave();
      });
      tbody.appendChild(tr);
    });

    body.appendChild(table);

    const addRow = document.createElement('div');
    addRow.className = 'add-exercise-row';
    addRow.innerHTML = `<button class="btn secondary small add-ex-btn">+ Add exercise</button>`;
    addRow.querySelector('.add-ex-btn').addEventListener('click', ()=>{
      day.exercises.push({name:'', sets:'', reps:'', weight:'', notes:''});
      renderDays(); scheduleSave();
    });
    body.appendChild(addRow);

    card.appendChild(body);

    header.querySelector('.rename-btn').addEventListener('click', ()=>{
      const newName = prompt('Rename workout day:', day.title);
      if(newName && newName.trim()){ day.title = newName.trim(); renderDays(); scheduleSave(); }
    });
    header.querySelector('.delete-day-btn').addEventListener('click', ()=>{
      if(confirm(`Delete "${day.title}"?`)){
        const idx = state.workoutDays.findIndex(d=>d.id===day.id);
        state.workoutDays.splice(idx,1);
        renderDays(); scheduleSave();
      }
    });

    dayCardsWrap.appendChild(card);
  });
}

document.getElementById('addDayBtn').addEventListener('click', ()=>{
  const name = prompt('Name this workout day (e.g. Back & Biceps, Leg Day):', 'New Day');
  if(name && name.trim()){
    state.workoutDays.push({id:state.dayIdCounter++, title:name.trim(), exercises:[{name:'', sets:'', reps:'', weight:'', notes:''}]});
    renderDays(); scheduleSave();
  }
});

/* ================================================================
   PAGE 3 — EXPENSE TRACKER
================================================================ */
const incomeInput = document.getElementById('incomeInput');
document.getElementById('setIncomeBtn').addEventListener('click', ()=>{
  state.monthlyIncome = parseFloat(incomeInput.value) || 0;
  renderAllExpensePage(); scheduleSave();
});

function fmt(n){
  return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
}

function spentByCategory(catName){
  return state.expenses.filter(e=>e.category===catName).reduce((s,e)=>s+e.amount,0);
}

function renderBudgetTable(){
  const tbody = document.getElementById('budgetBody');
  tbody.innerHTML = '';
  let totalPct = 0;
  state.budgetCategories.forEach((cat, idx)=>{
    totalPct += Number(cat.pct)||0;
    const budgeted = state.monthlyIncome * (cat.pct/100);
    const spent = spentByCategory(cat.name);
    const remaining = budgeted - spent;
    const pctUsed = budgeted>0 ? Math.min(100,(spent/budgeted)*100) : 0;
    const over = spent > budgeted && budgeted>0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${cat.name}" data-idx="${idx}" data-field="name" style="width:100%;border:none;background:transparent;font-weight:500;"></td>
      <td><input type="number" class="pct-input" value="${cat.pct}" data-idx="${idx}" data-field="pct" min="0" max="100"> %</td>
      <td>${fmt(budgeted)}</td>
      <td>${fmt(spent)}</td>
      <td style="color:${remaining<0?'var(--red)':'var(--text)'}">
        ${fmt(remaining)}
        <div class="bar-track"><div class="bar-fill ${over?'over':''}" style="width:${pctUsed}%"></div></div>
      </td>
      <td><button class="btn danger small del-cat-btn" data-idx="${idx}">✕</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input[data-field="name"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{ state.budgetCategories[inp.dataset.idx].name = inp.value; populateCategorySelect(); scheduleSave(); });
  });
  tbody.querySelectorAll('input[data-field="pct"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{ state.budgetCategories[inp.dataset.idx].pct = parseFloat(inp.value)||0; renderAllExpensePage(); scheduleSave(); });
  });
  tbody.querySelectorAll('.del-cat-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{ state.budgetCategories.splice(btn.dataset.idx,1); renderAllExpensePage(); scheduleSave(); });
  });

  const note = document.getElementById('pctNote');
  note.textContent = `Total allocated: ${totalPct}% of income` + (totalPct>100 ? '  — exceeds 100%, adjust your percentages.' : (totalPct<100 ? `  — ${100-totalPct}% unallocated.` : '  — fully allocated.'));
  note.className = 'pct-total-note' + (totalPct>100 ? ' warn' : '');
}

document.getElementById('addBudgetCatBtn').addEventListener('click', ()=>{
  const name = prompt('New budget category name:', 'New Category');
  if(name && name.trim()){
    state.budgetCategories.push({name:name.trim(), pct:0, color:'#9b9a97'});
    renderAllExpensePage(); scheduleSave();
  }
});

function populateCategorySelect(){
  const sel = document.getElementById('expCategory');
  const current = sel.value;
  sel.innerHTML = '';
  state.budgetCategories.forEach(cat=>{
    const o = document.createElement('option');
    o.value = cat.name; o.textContent = cat.name;
    sel.appendChild(o);
  });
  if([...sel.options].some(o=>o.value===current)) sel.value = current;
}

function renderExpenseTable(){
  const tbody = document.getElementById('expenseBody');
  const emptyState = document.getElementById('expenseEmpty');
  tbody.innerHTML = '';
  if(state.expenses.length===0){
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    state.expenses.slice().reverse().forEach(exp=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${exp.date || '—'}</td>
        <td><span class="tag-pill" style="background:#eef3fb;color:var(--blue);">${exp.category}</span></td>
        <td>${exp.desc || ''}</td>
        <td class="amt">${fmt(exp.amount)}</td>
        <td class="check-cell"><button class="btn danger small del-exp-btn" data-id="${exp.id}">✕</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.del-exp-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = Number(btn.dataset.id);
        state.expenses = state.expenses.filter(e=>e.id!==id);
        renderAllExpensePage(); scheduleSave();
      });
    });
  }
}

document.getElementById('addExpenseBtn').addEventListener('click', ()=>{
  const date = document.getElementById('expDate').value;
  const category = document.getElementById('expCategory').value;
  const desc = document.getElementById('expDesc').value;
  const amount = parseFloat(document.getElementById('expAmount').value) || 0;
  if(!category || amount<=0){ alert('Please choose a category and enter an amount greater than 0.'); return; }
  state.expenses.push({id:state.expenseIdCounter++, date, category, desc, amount});
  document.getElementById('expDesc').value='';
  document.getElementById('expAmount').value='';
  renderAllExpensePage(); scheduleSave();
});

function renderSummary(){
  const totalSpent = state.expenses.reduce((s,e)=>s+e.amount,0);
  const savingsCat = state.budgetCategories.find(c=>/saving/i.test(c.name));
  const savingsAmt = savingsCat ? state.monthlyIncome*(savingsCat.pct/100) : 0;
  document.getElementById('statIncome').textContent = fmt(state.monthlyIncome);
  document.getElementById('statSpent').textContent = fmt(totalSpent);
  document.getElementById('statRemaining').textContent = fmt(state.monthlyIncome-totalSpent);
  document.getElementById('statSavings').textContent = fmt(savingsAmt);
  incomeInput.value = state.monthlyIncome || '';
}

function renderAllExpensePage(){
  renderBudgetTable();
  populateCategorySelect();
  renderExpenseTable();
  renderSummary();
}
