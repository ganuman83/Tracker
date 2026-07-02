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
const db   = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginScreen  = document.getElementById('loginScreen');
const loginBtn     = document.getElementById('googleSignInBtn');
const loginError   = document.getElementById('loginError');
const loginSpinner = document.getElementById('loginSpinner');
const appRoot      = document.getElementById('appRoot');
const syncStatus   = document.getElementById('syncStatus');
const userCard     = document.getElementById('userCard');
const signoutBtn   = document.getElementById('signoutBtn');

let currentUser = null;
let dataLoaded  = false;

loginBtn.addEventListener('click', async () => {
  loginError.textContent = '';
  loginSpinner.style.display = 'inline-block';
  loginBtn.style.display = 'none';
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    loginError.textContent = 'Sign-in failed: ' + (err.message || err.code);
    loginSpinner.style.display = 'none';
    loginBtn.style.display = 'flex';
  }
});

signoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userCard.innerHTML = `
      <img src="${user.photoURL||''}" referrerpolicy="no-referrer" onerror="this.style.display='none'">
      <div style="overflow:hidden">
        <div class="uname">${user.displayName||'User'}</div>
        <div class="uemail">${user.email||''}</div>
      </div>`;
    loginScreen.style.display = 'none';
    appRoot.classList.add('ready');
    await loadUserData();
    initUI();
  } else {
    currentUser = null; dataLoaded = false;
    appRoot.classList.remove('ready');
    loginScreen.style.display = 'flex';
    loginSpinner.style.display = 'none';
    loginBtn.style.display = 'flex';
  }
});

/* ================================================================
   DATE HELPERS
================================================================ */
// Returns "YYYY-MM-DD" for a Date object
function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Returns a Date offset by `n` days from today
function offsetDate(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// Returns display label for a date: "Today", "Yesterday", "Jul 1", etc.
function dateLabel(d) {
  const today = dateStr(new Date());
  const ds    = dateStr(d);
  if (ds === today) return '<b>Today</b>';
  const yest = dateStr(offsetDate(-1));
  if (ds === yest)  return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

// Build the 10 date columns: 3 past + today + 6 future
function buildDateColumns() {
  const cols = [];
  for (let i = -3; i <= 6; i++) cols.push(offsetDate(i));
  return cols; // 10 dates
}

// All days in a given year-month, e.g. (2025, 6) → ["2025-07-01", ..., "2025-07-31"]
function daysInMonth(year, month) { // month: 0-indexed
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(dateStr(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/* ================================================================
   APP STATE  (defaults for new users)
================================================================ */
let state = {
  habits: [
    { emoji:'\u23F0', name:'Wake up at 6' },
    { emoji:'\uD83D\uDEBF', name:'Cold shower' },
    { emoji:'\uD83D\uDCA7', name:'Hydrate' },
    { emoji:'\uD83E\uDD38', name:'Stretching' },
    { emoji:'\uD83C\uDF4E', name:'Healthy Lunch' },
    { emoji:'\uD83D\uDCD6', name:'Study' },
    { emoji:'\uD83C\uDFCB\uFE0F', name:'Exercise' },
    { emoji:'\uD83D\uDCBC', name:'Work' },
  ],
  // habitChecks: flat object { "habitIdx_YYYY-MM-DD": 1 }
  // This avoids Firestore's nested-array limitation entirely
  habitChecks: {},
  habitGoal: 80,

  weekPlan: ['Back & Biceps','Chest & Triceps','Legs & Shoulders',
             'Back & Biceps','Chest & Triceps','Legs & Shoulders','Rest'],
  workoutDays:  [],
  dayIdCounter: 0,

  monthlyIncome: 0,
  budgetCategories: [
    { name:'Needs (Rent, Bills, Groceries)', pct:50, color:'#2383e2' },
    { name:'Wants (Lifestyle, Eating out)',  pct:30, color:'#e8a83c' },
    { name:'Savings / Investments',          pct:20, color:'#2f9e6f' },
  ],
  expenses:         [],
  expenseIdCounter: 0,
};

// Which month is the progress section showing (default = current)
let progressMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };

/* ================================================================
   FIRESTORE  (no nested arrays — habitChecks is already a flat obj)
================================================================ */
async function loadUserData() {
  try {
    const ref  = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      state = { ...state, ...snap.data() };
    } else {
      await setDoc(ref, state);
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
      await setDoc(doc(db, 'users', currentUser.uid), state);
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
   UI INIT
================================================================ */
function initUI() {
  setupNavigation();
  renderHabitPage();
  renderWeekGrid();
  renderDays();
  renderAllExpensePage();
}

/* ================================================================
   NAVIGATION
================================================================ */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages    = document.querySelectorAll('.page');
  const crumbs   = document.getElementById('crumbs');
  const crumbMap = {
    habits:   '<span>&#128293; My Habit Tracker</span>',
    exercise: '<span>&#128170; Exercise Planner</span>',
    expenses: '<span>&#128176; Expense Tracker</span>',
  };
  navItems.forEach(item => {
    item.onclick = () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const t = item.dataset.page;
      pages.forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + t).classList.add('active');
      crumbs.innerHTML = crumbMap[t];
    };
  });
}

/* ================================================================
   PAGE 1 — HABIT TRACKER  (date-based, 10 columns)
================================================================ */

// key into habitChecks
function hKey(habitIdx, ds) { return `${habitIdx}_${ds}`; }

function isChecked(habitIdx, ds) { return !!state.habitChecks[hKey(habitIdx, ds)]; }

function toggleCheck(habitIdx, ds) {
  const k = hKey(habitIdx, ds);
  if (state.habitChecks[k]) delete state.habitChecks[k];
  else state.habitChecks[k] = 1;
}

function renderHabitPage() {
  renderHabitTable();
  renderMonthSelector();
  renderProgress();
}

function renderHabitTable() {
  const cols  = buildDateColumns();
  const today = dateStr(new Date());

  // Build header
  const thead = document.querySelector('#habitTable thead');
  thead.innerHTML = '';
  const hrow = document.createElement('tr');
  hrow.innerHTML = '<th class="habit-col"></th><th class="open-col"></th>';
  cols.forEach(d => {
    const th = document.createElement('th');
    th.className = 'date-col' + (dateStr(d) === today ? ' today-col' : '');
    th.innerHTML = dateLabel(d);
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);

  // Build body
  const tbody = document.querySelector('#habitTable tbody');
  tbody.innerHTML = '';

  state.habits.forEach((h, rowIdx) => {
    const tr = document.createElement('tr');

    // Habit name cell
    const nameTd = document.createElement('td');
    nameTd.className = 'habit-cell';
    nameTd.innerHTML = `<div class="habit-name">
      <span>${h.emoji}</span>
      <span contenteditable="true" class="habit-name-text">${h.name}</span>
    </div>`;
    nameTd.querySelector('.habit-name-text').addEventListener('blur', e => {
      state.habits[rowIdx].name = e.target.textContent.trim() || h.name;
      scheduleSave();
    });
    tr.appendChild(nameTd);

    // Delete cell
    const delTd = document.createElement('td');
    delTd.className = 'open-cell'; delTd.textContent = '✕'; delTd.title = 'Delete habit';
    delTd.addEventListener('click', () => {
      if (confirm(`Delete habit "${h.name}"?`)) {
        // Remove all checks for this habit
        Object.keys(state.habitChecks).forEach(k => {
          if (k.startsWith(rowIdx + '_')) delete state.habitChecks[k];
        });
        // Re-index keys for habits after this one
        const newChecks = {};
        Object.entries(state.habitChecks).forEach(([k, v]) => {
          const [idx, ds] = k.split('_');
          const i = parseInt(idx);
          if (i < rowIdx) newChecks[k] = v;
          else if (i > rowIdx) newChecks[`${i - 1}_${ds}`] = v;
        });
        state.habitChecks = newChecks;
        state.habits.splice(rowIdx, 1);
        renderHabitPage(); scheduleSave();
      }
    });
    tr.appendChild(delTd);

    // Date check cells
    cols.forEach(d => {
      const ds = dateStr(d);
      const isToday = ds === today;
      const isFuture = ds > today;

      const td  = document.createElement('td');
      td.className = 'check-cell' + (isToday ? ' today-cell' : '');

      const box = document.createElement('span');
      box.className = 'checkbox' + (isChecked(rowIdx, ds) ? ' checked' : '') + (isFuture ? ' future' : '');
      td.appendChild(box);

      if (!isFuture) {
        td.addEventListener('click', () => {
          toggleCheck(rowIdx, ds);
          box.classList.toggle('checked');
          renderProgress();
          scheduleSave();
        });
      } else {
        td.title = 'Future date';
        td.style.cursor = 'default';
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

document.getElementById('addHabitRow').addEventListener('click', () => {
  const name = prompt('New habit name:', 'New habit');
  if (name && name.trim()) {
    state.habits.push({ emoji: '\u2B50', name: name.trim() });
    renderHabitPage(); scheduleSave();
  }
});

/* ---- Month Selector ---- */
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function renderMonthSelector() {
  const sel = document.getElementById('progressMonthSel');
  if (!sel) return;
  const now = new Date();
  sel.innerHTML = '';
  // Show last 12 months up to current
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const o = document.createElement('option');
    o.value = `${d.getFullYear()}-${d.getMonth()}`;
    o.textContent = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (d.getFullYear() === progressMonth.year && d.getMonth() === progressMonth.month) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => {
    const [y, m] = sel.value.split('-').map(Number);
    progressMonth = { year: y, month: m };
    renderProgress();
  };
}

/* ---- Progress (donut + bar chart) calculated from real data ---- */
function renderProgress() {
  const { year, month } = progressMonth;
  const days    = daysInMonth(year, month);
  const today   = dateStr(new Date());
  // Only count days up to today (don't count future)
  const pastDays = days.filter(d => d <= today);

  if (pastDays.length === 0 || state.habits.length === 0) {
    document.getElementById('progressPct').textContent = '0%';
    setDonut(0);
    renderBarChart([]);
    return;
  }

  const total   = state.habits.length * pastDays.length;
  let checked   = 0;
  state.habits.forEach((_, hIdx) => {
    pastDays.forEach(ds => { if (isChecked(hIdx, ds)) checked++; });
  });

  const pct = total ? Math.round((checked / total) * 100) : 0;
  document.getElementById('progressPct').textContent = pct + '%';
  document.getElementById('goalText').textContent = `Goal : ${state.habitGoal}%`;
  document.getElementById('donutCallout').textContent = `${pct}%`;
  setDonut(pct);

  // Daily % for last 10 days of the selected month (or fewer)
  const last10 = pastDays.slice(-10);
  const dailyPcts = last10.map(ds => {
    const c = state.habits.reduce((s, _, hIdx) => s + (isChecked(hIdx, ds) ? 1 : 0), 0);
    return state.habits.length ? Math.round((c / state.habits.length) * 100) : 0;
  });
  renderBarChart(last10, dailyPcts);
}

function setDonut(pct) {
  const circumference = 2 * Math.PI * 68;
  const dash = (pct / 100) * circumference;
  document.getElementById('progressArc').setAttribute('stroke-dasharray', `${dash} ${circumference}`);
}

function renderBarChart(dates, pcts) {
  const svg = document.getElementById('habitBarChart');
  if (!svg) return;
  svg.innerHTML = '';

  const W = 480, H = 200, PAD = { l:30, r:10, t:10, b:30 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const n = dates.length;
  if (!n) {
    svg.innerHTML = `<text x="240" y="100" text-anchor="middle" fill="#9b9a97" font-size="13">No data for this month yet.</text>`;
    return;
  }

  const barW   = Math.min(36, (chartW / n) * 0.6);
  const gap    = chartW / n;
  const today  = dateStr(new Date());

  // Grid lines
  [0, 25, 50, 75, 100].forEach(v => {
    const y = PAD.t + chartH - (v / 100) * chartH;
    svg.innerHTML += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
    svg.innerHTML += `<text x="${PAD.l - 4}" y="${y + 4}" text-anchor="end" fill="#9b9a97" font-size="10">${v}%</text>`;
  });

  // Bars
  dates.forEach((ds, i) => {
    const p  = pcts[i] || 0;
    const x  = PAD.l + gap * i + gap / 2;
    const bH = (p / 100) * chartH;
    const y  = PAD.t + chartH - bH;
    const isToday = ds === today;
    const color = p >= (state.habitGoal || 80) ? '#2f9e6f' : (isToday ? '#2383e2' : '#93c5fd');

    svg.innerHTML += `<rect x="${x - barW/2}" y="${y}" width="${barW}" height="${bH}" rx="3" fill="${color}"/>`;
    if (p > 0) svg.innerHTML += `<text x="${x}" y="${y - 4}" text-anchor="middle" fill="#37352f" font-size="10" font-weight="600">${p}%</text>`;

    // X-axis label
    const d   = new Date(ds + 'T00:00:00');
    const lbl = isToday ? 'Today' : d.getDate().toString();
    svg.innerHTML += `<text x="${x}" y="${H - PAD.b + 14}" text-anchor="middle" fill="${isToday ? '#2383e2' : '#9b9a97'}" font-size="10" font-weight="${isToday ? '700' : '400'}">${lbl}</text>`;
  });

  // Goal line
  const goalY = PAD.t + chartH - (state.habitGoal / 100) * chartH;
  svg.innerHTML += `<line x1="${PAD.l}" y1="${goalY}" x2="${W - PAD.r}" y2="${goalY}" stroke="#e8a83c" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  svg.innerHTML += `<text x="${W - PAD.r + 2}" y="${goalY + 4}" fill="#e8a83c" font-size="10">Goal</text>`;
}

document.getElementById('editGoalBtn').addEventListener('click', () => {
  const g = prompt('Set your monthly goal %:', state.habitGoal);
  const n = parseFloat(g);
  if (!isNaN(n)) { state.habitGoal = Math.max(0, Math.min(100, n)); renderProgress(); scheduleSave(); }
});

/* ================================================================
   PAGE 2 — EXERCISE PLANNER
================================================================ */
const dowList     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const splitOptions = ['Rest','Back & Biceps','Chest & Triceps','Legs & Shoulders'];

function renderWeekGrid() {
  const weekGrid = document.getElementById('weekGrid');
  weekGrid.innerHTML = '';
  dowList.forEach((d, i) => {
    const cell = document.createElement('div'); cell.className = 'week-cell';
    const sel  = document.createElement('select');
    splitOptions.forEach(opt => {
      const o = document.createElement('option'); o.value = opt; o.textContent = opt;
      if (opt === state.weekPlan[i]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { state.weekPlan[i] = sel.value; scheduleSave(); });
    cell.innerHTML = `<div class="dow">${d}</div>`;
    cell.appendChild(sel);
    weekGrid.appendChild(cell);
  });
}

const dayCardsWrap = document.getElementById('dayCards');

function renderDays() {
  dayCardsWrap.innerHTML = '';
  state.workoutDays.forEach(day => {
    const card   = document.createElement('div'); card.className = 'day-card';
    const header = document.createElement('div'); header.className = 'day-card-header';
    header.innerHTML = `
      <div class="day-title">&#128170; <span>${day.title}</span> <span class="tag">${day.exercises.length} exercises</span></div>
      <div class="day-card-actions">
        <button class="btn secondary small rename-btn">Rename</button>
        <button class="btn danger small delete-day-btn">Delete</button>
      </div>`;
    card.appendChild(header);

    const body  = document.createElement('div'); body.className = 'day-card-body';
    const table = document.createElement('table'); table.className = 'ex-table';
    table.innerHTML = `<thead><tr>
      <th class="col-name">Exercise</th><th class="col-sets">Sets</th>
      <th class="col-reps">Reps</th><th class="col-weight">Weight</th>
      <th class="col-notes">Notes</th><th class="col-action"></th>
    </tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    day.exercises.forEach((ex, exIdx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" value="${ex.name}" data-field="name"></td>
        <td><input type="text" value="${ex.sets}" data-field="sets"></td>
        <td><input type="text" value="${ex.reps}" data-field="reps"></td>
        <td><input type="text" value="${ex.weight}" data-field="weight"></td>
        <td><input type="text" value="${ex.notes}" data-field="notes"></td>
        <td class="check-cell"><button class="btn danger small del-ex-btn">✕</button></td>`;
      tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => { ex[inp.dataset.field] = inp.value; scheduleSave(); });
      });
      tr.querySelector('.del-ex-btn').addEventListener('click', () => {
        day.exercises.splice(exIdx, 1); renderDays(); scheduleSave();
      });
      tbody.appendChild(tr);
    });

    const addRow = document.createElement('div'); addRow.className = 'add-exercise-row';
    addRow.innerHTML = `<button class="btn secondary small">+ Add exercise</button>`;
    addRow.querySelector('button').addEventListener('click', () => {
      day.exercises.push({ name:'', sets:'', reps:'', weight:'', notes:'' });
      renderDays(); scheduleSave();
    });
    body.appendChild(table); body.appendChild(addRow); card.appendChild(body);

    header.querySelector('.rename-btn').addEventListener('click', () => {
      const n = prompt('Rename workout day:', day.title);
      if (n && n.trim()) { day.title = n.trim(); renderDays(); scheduleSave(); }
    });
    header.querySelector('.delete-day-btn').addEventListener('click', () => {
      if (confirm(`Delete "${day.title}"?`)) {
        state.workoutDays.splice(state.workoutDays.findIndex(d => d.id === day.id), 1);
        renderDays(); scheduleSave();
      }
    });
    dayCardsWrap.appendChild(card);
  });
}

document.getElementById('addDayBtn').addEventListener('click', () => {
  const name = prompt('Name this workout day:', 'New Day');
  if (name && name.trim()) {
    state.workoutDays.push({ id: state.dayIdCounter++, title: name.trim(), exercises: [{ name:'', sets:'', reps:'', weight:'', notes:'' }] });
    renderDays(); scheduleSave();
  }
});

/* ================================================================
   PAGE 3 — EXPENSE TRACKER
================================================================ */
const incomeInput = document.getElementById('incomeInput');
document.getElementById('setIncomeBtn').addEventListener('click', () => {
  state.monthlyIncome = parseFloat(incomeInput.value) || 0;
  renderAllExpensePage(); scheduleSave();
});

function fmt(n) { return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }

function spentByCategory(name) {
  return state.expenses.filter(e => e.category === name).reduce((s, e) => s + e.amount, 0);
}

function renderBudgetTable() {
  const tbody = document.getElementById('budgetBody'); tbody.innerHTML = '';
  let totalPct = 0;
  state.budgetCategories.forEach((cat, idx) => {
    totalPct += Number(cat.pct) || 0;
    const budgeted = state.monthlyIncome * (cat.pct / 100);
    const spent    = spentByCategory(cat.name);
    const rem      = budgeted - spent;
    const pctUsed  = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
    const over     = spent > budgeted && budgeted > 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${cat.name}" data-idx="${idx}" data-field="name" style="width:100%;border:none;background:transparent;font-weight:500;"></td>
      <td><input type="number" class="pct-input" value="${cat.pct}" data-idx="${idx}" data-field="pct" min="0" max="100"> %</td>
      <td>${fmt(budgeted)}</td><td>${fmt(spent)}</td>
      <td style="color:${rem<0?'var(--red)':'var(--text)'}">
        ${fmt(rem)}
        <div class="bar-track"><div class="bar-fill ${over?'over':''}" style="width:${pctUsed}%"></div></div>
      </td>
      <td><button class="btn danger small del-cat-btn" data-idx="${idx}">✕</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input[data-field="name"]').forEach(inp => {
    inp.addEventListener('input', () => { state.budgetCategories[inp.dataset.idx].name = inp.value; populateCategorySelect(); scheduleSave(); });
  });
  tbody.querySelectorAll('input[data-field="pct"]').forEach(inp => {
    inp.addEventListener('input', () => { state.budgetCategories[inp.dataset.idx].pct = parseFloat(inp.value)||0; renderAllExpensePage(); scheduleSave(); });
  });
  tbody.querySelectorAll('.del-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => { state.budgetCategories.splice(btn.dataset.idx, 1); renderAllExpensePage(); scheduleSave(); });
  });

  const note = document.getElementById('pctNote');
  const diff = 100 - totalPct;
  note.textContent = `Total allocated: ${totalPct}%` + (totalPct > 100 ? ' — exceeds 100%!' : diff > 0 ? ` — ${diff}% unallocated.` : ' — fully allocated.');
  note.className = 'pct-total-note' + (totalPct > 100 ? ' warn' : '');
}

document.getElementById('addBudgetCatBtn').addEventListener('click', () => {
  const name = prompt('New budget category name:');
  if (name && name.trim()) {
    state.budgetCategories.push({ name: name.trim(), pct: 0, color: '#9b9a97' });
    renderAllExpensePage(); scheduleSave();
  }
});

function populateCategorySelect() {
  const sel = document.getElementById('expCategory');
  const cur = sel.value;
  sel.innerHTML = '';
  state.budgetCategories.forEach(cat => {
    const o = document.createElement('option'); o.value = cat.name; o.textContent = cat.name;
    sel.appendChild(o);
  });
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function renderExpenseTable() {
  const tbody = document.getElementById('expenseBody');
  const empty = document.getElementById('expenseEmpty');
  tbody.innerHTML = '';
  if (!state.expenses.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  state.expenses.slice().reverse().forEach(exp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${exp.date||'—'}</td>
      <td><span class="tag-pill" style="background:#eef3fb;color:var(--blue)">${exp.category}</span></td>
      <td>${exp.desc||''}</td>
      <td class="amt">${fmt(exp.amount)}</td>
      <td class="check-cell"><button class="btn danger small del-exp-btn" data-id="${exp.id}">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.del-exp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.expenses = state.expenses.filter(e => e.id !== Number(btn.dataset.id));
      renderAllExpensePage(); scheduleSave();
    });
  });
}

document.getElementById('addExpenseBtn').addEventListener('click', () => {
  const date     = document.getElementById('expDate').value;
  const category = document.getElementById('expCategory').value;
  const desc     = document.getElementById('expDesc').value;
  const amount   = parseFloat(document.getElementById('expAmount').value) || 0;
  if (!category || amount <= 0) { alert('Choose a category and enter an amount > 0.'); return; }
  state.expenses.push({ id: state.expenseIdCounter++, date, category, desc, amount });
  document.getElementById('expDesc').value = '';
  document.getElementById('expAmount').value = '';
  renderAllExpensePage(); scheduleSave();
});

function renderSummary() {
  const totalSpent = state.expenses.reduce((s, e) => s + e.amount, 0);
  const savingsCat = state.budgetCategories.find(c => /saving/i.test(c.name));
  const savingsAmt = savingsCat ? state.monthlyIncome * (savingsCat.pct / 100) : 0;
  document.getElementById('statIncome').textContent    = fmt(state.monthlyIncome);
  document.getElementById('statSpent').textContent     = fmt(totalSpent);
  document.getElementById('statRemaining').textContent = fmt(state.monthlyIncome - totalSpent);
  document.getElementById('statSavings').textContent   = fmt(savingsAmt);
  incomeInput.value = state.monthlyIncome || '';
}

function renderAllExpensePage() {
  renderBudgetTable(); populateCategorySelect(); renderExpenseTable(); renderSummary();
}
