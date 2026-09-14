/* ============================================================
   Rememberly — app.js  (v2)
   CRUD · Date logic · localStorage · Tab routing
   Stats · Calendar · Sample data seeding
   ============================================================ */

'use strict';

// ─── Constants ────────────────────────────────────────────────
const STORAGE_KEY      = 'rememberly_dates';
const USERS_KEY        = 'rememberly_users';
const SEEDED_KEY       = 'rememberly_seeded';
const URGENCY_DAYS     = 7;
const MS_PER_DAY       = 86_400_000;

// ─── State ────────────────────────────────────────────────────
let dates          = [];
let users          = [];
let activeFilter   = 'all';
let activeSort     = 'upcoming';
let searchQuery    = '';
let pendingDeleteId = null;
let countdownInterval = null;
let activeTab      = 'dashboard';

// Calendar state
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed

// ─── DOM refs ─────────────────────────────────────────────────
const cardsGrid       = document.getElementById('cardsGrid');
const emptyState      = document.getElementById('emptyState');
const emptyTitle      = document.getElementById('emptyTitle');
const emptyBody       = document.getElementById('emptyBody');
const heroStatNum     = document.getElementById('heroStatNum');
const searchInput     = document.getElementById('searchInput');
const filterChips     = document.getElementById('filterChips');
const sortSelect      = document.getElementById('sortSelect');
const toastContainer  = document.getElementById('toastContainer');

// Stats
const statTotalNum    = document.getElementById('statTotalNum');
const statComingNum   = document.getElementById('statComingNum');
const statMonthNum    = document.getElementById('statMonthNum');
const statCatNum      = document.getElementById('statCatNum');

// Modals
const modalBackdrop   = document.getElementById('modalBackdrop');
const modalTitle      = document.getElementById('modalTitle');
const dateForm        = document.getElementById('dateForm');
const editingId       = document.getElementById('editingId');
const inputName       = document.getElementById('inputName');
const inputDate       = document.getElementById('inputDate');
const inputCategory   = document.getElementById('inputCategory');
const inputCustomCat  = document.getElementById('inputCustomCategory');
const inputNote       = document.getElementById('inputNote');
const charCount       = document.getElementById('charCount');
const errName         = document.getElementById('errName');
const errDate         = document.getElementById('errDate');
const confirmBackdrop = document.getElementById('confirmBackdrop');
const confirmName     = document.getElementById('confirmName');
const inputUser       = document.getElementById('inputUser');

// Users DOM
const userModalBackdrop = document.getElementById('userModalBackdrop');
const userForm        = document.getElementById('userForm');
const inputUserName   = document.getElementById('inputUserName');
const errUserName     = document.getElementById('errUserName');
const btnCloseUserModal = document.getElementById('btnCloseUserModal');
const btnCancelUserForm = document.getElementById('btnCancelUserForm');
const btnCreateUser   = document.getElementById('btnCreateUser');
const usersGrid       = document.getElementById('usersGrid');
const usersEmpty      = document.getElementById('usersEmpty');

// Buttons
const btnOpenModal    = document.getElementById('btnOpenModal');
const btnOpenModal2   = document.getElementById('btnOpenModal2');
const btnEmptyAdd     = document.getElementById('btnEmptyAdd');
const btnCloseModal   = document.getElementById('btnCloseModal');
const btnCancelForm   = document.getElementById('btnCancelForm');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete= document.getElementById('btnConfirmDelete');

// Calendar
const calGrid         = document.getElementById('calGrid');
const calMonthLabel   = document.getElementById('calMonthLabel');
const calPrev         = document.getElementById('calPrev');
const calNext         = document.getElementById('calNext');
const calToday        = document.getElementById('calToday');
const dayPopover      = document.getElementById('dayPopover');
const dayPopoverTitle = document.getElementById('dayPopoverTitle');
const dayPopoverEvents= document.getElementById('dayPopoverEvents');
const dayPopoverClose = document.getElementById('dayPopoverClose');

// This Month
const thisMonthGrid   = document.getElementById('thisMonthGrid');
const thisMonthEmpty  = document.getElementById('thisMonthEmpty');
const thisMonthTitle  = document.getElementById('thisMonthTitle');
const thisMonthSub    = document.getElementById('thisMonthSub');

// Settings
const btnResetSample  = document.getElementById('btnResetSample');
const btnClearAll     = document.getElementById('btnClearAll');

// Tab nav
const tabBtns         = document.querySelectorAll('.tab-btn');
const tabViews        = document.querySelectorAll('.tab-view');


// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function nextOccurrence(dateStr) {
  const today = todayMidnight();
  const orig  = parseLocalDate(dateStr);
  let next = new Date(today.getFullYear(), orig.getMonth(), orig.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, orig.getMonth(), orig.getDate());
  }
  return next;
}

function daysUntil(dateStr) {
  const today = todayMidnight();
  const next  = nextOccurrence(dateStr);
  return Math.round((next - today) / MS_PER_DAY);
}

function countdownLabel(days) {
  if (days === 0) return '🎉 Today!';
  if (days === 1) return 'Tomorrow';
  if (days < 7)  return `in ${days} days`;
  if (days < 14) return 'in 1 week';
  const weeks = Math.floor(days / 7);
  if (days < 31) return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `in ${months} month${months > 1 ? 's' : ''}`;
  return `in ${Math.floor(days / 365.25)} year${Math.floor(days / 365.25) > 1 ? 's' : ''}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCatClass(category) {
  if (category === 'Birthday')    return 'cat-birthday';
  if (category === 'Anniversary') return 'cat-anniversary';
  return 'cat-other';
}

function categoryIcon(category) {
  if (category === 'Birthday') return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 14V9a5 5 0 0110 0v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8 4V2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="1" y="13" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/>
  </svg>`;
  if (category === 'Anniversary') return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 13.5S2 9.7 2 5.5a3.5 3.5 0 016-2.45A3.5 3.5 0 0114 5.5C14 9.7 8 13.5 8 13.5z" stroke="currentColor" stroke-width="1.8"/>
  </svg>`;
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.8"/>
    <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

// Relative date from today (positive = future, negative = past)
function relativeDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Return YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];


// ═══════════════════════════════════════════════════════════════
//  LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════

function loadDates() {
  try {
    dates = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    dates = [];
  }
  try {
    users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    users = [];
  }
}

function saveDates() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}


// ═══════════════════════════════════════════════════════════════
//  SAMPLE DATA SEEDING
// ═══════════════════════════════════════════════════════════════

const SAMPLE_USERS = [
  { id: 'user_alex', name: 'Alex Johnson' },
  { id: 'user_sarah', name: 'Sarah Miller' }
];

const SAMPLE_DATA = () => [
  {
    id: uid(), addedAt: Date.now() - 5000,
    name: "Mom's Birthday",
    date: relativeDate(3),
    category: 'Birthday', customCategory: '',
    note: 'Get her favourite flowers and a card 🌸',
    userId: 'user_alex',
    completed: true,
  },
  {
    id: uid(), addedAt: Date.now() - 4000,
    name: "Wedding Anniversary",
    date: relativeDate(6),
    category: 'Anniversary', customCategory: '',
    note: 'Book the restaurant in advance!',
    userId: 'user_alex',
    completed: true,
  },
  {
    id: uid(), addedAt: Date.now() - 3000,
    name: "Alex's Birthday",
    date: relativeDate(0),   // today!
    category: 'Birthday', customCategory: '',
    note: 'Send a surprise message at midnight 🎂',
    userId: 'user_sarah',
    completed: false,
  },
  {
    id: uid(), addedAt: Date.now() - 2000,
    name: "Parents' Anniversary",
    date: relativeDate(22),
    category: 'Anniversary', customCategory: '',
    note: 'Family dinner — organise by end of month',
    userId: 'user_sarah',
    completed: true,
  },
  {
    id: uid(), addedAt: Date.now() - 1000,
    name: "Team Retreat",
    date: relativeDate(45),
    category: 'Other', customCategory: 'Work',
    note: 'Book travel and accommodation ahead of time',
    userId: 'user_sarah',
    completed: false,
  },
];

function seedSampleData() {
  let needsSave = false;
  if (users.length === 0 && !localStorage.getItem('rememberly_users_seeded')) {
    users = [...SAMPLE_USERS];
    localStorage.setItem('rememberly_users_seeded', '1');
    needsSave = true;
  }
  if (dates.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
    dates = SAMPLE_DATA();
    localStorage.setItem(SEEDED_KEY, '1');
    needsSave = true;
  }
  if (needsSave) {
    saveDates();
  }
}


// ═══════════════════════════════════════════════════════════════
//  TAB ROUTING
// ═══════════════════════════════════════════════════════════════

function switchTab(tabName) {
  activeTab = tabName;

  // Update tab button states
  tabBtns.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Show / hide tab panels with fade transition
  tabViews.forEach(view => {
    const isTarget = view.id === `view-${tabName}`;
    if (isTarget) {
      view.classList.remove('hidden');
      // Trigger entrance animation
      requestAnimationFrame(() => view.classList.add('tab-view--visible'));
    } else {
      view.classList.remove('tab-view--visible');
      view.classList.add('hidden');
    }
  });

  // Render the target view's content
  if (tabName === 'dashboard')  renderCards();
  if (tabName === 'calendar')   renderCalendar();
  if (tabName === 'thismonth')  renderThisMonth();
  if (tabName === 'users')      renderUsers();
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});


// ═══════════════════════════════════════════════════════════════
//  STATS ROW
// ═══════════════════════════════════════════════════════════════

function renderStats() {
  const now     = new Date();
  const curYear = now.getFullYear();
  const curMonth= now.getMonth();

  const total   = dates.length;
  const coming  = dates.filter(d => daysUntil(d.date) <= URGENCY_DAYS).length;
  const thisMonth = dates.filter(d => {
    const occ = nextOccurrence(d.date);
    return occ.getFullYear() === curYear && occ.getMonth() === curMonth;
  }).length;
  const categories = new Set(dates.map(d => d.customCategory || d.category)).size;

  animateStatNum(statTotalNum,  total);
  animateStatNum(statComingNum, coming);
  animateStatNum(statMonthNum,  thisMonth);
  animateStatNum(statCatNum,    categories);

  heroStatNum.textContent = total;
}

/** Briefly flash the number when it changes */
function animateStatNum(el, newVal) {
  if (el.textContent === String(newVal)) return;
  el.classList.remove('stat-num--bump');
  void el.offsetWidth; // reflow
  el.textContent = newVal;
  el.classList.add('stat-num--bump');
}


// ═══════════════════════════════════════════════════════════════
//  DASHBOARD — CARD RENDERING
// ═══════════════════════════════════════════════════════════════

function getFilteredSortedDates() {
  let result = dates.slice();

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.customCategory || d.category).toLowerCase().includes(q) ||
      (d.note || '').toLowerCase().includes(q)
    );
  }

  if (activeFilter !== 'all') {
    result = result.filter(d => {
      const cat = d.customCategory || d.category;
      return cat === activeFilter || d.category === activeFilter;
    });
  }

  if (activeSort === 'upcoming') {
    result.sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  } else if (activeSort === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else if (activeSort === 'added') {
    result.sort((a, b) => b.addedAt - a.addedAt);
  }

  return result;
}

function renderCards(animate = false) {
  renderStats();

  const filtered = getFilteredSortedDates();

  if (filtered.length === 0) {
    cardsGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    if (searchQuery || activeFilter !== 'all') {
      emptyTitle.textContent = 'No matches found';
      emptyBody.textContent  = `Try adjusting your search or filter to find what you're looking for.`;
      btnEmptyAdd.style.display = 'none';
    } else {
      emptyTitle.textContent = 'Nothing here yet';
      emptyBody.textContent  = `Add your first important date and we'll keep track of it for you, forever.`;
      btnEmptyAdd.style.display = '';
    }
    return;
  }

  emptyState.classList.add('hidden');
  cardsGrid.innerHTML = '';
  filtered.forEach((entry, i) => {
    const card = buildCard(entry, animate && i === 0);
    cardsGrid.appendChild(card);
  });
}

function buildCard(entry, animate = false) {
  const days     = daysUntil(entry.date);
  const cat      = entry.customCategory || entry.category;
  const isToday  = days === 0;
  const isUrgent = days > 0 && days <= URGENCY_DAYS;
  const nextDate = nextOccurrence(entry.date);
  const nextStr  = nextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const isCompleted = entry.completed || false;

  let urgencyClass = '';
  let urgencyBadge = '';
  if (isCompleted) {
    urgencyClass = 'card--completed';
    urgencyBadge = '<span class="urgency-badge badge--completed">✅ Done</span>';
  } else if (isToday) {
    urgencyClass = 'card--today';
    urgencyBadge = '<span class="urgency-badge badge--today">🎉 Today!</span>';
  } else if (isUrgent) {
    urgencyClass = 'card--urgent';
    urgencyBadge = '<span class="urgency-badge badge--urgent">⚡ Coming up!</span>';
  }

  const assignedUser = users.find(u => u.id === entry.userId);
  const userBadge = assignedUser ? `<span class="card-user-badge" style="font-size:0.75rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:12px; margin-left:8px;">👤 ${escapeHtml(assignedUser.name)}</span>` : '';

  const li = document.createElement('li');
  li.className = `date-card ${urgencyClass}${animate ? ' card--new' : ''}`;
  li.setAttribute('role', 'listitem');
  li.dataset.id = entry.id;

  li.innerHTML = `
    <div class="card-glow" aria-hidden="true"></div>
    <div class="card-top">
      <div class="card-cat-icon ${getCatClass(entry.category)}" aria-label="${escapeHtml(cat)} category">
        ${categoryIcon(entry.category)}
      </div>
      <div class="card-meta">
        <span class="card-category">${escapeHtml(cat)}</span>
        ${userBadge}
        ${urgencyBadge}
      </div>
      <div class="card-actions">
        <button class="card-btn complete-btn" data-id="${entry.id}" aria-label="Toggle Complete" title="Mark Complete">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="card-btn edit-btn" data-id="${entry.id}" aria-label="Edit ${escapeHtml(entry.name)}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="card-btn delete-btn" data-id="${entry.id}" aria-label="Delete ${escapeHtml(entry.name)}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <rect x="2" y="4" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="card-body">
      <h3 class="card-name">${isCompleted ? `<s>${escapeHtml(entry.name)}</s>` : escapeHtml(entry.name)}</h3>
      ${entry.note ? `<p class="card-note">${escapeHtml(entry.note)}</p>` : ''}
    </div>
    <div class="card-footer">
      <div class="card-date-row">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/>
          <path d="M5 1v2M11 1v2M2 7h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span class="card-date">${nextStr}</span>
      </div>
      <div class="countdown-pill ${isToday && !isCompleted ? 'pill--today' : isUrgent && !isCompleted ? 'pill--urgent' : ''}" data-id="${entry.id}" data-date="${entry.date}">
        ${isCompleted ? 'Completed' : countdownLabel(days)}
      </div>
    </div>
  `;

  li.querySelector('.complete-btn').addEventListener('click', () => toggleComplete(entry.id));
  li.querySelector('.edit-btn').addEventListener('click', () => openEditModal(entry.id));
  li.querySelector('.delete-btn').addEventListener('click', () => openDeleteConfirm(entry.id));
  return li;
}

// Mini card for calendar popover / this-month list
function buildMiniCard(entry) {
  const days    = daysUntil(entry.date);
  const cat     = entry.customCategory || entry.category;
  const isToday = days === 0;
  const isUrgent= days > 0 && days <= URGENCY_DAYS;
  const isCompleted = entry.completed || false;
  const div = document.createElement('div');
  div.className = `mini-card ${isCompleted ? 'card--completed' : isToday ? 'card--today' : isUrgent ? 'card--urgent' : ''}`;
  div.innerHTML = `
    <div class="mini-card-left">
      <div class="card-cat-icon ${getCatClass(entry.category)} mini-icon">${categoryIcon(entry.category)}</div>
    </div>
    <div class="mini-card-body">
      <span class="mini-card-name">${isCompleted ? `<s>${escapeHtml(entry.name)}</s>` : escapeHtml(entry.name)}</span>
      <span class="mini-card-cat">${escapeHtml(cat)}</span>
    </div>
    <div class="countdown-pill ${isToday && !isCompleted ? 'pill--today' : isUrgent && !isCompleted ? 'pill--urgent' : ''}" style="font-size:.7rem;padding:3px 8px">
      ${isCompleted ? 'Done' : countdownLabel(days)}
    </div>
  `;
  return div;
}


// ═══════════════════════════════════════════════════════════════
//  THIS MONTH VIEW
// ═══════════════════════════════════════════════════════════════

function renderThisMonth() {
  const now      = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth();

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  thisMonthTitle.textContent = monthName;

  const thisMonth = dates.filter(d => {
    const occ = nextOccurrence(d.date);
    return occ.getFullYear() === curYear && occ.getMonth() === curMonth;
  }).sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

  thisMonthGrid.innerHTML = '';
  if (thisMonth.length === 0) {
    thisMonthEmpty.classList.remove('hidden');
    thisMonthSub.textContent  = 'No dates this month.';
  } else {
    thisMonthEmpty.classList.add('hidden');
    thisMonthSub.textContent = `${thisMonth.length} date${thisMonth.length !== 1 ? 's' : ''} in ${monthName}`;
    thisMonth.forEach(entry => {
      const card = buildCard(entry, false);
      thisMonthGrid.appendChild(card);
    });
  }
}


// ═══════════════════════════════════════════════════════════════
//  CALENDAR VIEW
// ═══════════════════════════════════════════════════════════════

function renderCalendar() {
  calMonthLabel.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
  calGrid.innerHTML = '';
  dayPopover.classList.add('hidden');

  const firstDay   = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth= new Date(calYear, calMonth + 1, 0).getDate();
  const today      = todayMidnight();

  // Build a map: "YYYY-MM-DD" → [entries]
  const eventMap = {};
  dates.forEach(entry => {
    const occ = nextOccurrence(entry.date);
    if (occ.getFullYear() === calYear && occ.getMonth() === calMonth) {
      const key = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(occ.getDate()).padStart(2,'0')}`;
      if (!eventMap[key]) eventMap[key] = [];
      eventMap[key].push(entry);
    }
  });

  // Blank offset cells
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day cal-day--empty';
    blank.setAttribute('aria-hidden', 'true');
    calGrid.appendChild(blank);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(calYear, calMonth, d);
    const keyStr   = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const eventsForDay = eventMap[keyStr] || [];
    const isToday  = cellDate.getTime() === today.getTime();

    const cell = document.createElement('div');
    cell.className = `cal-day${isToday ? ' cal-day--today' : ''}${eventsForDay.length ? ' cal-day--has-events' : ''}`;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${MONTH_NAMES[calMonth]} ${d}${eventsForDay.length ? `, ${eventsForDay.length} event${eventsForDay.length > 1 ? 's' : ''}` : ''}`);
    cell.setAttribute('tabindex', eventsForDay.length ? '0' : '-1');

    cell.innerHTML = `<span class="cal-day-num">${d}</span>`;

    // Dots — max 3 visible
    if (eventsForDay.length) {
      const dotsWrap = document.createElement('div');
      dotsWrap.className = 'cal-dots';
      eventsForDay.slice(0, 3).forEach(entry => {
        const dot = document.createElement('span');
        dot.className = `cal-dot ${getCatClass(entry.category)}`;
        dotsWrap.appendChild(dot);
      });
      if (eventsForDay.length > 3) {
        const more = document.createElement('span');
        more.className = 'cal-dot-more';
        more.textContent = `+${eventsForDay.length - 3}`;
        dotsWrap.appendChild(more);
      }
      cell.appendChild(dotsWrap);

      // Click → popover
      const openPopover = () => openDayPopover(d, eventsForDay);
      cell.addEventListener('click', openPopover);
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopover(); }
      });
    }

    calGrid.appendChild(cell);
  }
}

function openDayPopover(day, events) {
  dayPopoverTitle.textContent = `${MONTH_NAMES[calMonth]} ${day}`;
  dayPopoverEvents.innerHTML = '';
  events.forEach(entry => {
    dayPopoverEvents.appendChild(buildMiniCard(entry));
  });
  dayPopover.classList.remove('hidden');
  requestAnimationFrame(() => dayPopover.classList.add('popover--visible'));
}

function closeDayPopover() {
  dayPopover.classList.remove('popover--visible');
  dayPopover.addEventListener('transitionend', () => dayPopover.classList.add('hidden'), { once: true });
}

dayPopoverClose.addEventListener('click', closeDayPopover);

calPrev.addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
calNext.addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});
calToday.addEventListener('click', () => {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
});

// Close popover when clicking outside
document.addEventListener('click', (e) => {
  if (!dayPopover.classList.contains('hidden') &&
      !dayPopover.contains(e.target) &&
      !e.target.closest('.cal-day--has-events')) {
    closeDayPopover();
  }
});


// ═══════════════════════════════════════════════════════════════
//  FILTER CHIPS (custom categories)
// ═══════════════════════════════════════════════════════════════

function updateFilterChips() {
  const customCats = [...new Set(
    dates.map(d => d.customCategory).filter(Boolean)
  )];
  filterChips.querySelectorAll('.chip[data-custom]').forEach(c => c.remove());
  customCats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.filter = cat;
    btn.dataset.custom = '1';
    btn.setAttribute('aria-pressed', activeFilter === cat ? 'true' : 'false');
    btn.textContent = cat;
    if (activeFilter === cat) btn.classList.add('active');
    filterChips.appendChild(btn);
  });
}

filterChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  activeFilter = chip.dataset.filter;
  filterChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c === chip);
    c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
  });
  renderCards();
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderCards();
});

sortSelect.addEventListener('change', () => {
  activeSort = sortSelect.value;
  renderCards();
});


// ═══════════════════════════════════════════════════════════════
//  MODAL — ADD / EDIT
// ═══════════════════════════════════════════════════════════════

function populateUserSelect() {
  inputUser.innerHTML = '<option value="">-- No User (Unassigned) --</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.name;
    inputUser.appendChild(opt);
  });
}

function openAddModal() {
  editingId.value = '';
  modalTitle.textContent = 'Add a Date';
  document.getElementById('btnSubmitForm').innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Save Date`;
  resetForm();
  populateUserSelect();
  inputUser.value = '';
  showModal(modalBackdrop);
  setTimeout(() => inputName.focus(), 80);
}

function openEditModal(id) {
  const entry = dates.find(d => d.id === id);
  if (!entry) return;
  editingId.value = id;
  modalTitle.textContent = 'Edit Date';
  document.getElementById('btnSubmitForm').innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Update Date`;
  populateUserSelect();
  inputName.value     = entry.name;
  inputDate.value     = entry.date;
  inputCategory.value = entry.category;
  inputCustomCat.value= entry.customCategory || '';
  inputNote.value     = entry.note || '';
  inputUser.value     = entry.userId || '';
  updateCharCount();
  clearErrors();
  showModal(modalBackdrop);
  setTimeout(() => inputName.focus(), 80);
}

function closeModal() {
  hideModal(modalBackdrop);
  resetForm();
}

function resetForm() {
  dateForm.reset();
  editingId.value = '';
  charCount.textContent = '0 / 200';
  clearErrors();
}

function clearErrors() {
  errName.textContent = '';
  errDate.textContent = '';
  inputName.classList.remove('input-error');
  inputDate.classList.remove('input-error');
}

function showModal(el) {
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => el.classList.add('modal-visible'));
}

function hideModal(el) {
  el.classList.remove('modal-visible');
  el.addEventListener('transitionend', () => {
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }, { once: true });
}

function validateForm() {
  let valid = true;
  clearErrors();
  if (!inputName.value.trim()) {
    errName.textContent = 'Please enter a name or title.';
    inputName.classList.add('input-error');
    valid = false;
  }
  if (!inputDate.value) {
    errDate.textContent = 'Please pick a date.';
    inputDate.classList.add('input-error');
    valid = false;
  }
  if (!valid) {
    const firstErr = dateForm.querySelector('.input-error');
    if (firstErr) firstErr.focus();
  }
  return valid;
}

dateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const id     = editingId.value;
  const isEdit = Boolean(id);
  const existing = isEdit ? dates.find(d => d.id === id) : null;
  const entry  = {
    id:             isEdit ? id : uid(),
    name:           inputName.value.trim(),
    date:           inputDate.value,
    category:       inputCategory.value,
    customCategory: inputCustomCat.value.trim(),
    note:           inputNote.value.trim(),
    userId:         inputUser.value || null,
    completed:      existing ? (existing.completed || false) : false,
    addedAt:        isEdit ? (existing?.addedAt ?? Date.now()) : Date.now(),
  };

  if (isEdit) {
    const idx = dates.findIndex(d => d.id === id);
    if (idx !== -1) dates[idx] = entry;
    showToast('Date updated successfully!', 'success');
  } else {
    dates.unshift(entry);
    showToast('Date added! 🎉', 'success');
  }

  saveDates();
  closeModal();
  renderCards(!isEdit);
  updateFilterChips();
  if (activeTab === 'users') renderUsers();
});


// ═══════════════════════════════════════════════════════════════
//  DELETE
// ═══════════════════════════════════════════════════════════════

function openDeleteConfirm(id) {
  const entry = dates.find(d => d.id === id);
  if (!entry) return;
  pendingDeleteId = id;
  confirmName.textContent = entry.name;
  showModal(confirmBackdrop);
  setTimeout(() => btnCancelDelete.focus(), 80);
}

btnConfirmDelete.addEventListener('click', () => {
  if (!pendingDeleteId) return;
  const entry = dates.find(d => d.id === pendingDeleteId);
  dates = dates.filter(d => d.id !== pendingDeleteId);
  pendingDeleteId = null;
  saveDates();
  hideModal(confirmBackdrop);
  renderCards();
  updateFilterChips();
  if (activeTab === 'calendar')  renderCalendar();
  if (activeTab === 'thismonth') renderThisMonth();
  showToast(`"${entry?.name}" removed.`, 'info');
});

btnCancelDelete.addEventListener('click', () => {
  pendingDeleteId = null;
  hideModal(confirmBackdrop);
});


// ═══════════════════════════════════════════════════════════════
//  SETTINGS — DATA MANAGEMENT
// ═══════════════════════════════════════════════════════════════

btnResetSample.addEventListener('click', () => {
  if (!confirm('Reset all data to sample entries? This will delete your current dates.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SEEDED_KEY);
  location.reload();
});

btnClearAll.addEventListener('click', () => {
  if (!confirm('Clear all dates? This cannot be undone.')) return;
  dates = [];
  saveDates();
  localStorage.removeItem(SEEDED_KEY);
  renderCards();
  renderStats();
  updateFilterChips();
  switchTab('dashboard');
  showToast('All dates cleared.', 'info');
});


// ═══════════════════════════════════════════════════════════════
//  KEYBOARD + FOCUS TRAP
// ═══════════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalBackdrop.classList.contains('hidden'))   closeModal();
    if (!confirmBackdrop.classList.contains('hidden')) { pendingDeleteId = null; hideModal(confirmBackdrop); }
    if (!dayPopover.classList.contains('hidden'))       closeDayPopover();
    if (!userModalBackdrop.classList.contains('hidden')) hideModal(userModalBackdrop);
  }
});

function trapFocus(container, e) {
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

modalBackdrop.addEventListener('keydown',  e => trapFocus(document.getElementById('modal'), e));
confirmBackdrop.addEventListener('keydown', e => trapFocus(confirmBackdrop.querySelector('.confirm-modal'), e));
userModalBackdrop.addEventListener('keydown', e => trapFocus(document.getElementById('userModal'), e));

modalBackdrop.addEventListener('click',  e => { if (e.target === modalBackdrop)   closeModal(); });
confirmBackdrop.addEventListener('click', e => { if (e.target === confirmBackdrop) { pendingDeleteId = null; hideModal(confirmBackdrop); } });
userModalBackdrop.addEventListener('click', e => { if (e.target === userModalBackdrop) hideModal(userModalBackdrop); });


// ═══════════════════════════════════════════════════════════════
//  MULTI-USER & GRADING SYSTEM
// ═══════════════════════════════════════════════════════════════

function toggleComplete(id) {
  const entry = dates.find(d => d.id === id);
  if (!entry) return;
  entry.completed = !entry.completed;
  saveDates();
  renderCards();
  if (activeTab === 'calendar') renderCalendar();
  if (activeTab === 'thismonth') renderThisMonth();
  if (activeTab === 'users') renderUsers();
  showToast(entry.completed ? 'Marked complete!' : 'Marked incomplete.', 'success');
}

function calculateGrade(completionPercentage) {
  if (completionPercentage >= 90) return { grade: 'A', class: 'grade-a' };
  if (completionPercentage >= 80) return { grade: 'B', class: 'grade-b' };
  if (completionPercentage >= 70) return { grade: 'C', class: 'grade-c' };
  if (completionPercentage >= 60) return { grade: 'D', class: 'grade-d' };
  return { grade: 'F', class: 'grade-f' };
}

function renderUsers() {
  if (users.length === 0) {
    usersGrid.innerHTML = '';
    usersEmpty.classList.remove('hidden');
    return;
  }
  
  usersEmpty.classList.add('hidden');
  usersGrid.innerHTML = '';
  
  users.forEach(user => {
    const userDates = dates.filter(d => d.userId === user.id);
    const total = userDates.length;
    const completed = userDates.filter(d => d.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    const gradeInfo = total === 0 ? { grade: '-', class: 'grade-none' } : calculateGrade(percentage);
    const initial = (user.name || '?').trim().charAt(0).toUpperCase();

    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
      <div class="user-card-header">
        <div class="user-info">
          <div class="user-avatar">${escapeHtml(initial)}</div>
          <div>
            <h3 class="user-name">${escapeHtml(user.name)}</h3>
            <span style="font-size:0.8rem; color:var(--text-muted);">${total} event${total === 1 ? '' : 's'} assigned</span>
          </div>
        </div>
        <div class="user-grade-badge ${gradeInfo.class}" title="Grade: ${gradeInfo.grade} (${percentage}% completed)">${gradeInfo.grade}</div>
      </div>
      <div class="user-stats">
        <div class="user-stat">
          <span class="user-stat-label">Assigned</span>
          <span class="user-stat-val">${total}</span>
        </div>
        <div class="user-stat">
          <span class="user-stat-label">Completed</span>
          <span class="user-stat-val" style="color:#34d399;">${completed}</span>
        </div>
        <div class="user-stat">
          <span class="user-stat-label">Progress</span>
          <span class="user-stat-val">${percentage}%</span>
        </div>
      </div>
      <div class="user-progress-wrap">
        <div class="user-progress-header">
          <span>Completion Rate</span>
          <span><strong>${percentage}%</strong></span>
        </div>
        <div class="user-progress-bar">
          <div class="user-progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
      <div class="user-card-footer">
        <button class="btn-del-user" data-id="${user.id}" title="Delete user">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <rect x="2" y="4" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/>
          </svg>
          Delete User
        </button>
      </div>
    `;
    card.querySelector('.btn-del-user').addEventListener('click', () => deleteUser(user.id));
    usersGrid.appendChild(card);
  });
}

function deleteUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  if (!confirm(`Delete user "${user.name}"? Any dates assigned to them will become unassigned.`)) return;
  users = users.filter(u => u.id !== userId);
  dates.forEach(d => {
    if (d.userId === userId) d.userId = null;
  });
  saveDates();
  renderUsers();
  renderCards();
  showToast(`User "${user.name}" deleted.`, 'success');
}

btnCreateUser.addEventListener('click', () => {
  errUserName.textContent = '';
  inputUserName.classList.remove('input-error');
  userForm.reset();
  showModal(userModalBackdrop);
  setTimeout(() => inputUserName.focus(), 80);
});

btnCancelUserForm.addEventListener('click', () => hideModal(userModalBackdrop));
btnCloseUserModal.addEventListener('click', () => hideModal(userModalBackdrop));

userForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = inputUserName.value.trim();
  if (!name) {
    errUserName.textContent = 'Please enter a name.';
    inputUserName.classList.add('input-error');
    inputUserName.focus();
    return;
  }
  users.push({ id: uid(), name });
  saveDates();
  hideModal(userModalBackdrop);
  renderUsers();
  showToast('User created!', 'success');
});

// Settings data management actions
if (btnResetSample) {
  btnResetSample.addEventListener('click', () => {
    if (!confirm('Reset all data back to the demo sample data? This will overwrite your current dates and users.')) return;
    localStorage.removeItem(SEEDED_KEY);
    localStorage.removeItem('rememberly_users_seeded');
    users = [];
    dates = [];
    seedSampleData();
    renderCards();
    updateFilterChips();
    if (activeTab === 'calendar') renderCalendar();
    if (activeTab === 'thismonth') renderThisMonth();
    if (activeTab === 'users') renderUsers();
    showToast('Data reset to demo samples!', 'success');
  });
}

if (btnClearAll) {
  btnClearAll.addEventListener('click', () => {
    if (!confirm('Permanently clear all data? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERS_KEY);
    localStorage.setItem(SEEDED_KEY, '1');
    localStorage.setItem('rememberly_users_seeded', '1');
    dates = [];
    users = [];
    renderCards();
    updateFilterChips();
    if (activeTab === 'calendar') renderCalendar();
    if (activeTab === 'thismonth') renderThisMonth();
    if (activeTab === 'users') renderUsers();
    showToast('All data cleared.', 'success');
  });
}


// ═══════════════════════════════════════════════════════════════
//  TEXTAREA CHAR COUNT
// ═══════════════════════════════════════════════════════════════

function updateCharCount() {
  charCount.textContent = `${inputNote.value.length} / 200`;
}
inputNote.addEventListener('input', updateCharCount);


// ═══════════════════════════════════════════════════════════════
//  TOASTS
// ═══════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  const icon = type === 'success'
    ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.8"/><path d="M8 5v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11" r="1" fill="currentColor"/></svg>`;
  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast--visible')));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3200);
}


// ═══════════════════════════════════════════════════════════════
//  COUNTDOWN TIMER (live refresh)
// ═══════════════════════════════════════════════════════════════

function startCountdownTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    document.querySelectorAll('.countdown-pill[data-date]').forEach(pill => {
      pill.textContent = countdownLabel(daysUntil(pill.dataset.date));
    });
  }, 60_000);
}


// ═══════════════════════════════════════════════════════════════
//  BUTTON WIRING
// ═══════════════════════════════════════════════════════════════

btnOpenModal.addEventListener('click',  openAddModal);
btnOpenModal2.addEventListener('click', openAddModal);
btnEmptyAdd.addEventListener('click',   openAddModal);
btnCloseModal.addEventListener('click', closeModal);
btnCancelForm.addEventListener('click', closeModal);


// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════

function init() {
  loadDates();
  seedSampleData();
  updateFilterChips();
  renderCards();            // renders stats too
  startCountdownTimer();

  // Activate the dashboard tab view (no-op visual, already visible, but sets class)
  document.getElementById('view-dashboard').classList.add('tab-view--visible');
}

init();
