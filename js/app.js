'use strict';

(() => {
  const STORAGE_KEY = 'travelplan.v1';
  const MAX_DAYS = 60;
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const TYPES = {
    sight: '景點',
    food: '餐廳',
    transport: '交通',
    lodging: '住宿',
    other: '其他',
  };
  const CURRENCIES = ['TWD', 'NZD', 'JPY', 'KRW', 'USD', 'EUR', 'THB', 'HKD', 'CNY', 'SGD', 'GBP'];
  const CABINS = ['經濟艙', '豪華經濟艙', '商務艙', '頭等艙'];

  const app = document.getElementById('app');
  const sheet = document.getElementById('sheet');
  const toastEl = document.getElementById('toast');

  // ---------- Icons（Lucide 線條風格，stroke 2） ----------

  const ICON_PATHS = {
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
  };

  const icon = (name, size = 20) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  // ---------- Storage ----------

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { trips: [] };
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.trips)) return { trips: [] };
      // 舊資料沒有機票欄位
      data.trips.forEach((t) => { if (!Array.isArray(t.flights)) t.flights = []; });
      return data;
    } catch {
      return { trips: [] };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast('無法儲存：瀏覽器的儲存空間無法使用，請確認沒有使用無痕模式');
    }
  }

  const state = load();

  // ---------- Utils ----------

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const nowISO = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, '0');

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

  // 日期一律是 'YYYY-MM-DD' 字串，用 UTC 解析，日期加減不受夏令時間影響
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const toISODate = (dt) => dt.toISOString().slice(0, 10);

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function nowTime() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // 'YYYY-MM-DDTHH:mm'，以手機當地時間比較，字串可直接比大小
  const nowKey = () => `${todayISO()}T${nowTime()}`;
  const flightKey = (f) => `${f.departDate}T${f.departTime}`;

  function fmtLongDate(str) {
    const d = parseDate(str);
    return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日 星期${WEEKDAYS[d.getUTCDay()]}`;
  }

  function addDays(str, n) {
    return toISODate(new Date(parseDate(str).getTime() + n * 86400000));
  }

  function dateRange(start, end) {
    const out = [];
    for (let d = start; d <= end && out.length <= MAX_DAYS; d = addDays(d, 1)) out.push(d);
    return out;
  }

  function fmtShort(str) {
    const d = parseDate(str);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEKDAYS[d.getUTCDay()]}）`;
  }

  const fmtMoney = (n, currency) => `${currency} ${Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;

  function fmtTime(a) {
    if (a.startTime && a.endTime) return `${a.startTime} – ${a.endTime}`;
    return a.startTime || (a.endTime ? `～ ${a.endTime}` : '未定時間');
  }

  function tripStatus(trip) {
    const today = todayISO();
    if (today < trip.startDate) {
      const diff = Math.round((parseDate(trip.startDate) - parseDate(today)) / 86400000);
      return { label: diff === 1 ? '明天出發' : `${diff} 天後出發`, cls: '' };
    }
    if (today <= trip.endDate) return { label: '旅途中', cls: 'ongoing' };
    return { label: '已結束', cls: '' };
  }

  const findTrip = (id) => state.trips.find((t) => t.id === id);

  function touch(trip) {
    trip.updatedAt = nowISO();
    save();
  }

  // ---------- Toast（可帶「復原」） ----------

  let toastTimer;
  function toast(msg, undo) {
    toastEl.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">復原</button>' : ''}`;
    if (undo) {
      toastEl.querySelector('button').addEventListener('click', () => {
        undo();
        toast('已復原');
      });
    }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), undo ? 5000 : 3000);
  }

  // 破壞性操作前先拍快照，toast 提供復原，取代確認對話框
  function snapshot() {
    const before = JSON.stringify(state.trips);
    return () => {
      state.trips = JSON.parse(before);
      save();
      render();
    };
  }

  // ---------- Routing ----------
  // #/                 首頁：現在時間、機票、當下行程
  // #/trips            旅程列表
  // #/trip/:id/:day    旅程詳情（day 從 0 起算）

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'trip' && parts[1]) {
      return { name: 'trip', id: decodeURIComponent(parts[1]), day: Number(parts[2]) || 0 };
    }
    if (parts[0] === 'trips') return { name: 'list' };
    return { name: 'home' };
  }

  const tripHref = (trip, day = 0) => `#/trip/${encodeURIComponent(trip.id)}/${day}`;
  const clampDay = (trip, day) => Math.min(Math.max(day, 0), trip.days.length - 1);

  function render() {
    const route = parseRoute();
    app.classList.toggle('is-home', route.name === 'home');
    if (route.name === 'trip') {
      const trip = findTrip(route.id);
      if (!trip) {
        location.hash = '#/trips';
        return;
      }
      renderTrip(trip, clampDay(trip, route.day));
    } else if (route.name === 'list') {
      renderList();
    } else {
      renderHome();
    }
  }

  // ---------- 首頁 ----------
  // 打開 App 第一眼：現在時間 → 機票 → 當下行程

  // 旅途中 > 最近要出發 > 最近結束
  function homeTrip() {
    const today = todayISO();
    const trips = state.trips;
    if (!trips.length) return null;
    const ongoing = trips.find((t) => t.startDate <= today && today <= t.endDate);
    if (ongoing) return ongoing;
    const upcoming = trips.filter((t) => t.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (upcoming.length) return upcoming[0];
    return [...trips].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  }

  // 只看有開始時間的活動；沒有結束時間的，算到同一天下一個活動開始為止
  function activityNowNext(trip, key) {
    const items = [];
    trip.days.forEach((d, dayIdx) => {
      const timed = d.activities.filter((a) => a.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
      timed.forEach((a, j) => {
        const start = `${d.date}T${a.startTime}`;
        const end = `${d.date}T${a.endTime || timed[j + 1]?.startTime || '24:00'}`;
        items.push({ a, dayIdx, start, end });
      });
    });
    const current = items.filter((x) => x.start <= key && key < x.end).pop();
    const next = items.find((x) => x.start > key && x !== current);
    return { current, next };
  }

  function renderHome() {
    document.title = 'TravelPlan 行程規劃';
    const today = todayISO();
    const trip = homeTrip();

    const clock = `
      <section class="home-clock" aria-label="現在時間">
        <time class="clock" datetime="${nowKey()}">${nowTime()}</time>
        <p class="clock-date">${fmtLongDate(today)}</p>
      </section>`;

    if (!trip) {
      app.innerHTML = `
        <div class="home">
          ${homeTop()}
          ${clock}
          <div class="empty home-empty">
            <div class="empty-icon">${icon('plane', 24)}</div>
            <strong>還沒有旅程</strong>
            <p>建立一趟旅程，加入機票和每日行程後，打開 App 就能看到下一班飛機和現在該做什麼。</p>
            <div class="empty-actions">
              <button class="btn primary" type="button" data-action="new-trip">${icon('plus', 18)}建立第一趟旅程</button>
              <button class="btn secondary" type="button" data-action="load-sample">看範例行程</button>
            </div>
          </div>
        </div>`;
      startClock();
      return;
    }

    const key = nowKey();
    const status = tripStatus(trip);
    const todayIdx = trip.days.findIndex((d) => d.date === today);
    const progress = todayIdx >= 0 ? `Day ${todayIdx + 1} / ${trip.days.length}` : status.label;
    const flights = trip.flights || [];
    const nextFlight = flights.find((f) => flightKey(f) >= key);
    const { current, next } = activityNowNext(trip, key);

    const flightBlock = nextFlight
      ? boardingPass(nextFlight)
      : `<div class="empty compact">
           <p>${flights.length ? '這趟旅程的航班都已出發。' : '還沒有加入機票。'}</p>
           <a class="btn secondary small" href="${tripHref(trip)}">${flights.length ? '查看機票' : `${icon('plus', 16)}新增機票`}</a>
         </div>`;

    const nowBlock = current || next
      ? `${current ? nowCard(trip, current, '現在', today) : ''}${next ? nowCard(trip, next, '接下來', today) : ''}`
      : `<div class="empty compact">
           <p>${todayIdx >= 0 || today < trip.startDate ? '接下來沒有排定時間的行程。' : '這趟旅程已經結束。'}</p>
           <a class="btn secondary small" href="${tripHref(trip, Math.max(todayIdx, 0))}">查看行程</a>
         </div>`;

    app.innerHTML = `
      <div class="home">
        ${homeTop()}
        ${clock}
        <a class="home-trip" href="${tripHref(trip, Math.max(todayIdx, 0))}">
          <span class="home-trip-text">
            <span class="trip-dest">${icon('pin', 14)}<span>${esc(trip.destination)}</span></span>
            <span class="home-trip-title">${esc(trip.title)}</span>
          </span>
          <span class="badge ${status.cls}">${progress}</span>
          ${icon('chevron', 20)}
        </a>

        <section class="home-flight">
          <div class="section-head">
            <h2>${nextFlight ? '下一班飛機' : '機票'}</h2>
            ${flights.length ? `<a class="btn ghost small" href="${tripHref(trip)}">全部 ${flights.length} 張</a>` : ''}
          </div>
          ${flightBlock}
        </section>

        <section class="home-now">
          <div class="section-head"><h2>當下行程</h2></div>
          <div class="now-list">${nowBlock}</div>
        </section>
      </div>`;
    startClock();
  }

  function homeTop() {
    return `
      <header class="home-top">
        <span class="home-brand">TravelPlan</span>
        <a class="btn ghost small" href="#/trips">所有旅程</a>
      </header>`;
  }

  function nowCard(trip, item, label, today) {
    const { a, dayIdx } = item;
    const type = TYPES[a.type] ? a.type : 'other';
    const day = trip.days[dayIdx];
    const when = day.date === today ? fmtTime(a) : `Day ${dayIdx + 1} · ${fmtShort(day.date)} · ${fmtTime(a)}`;
    const isNow = label === '現在';
    return `
      <a class="now-card${isNow ? ' is-now' : ''}" href="${tripHref(trip, dayIdx)}" data-type="${type}">
        <span class="now-top">
          <span class="now-label">${label}</span>
          <span class="type-tag">${TYPES[type]}</span>
        </span>
        <span class="now-time">${esc(when)}</span>
        <span class="now-title">${esc(a.title)}</span>
        ${a.location?.name ? `<span class="activity-meta">${icon('pin', 14)}<span>${esc(a.location.name)}</span></span>` : ''}
        ${isNow && a.note ? `<span class="activity-note">${esc(a.note)}</span>` : ''}
      </a>`;
  }

  // 每秒檢查，分鐘數變了才重畫，讓時間與「現在」行程跟著更新
  let clockTimer;
  function startClock() {
    clearInterval(clockTimer);
    let last = nowKey();
    clockTimer = setInterval(() => {
      if (parseRoute().name !== 'home') {
        clearInterval(clockTimer);
        return;
      }
      const key = nowKey();
      if (key !== last && !sheet.open) {
        last = key;
        render();
      }
    }, 1000);
  }

  // ---------- 機票（登機證樣式） ----------

  // 裝飾用條碼：由訂位代號決定線條，同一張機票每次長得一樣
  function barcode(seed) {
    let h = 2166136261;
    for (const c of String(seed || 'TRAVELPLAN')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    let x = 0;
    let bars = '';
    for (let i = 0; i < 48; i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const w = 1 + (Math.abs(h) % 3);
      if (i % 2 === 0) bars += `<rect x="${x}" width="${w}" height="40"/>`;
      x += w;
    }
    return `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${bars}</svg>`;
  }

  function boardingPass(f, { editable = false } = {}) {
    const field = (label, value, cls = '') =>
      `<div class="bp-field${cls}"><dt>${label}</dt><dd>${value ? esc(value) : '—'}</dd></div>`;
    const port = (p, time, date, cls = '') => `
      <div class="bp-port${cls}">
        <span class="bp-code">${esc(p.code)}</span>
        <span class="bp-city">${esc(p.city || '')}</span>
        <span class="bp-time">${esc(time || '--:--')}</span>
        <span class="bp-date">${date ? fmtShort(date) : ''}</span>
      </div>`;
    return `
      <div class="bp-wrap">
        <article class="bp" aria-label="${esc(`機票 ${f.flightNo}，${f.from.code} 飛往 ${f.to.code}，${fmtShort(f.departDate)} ${f.departTime} 出發`)}">
          <div class="bp-main">
            <header class="bp-head">
              <span class="bp-airline">${icon('plane', 16)}<span>${esc(f.airline || '航班')}</span></span>
              <span class="bp-kind">BOARDING PASS</span>
              ${editable ? `<button class="bp-edit" type="button" data-action="edit-flight" data-id="${esc(f.id)}" aria-label="編輯機票 ${esc(f.flightNo)}">${icon('pencil', 16)}</button>` : ''}
            </header>
            <div class="bp-route">
              ${port(f.from, f.departTime, f.departDate)}
              <div class="bp-path" aria-hidden="true">
                <span class="bp-line"></span>
                <span class="bp-plane">${icon('plane', 20)}</span>
                <span class="bp-line"></span>
                <span class="bp-flightno">${esc(f.flightNo)}</span>
              </div>
              ${port(f.to, f.arriveTime, f.arriveDate, ' end')}
            </div>
            <dl class="bp-grid">
              ${field('乘客', f.passenger, ' wide')}
              ${field('航班', f.flightNo)}
              ${field('艙等', f.cabin)}
              ${field('登機時間', f.boardingTime)}
              ${field('航廈', f.terminal)}
              ${field('登機門', f.gate)}
              ${field('座位', f.seat)}
            </dl>
          </div>
          <div class="bp-stub">
            <div class="bp-stub-head">${esc(f.flightNo)}</div>
            <dl class="bp-stub-fields">
              ${field('訂位代號', f.bookingRef, ' mono')}
              ${field('座位', f.seat)}
            </dl>
            <div class="bp-barcode">${barcode(f.bookingRef || f.flightNo)}</div>
          </div>
        </article>
      </div>`;
  }

  // ---------- 旅程列表 ----------

  function renderList() {
    document.title = 'TravelPlan 行程規劃';
    const trips = [...state.trips].sort((a, b) => a.startDate.localeCompare(b.startDate));

    app.innerHTML = `
      <header class="page-head">
        <div>
          <a class="back-link" href="#/">${icon('back', 18)}現在</a>
          <h1>我的旅程</h1>
          ${trips.length ? `<p>${trips.length} 趟旅程</p>` : ''}
        </div>
        ${trips.length ? `<button class="btn primary" type="button" data-action="new-trip">${icon('plus', 18)}新增旅程</button>` : ''}
      </header>
      ${trips.length
        ? `<ul class="trip-grid">${trips.map(tripCard).join('')}</ul>`
        : `<div class="empty">
             <div class="empty-icon">${icon('plane', 24)}</div>
             <strong>還沒有旅程</strong>
             <p>建立一趟旅程，選好日期後就能逐日安排景點、餐廳與交通。</p>
             <div class="empty-actions">
               <button class="btn primary" type="button" data-action="new-trip">${icon('plus', 18)}建立第一趟旅程</button>
               <button class="btn secondary" type="button" data-action="load-sample">看範例行程</button>
             </div>
           </div>`}
      <footer class="list-footer">資料只儲存在這個瀏覽器 · <a href="docs/index.html">規劃文件</a></footer>
    `;
  }

  function tripCard(trip) {
    const count = trip.days.reduce((n, d) => n + d.activities.length, 0);
    const status = tripStatus(trip);
    return `
      <li>
        <a class="trip-card" href="${tripHref(trip)}">
          <div class="trip-card-top">
            <span class="trip-dest">${icon('pin', 14)}<span>${esc(trip.destination)}</span></span>
            <span class="badge ${status.cls}">${status.label}</span>
          </div>
          <span class="trip-title">${esc(trip.title)}</span>
          <span class="trip-meta">${fmtShort(trip.startDate)} – ${fmtShort(trip.endDate)} · ${trip.days.length} 天 · ${count} 個活動</span>
        </a>
      </li>`;
  }

  // ---------- 旅程詳情 ----------

  function renderTrip(trip, dayIdx) {
    const day = trip.days[dayIdx];
    const dayCost = day.activities.reduce((s, a) => s + (a.cost || 0), 0);
    document.title = `${trip.title} · TravelPlan`;

    app.innerHTML = `
      <header class="topbar">
        <a class="icon-btn back" href="#/trips" aria-label="返回旅程列表">${icon('back', 24)}</a>
        <div class="topbar-title">
          <h1>${esc(trip.title)}</h1>
          <p>${esc(trip.destination)} · ${fmtShort(trip.startDate)} – ${fmtShort(trip.endDate)}</p>
        </div>
        <button class="btn ghost small" type="button" data-action="edit-trip">編輯</button>
      </header>

      <section class="flights" aria-label="機票">
        <div class="section-head">
          <h2>機票${trip.flights.length ? `<span class="count">${trip.flights.length} 張</span>` : ''}</h2>
          <button class="btn ghost small" type="button" data-action="new-flight">${icon('plus', 16)}新增機票</button>
        </div>
        ${trip.flights.length
          ? `<div class="flight-scroll">${trip.flights.map((f) => boardingPass(f, { editable: true })).join('')}</div>`
          : `<div class="empty compact"><p>加入機票後，打開 App 首頁就會顯示下一班飛機。</p></div>`}
      </section>

      <nav class="day-tabs" aria-label="選擇日期">
        ${trip.days.map((d, i) => `
          <a class="day-tab${i === dayIdx ? ' active' : ''}" href="${tripHref(trip, i)}"${i === dayIdx ? ' aria-current="page"' : ''}>
            <span class="day-num">Day ${i + 1}${d.activities.length ? '<span class="day-dot" aria-hidden="true"></span>' : ''}</span>
            <span class="day-date">${fmtShort(d.date)}</span>
          </a>`).join('')}
      </nav>

      <section>
        <div class="day-head">
          <h2>${fmtShort(day.date)}${day.activities.length ? `<span class="count">${day.activities.length} 個活動</span>` : ''}</h2>
          ${day.activities.length > 1 ? `<button class="btn ghost small" type="button" data-action="sort-time">${icon('clock', 16)}依時間排序</button>` : ''}
        </div>

        ${day.activities.length
          ? `<ol class="timeline" id="activity-list">${day.activities.map((a) => activityItem(a, trip)).join('')}</ol>`
          : `<div class="empty">
               <div class="empty-icon">${icon('calendar', 24)}</div>
               <strong>這天還沒有安排</strong>
               <p>新增景點、餐廳或交通。加入多個活動後，按住左側把手可以拖曳調整順序。</p>
             </div>`}

        ${dayCost > 0 ? `<div class="day-summary"><span>本日花費</span><strong>${fmtMoney(dayCost, trip.currency)}</strong></div>` : ''}

        <button class="btn primary block" type="button" data-action="new-activity">${icon('plus', 20)}新增活動</button>
      </section>
    `;

    const active = app.querySelector('.day-tab.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });

    const list = document.getElementById('activity-list');
    if (list) {
      enableDrag(list, (ids) => {
        const byId = new Map(day.activities.map((a) => [a.id, a]));
        day.activities = ids.map((id) => byId.get(id));
        touch(trip);
      });
    }
  }

  function activityItem(a, trip) {
    const type = TYPES[a.type] ? a.type : 'other';
    return `
      <li class="activity" data-id="${esc(a.id)}" data-type="${type}">
        <button class="drag-handle" type="button" aria-label="拖曳排序：${esc(a.title)}">${icon('grip', 18)}</button>
        <button class="activity-body" type="button" data-action="edit-activity" data-id="${esc(a.id)}">
          <span class="activity-top">
            <span class="activity-time">${esc(fmtTime(a))}</span>
            <span class="type-tag">${TYPES[type]}</span>
          </span>
          <span class="activity-title">${esc(a.title)}</span>
          ${a.location?.name ? `<span class="activity-meta">${icon('pin', 14)}<span>${esc(a.location.name)}</span></span>` : ''}
          ${a.note ? `<span class="activity-note">${esc(a.note)}</span>` : ''}
          ${a.cost ? `<span class="activity-cost">${fmtMoney(a.cost, trip.currency)}</span>` : ''}
        </button>
      </li>`;
  }

  // ---------- 拖曳排序（pointer events，支援觸控） ----------

  function enableDrag(list, onDrop) {
    list.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const item = handle.closest('.activity');
      const startOrder = [...list.children].map((el) => el.dataset.id).join();
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      item.classList.add('dragging');

      const onMove = (ev) => {
        const others = [...list.querySelectorAll('.activity:not(.dragging)')];
        const next = others.find((el) => {
          const r = el.getBoundingClientRect();
          return ev.clientY < r.top + r.height / 2;
        });
        if (next) {
          if (item.nextElementSibling !== next) list.insertBefore(item, next);
        } else if (list.lastElementChild !== item) {
          list.appendChild(item);
        }
      };

      const onEnd = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        item.classList.remove('dragging');
        const ids = [...list.children].map((el) => el.dataset.id);
        if (ids.join() !== startOrder) onDrop(ids);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    });
  }

  // ---------- Bottom sheet ----------
  // onSubmit 回傳字串 = 顯示錯誤；其他 = 關閉

  let sheetActions = {};

  function openSheet(title, body, { onSubmit, actions = {}, deleteLabel, submitLabel }) {
    sheet.innerHTML = `
      <div class="grabber" aria-hidden="true"></div>
      <form class="sheet-form" novalidate>
        <div class="sheet-head">
          <h2>${title}</h2>
          <button type="button" class="icon-btn" data-close aria-label="關閉">${icon('close', 20)}</button>
        </div>
        ${body}
        <p class="form-error" role="alert" hidden></p>
        <div class="sheet-actions">
          ${deleteLabel ? `<button type="button" class="btn danger" data-sheet-action="delete">${deleteLabel}</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-close>取消</button>
          <button type="submit" class="btn primary">${submitLabel}</button>
        </div>
      </form>`;
    sheet.setAttribute('aria-label', title);
    sheetActions = actions;

    const form = sheet.querySelector('form');
    const errorEl = form.querySelector('.form-error');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const result = onSubmit(new FormData(form));
      if (typeof result === 'string') {
        errorEl.innerHTML = `${icon('alert', 16)}<span>${esc(result)}</span>`;
        errorEl.hidden = false;
      } else {
        sheet.close();
      }
    });
    sheet.showModal();
  }

  sheet.addEventListener('click', (e) => {
    // 點到 dialog 本身代表點在遮罩上
    if (e.target === sheet || e.target.closest('[data-close]')) {
      sheet.close();
      return;
    }
    const btn = e.target.closest('[data-sheet-action]');
    if (btn && sheetActions[btn.dataset.sheetAction]) sheetActions[btn.dataset.sheetAction]();
  });

  // ---------- 旅程表單 ----------

  function openTripForm(trip) {
    const isNew = !trip;
    const t = trip || {
      title: '',
      destination: '',
      startDate: todayISO(),
      endDate: addDays(todayISO(), 2),
      currency: 'TWD',
    };

    openSheet(isNew ? '新增旅程' : '編輯旅程', `
      <label class="field"><span>旅程名稱</span>
        <input name="title" maxlength="60" value="${esc(t.title)}" placeholder="例：東京四日遊" autocomplete="off">
      </label>
      <label class="field"><span>目的地</span>
        <input name="destination" maxlength="60" value="${esc(t.destination)}" placeholder="例：日本東京" autocomplete="off">
      </label>
      <div class="field-row">
        <label class="field"><span>出發日</span><input type="date" name="startDate" value="${t.startDate}"></label>
        <label class="field"><span>回程日</span><input type="date" name="endDate" value="${t.endDate}"></label>
      </div>
      <label class="field"><span>幣別</span>
        <select name="currency">
          ${CURRENCIES.map((c) => `<option${c === t.currency ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </label>`, {
      submitLabel: isNew ? '建立旅程' : '儲存',
      deleteLabel: isNew ? null : '刪除旅程',
      onSubmit: (fd) => {
        const data = {
          title: fd.get('title').trim(),
          destination: fd.get('destination').trim(),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
          currency: fd.get('currency'),
        };
        if (!data.title) return '請填寫旅程名稱';
        if (!data.destination) return '請填寫目的地';
        if (!data.startDate || !data.endDate) return '請選擇出發日與回程日';
        if (data.endDate < data.startDate) return '回程日不能早於出發日';
        const dates = dateRange(data.startDate, data.endDate);
        if (dates.length > MAX_DAYS) return `一趟旅程最多 ${MAX_DAYS} 天`;

        if (isNew) {
          const created = {
            id: uid(),
            ...data,
            days: dates.map((date) => ({ date, activities: [] })),
            flights: [],
            createdAt: nowISO(),
            updatedAt: nowISO(),
          };
          state.trips.push(created);
          save();
          location.hash = tripHref(created);
          return;
        }

        // 日期變更時依「第幾天」對應：Day 1 的活動仍留在 Day 1
        const undo = snapshot();
        const lost = trip.days.slice(dates.length).reduce((n, d) => n + d.activities.length, 0);
        Object.assign(trip, data);
        trip.days = dates.map((date, i) => ({ date, activities: trip.days[i]?.activities || [] }));
        touch(trip);
        render();
        toast(lost ? `已更新旅程，移除了 ${lost} 個活動` : '已更新旅程', lost ? undo : null);
      },
      actions: {
        delete: () => {
          const undo = snapshot();
          state.trips = state.trips.filter((x) => x.id !== trip.id);
          save();
          sheet.close();
          location.hash = '#/trips';
          toast(`已刪除「${trip.title}」`, undo);
        },
      },
    });
  }

  // ---------- 活動表單 ----------

  function openActivityForm(trip, dayIdx, activity) {
    const isNew = !activity;
    const a = activity || { title: '', type: 'sight' };

    openSheet(isNew ? '新增活動' : '編輯活動', `
      <label class="field"><span>名稱</span>
        <input name="title" maxlength="80" value="${esc(a.title)}" placeholder="例：淺草寺・雷門" autocomplete="off">
      </label>
      <fieldset class="chips">
        <legend>類型</legend>
        ${Object.entries(TYPES).map(([key, label]) => `
          <label class="chip"><input type="radio" name="type" value="${key}"${key === a.type ? ' checked' : ''}><span>${label}</span></label>`).join('')}
      </fieldset>
      <div class="field-row">
        <label class="field"><span>開始時間</span><input type="time" name="startTime" value="${esc(a.startTime || '')}"></label>
        <label class="field"><span>結束時間</span><input type="time" name="endTime" value="${esc(a.endTime || '')}"></label>
      </div>
      <label class="field"><span>地點</span>
        <input name="location" maxlength="120" value="${esc(a.location?.name || '')}" placeholder="地址或地標名稱" autocomplete="off">
      </label>
      <div class="field-row">
        <label class="field"><span>花費（${esc(trip.currency)}）</span>
          <input type="number" name="cost" min="0" step="any" inputmode="decimal" value="${a.cost ?? ''}" placeholder="0">
        </label>
        <label class="field"><span>日期</span>
          <select name="day">
            ${trip.days.map((d, i) => `<option value="${i}"${i === dayIdx ? ' selected' : ''}>Day ${i + 1} · ${fmtShort(d.date)}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="field"><span>備註</span>
        <textarea name="note" maxlength="1000" placeholder="訂位代號、營業時間、注意事項">${esc(a.note || '')}</textarea>
      </label>`, {
      submitLabel: isNew ? '新增' : '儲存',
      deleteLabel: isNew ? null : '刪除活動',
      onSubmit: (fd) => {
        const title = fd.get('title').trim();
        const startTime = fd.get('startTime');
        const endTime = fd.get('endTime');
        const costRaw = fd.get('cost').trim();
        const cost = costRaw === '' ? undefined : Number(costRaw);
        const locationName = fd.get('location').trim();
        const note = fd.get('note').trim();
        const targetDay = Number(fd.get('day'));

        if (!title) return '請填寫名稱';
        if (startTime && endTime && endTime < startTime) return '結束時間不能早於開始時間';
        if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) return '花費請輸入 0 以上的數字';

        const next = {
          id: isNew ? uid() : activity.id,
          title,
          type: fd.get('type') || 'other',
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          location: locationName ? { ...(activity?.location || {}), name: locationName } : undefined,
          cost,
          note: note || undefined,
        };

        const fromList = trip.days[dayIdx].activities;
        if (!isNew && targetDay === dayIdx) {
          fromList[fromList.indexOf(activity)] = next;
        } else {
          if (!isNew) fromList.splice(fromList.indexOf(activity), 1);
          trip.days[targetDay].activities.push(next);
        }
        touch(trip);
        render();
        if (targetDay !== dayIdx) toast(`已${isNew ? '新增到' : '移到'} Day ${targetDay + 1}`);
      },
      actions: {
        delete: () => {
          const undo = snapshot();
          const list = trip.days[dayIdx].activities;
          list.splice(list.indexOf(activity), 1);
          touch(trip);
          sheet.close();
          render();
          toast(`已刪除「${activity.title}」`, undo);
        },
      },
    });
  }

  // ---------- 機票表單 ----------

  function openFlightForm(trip, flight) {
    const isNew = !flight;
    const f = flight || {
      from: {}, to: {},
      departDate: trip.startDate,
      arriveDate: trip.startDate,
      cabin: CABINS[0],
    };
    const input = (name, label, value, attrs = '') =>
      `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value || '')}" autocomplete="off" ${attrs}></label>`;

    openSheet(isNew ? '新增機票' : '編輯機票', `
      <div class="field-row">
        ${input('airline', '航空公司', f.airline, 'maxlength="40" placeholder="例：紐西蘭航空"')}
        ${input('flightNo', '航班編號', f.flightNo, 'maxlength="10" placeholder="例：NZ 78"')}
      </div>
      ${input('passenger', '乘客姓名', f.passenger, 'maxlength="60" placeholder="與護照相同，例：WANG/XIAOMING"')}
      <div class="field-row">
        ${input('fromCode', '出發機場代碼', f.from.code, 'maxlength="3" placeholder="TPE" class="upper"')}
        ${input('fromCity', '出發城市', f.from.city, 'maxlength="30" placeholder="台北桃園"')}
      </div>
      <div class="field-row">
        ${input('toCode', '抵達機場代碼', f.to.code, 'maxlength="3" placeholder="AKL" class="upper"')}
        ${input('toCity', '抵達城市', f.to.city, 'maxlength="30" placeholder="奧克蘭"')}
      </div>
      <div class="field-row">
        <label class="field"><span>出發日期</span><input type="date" name="departDate" value="${esc(f.departDate || '')}"></label>
        <label class="field"><span>出發時間</span><input type="time" name="departTime" value="${esc(f.departTime || '')}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>抵達日期</span><input type="date" name="arriveDate" value="${esc(f.arriveDate || '')}"></label>
        <label class="field"><span>抵達時間</span><input type="time" name="arriveTime" value="${esc(f.arriveTime || '')}"></label>
      </div>
      <p class="field-hint">時間請填機票上的當地時間。</p>
      <div class="field-row">
        <label class="field"><span>登機時間</span><input type="time" name="boardingTime" value="${esc(f.boardingTime || '')}"></label>
        <label class="field"><span>艙等</span>
          <select name="cabin">${CABINS.map((c) => `<option${c === f.cabin ? ' selected' : ''}>${c}</option>`).join('')}</select>
        </label>
      </div>
      <div class="field-row">
        ${input('terminal', '航廈', f.terminal, 'maxlength="10" placeholder="例：T1"')}
        ${input('gate', '登機門', f.gate, 'maxlength="10" placeholder="例：A5"')}
      </div>
      <div class="field-row">
        ${input('seat', '座位', f.seat, 'maxlength="6" placeholder="例：42A"')}
        ${input('bookingRef', '訂位代號', f.bookingRef, 'maxlength="10" placeholder="例：X7K2QP" class="upper"')}
      </div>`, {
      submitLabel: isNew ? '新增' : '儲存',
      deleteLabel: isNew ? null : '刪除機票',
      onSubmit: (fd) => {
        const get = (k) => fd.get(k).trim();
        const next = {
          id: isNew ? uid() : flight.id,
          airline: get('airline'),
          flightNo: get('flightNo').toUpperCase(),
          passenger: get('passenger'),
          from: { code: get('fromCode').toUpperCase(), city: get('fromCity') },
          to: { code: get('toCode').toUpperCase(), city: get('toCity') },
          departDate: get('departDate'),
          departTime: get('departTime'),
          arriveDate: get('arriveDate'),
          arriveTime: get('arriveTime'),
          boardingTime: get('boardingTime'),
          cabin: get('cabin'),
          terminal: get('terminal'),
          gate: get('gate'),
          seat: get('seat').toUpperCase(),
          bookingRef: get('bookingRef').toUpperCase(),
        };
        if (!next.flightNo) return '請填寫航班編號';
        if (!/^[A-Z]{3}$/.test(next.from.code) || !/^[A-Z]{3}$/.test(next.to.code)) return '機場代碼請填 3 個英文字母，例如 TPE';
        if (!next.departDate || !next.departTime) return '請填寫出發日期與時間';

        if (isNew) trip.flights.push(next);
        else trip.flights[trip.flights.indexOf(flight)] = next;
        // 機票一律依出發時間排列
        trip.flights.sort((a, b) => flightKey(a).localeCompare(flightKey(b)));
        touch(trip);
        render();
      },
      actions: {
        delete: () => {
          const undo = snapshot();
          trip.flights.splice(trip.flights.indexOf(flight), 1);
          touch(trip);
          sheet.close();
          render();
          toast(`已刪除機票 ${flight.flightNo}`, undo);
        },
      },
    });
  }

  // ---------- 範例行程 ----------

  function sampleTrip() {
    const start = addDays(todayISO(), 14);
    const day = (n) => addDays(start, n);
    const act = (title, type, startTime, endTime, location, cost, note) => ({
      id: uid(), title, type,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: location ? { name: location } : undefined,
      cost, note,
    });
    const flight = (airline, flightNo, from, to, departDate, departTime, arriveDate, arriveTime, extra) => ({
      id: uid(), airline, flightNo,
      passenger: 'WANG/XIAOMING',
      from, to, departDate, departTime, arriveDate, arriveTime,
      cabin: '經濟艙',
      ...extra,
    });
    const TPE = { code: 'TPE', city: '台北桃園' };
    const AKL = { code: 'AKL', city: '奧克蘭' };
    const days = [
      [
        act('前往桃園機場', 'transport', '19:30', '20:30', '桃園國際機場 第一航廈', undefined, '國際線提早 2.5 小時報到'),
        act('機場晚餐', 'food', '21:00', '21:45', '第一航廈 管制區'),
      ],
      [
        act('奧克蘭轉國內線', 'transport', '15:20', '17:00', '奧克蘭機場', undefined, '入境後領行李、過海關，再到國內線航廈'),
        act('皇后鎮機場取車', 'transport', '19:00', '19:40', '皇后鎮機場', undefined, '租車訂單在信箱'),
        act('Fergburger 晚餐', 'food', '20:15', '21:15', 'Fergburger, Shotover St', 48),
        act('入住皇后鎮', 'lodging', '21:30', undefined, '皇后鎮市區', 260, '共 2 晚'),
      ],
      [
        act('早餐', 'food', '06:30', '07:00', '飯店'),
        act('米佛峽灣一日遊', 'sight', '07:15', '19:30', 'Milford Sound', 520, '巴士 + 遊船，含午餐'),
        act('晚餐', 'food', '20:00', '21:00', '皇后鎮市區', 90),
      ],
      [
        act('早餐', 'food', '08:00', '08:45', '飯店'),
        act('皇后鎮 → 瓦納卡', 'transport', '09:30', '10:45', 'Crown Range Road'),
        act('瓦納卡孤獨的樹', 'sight', '11:00', '12:00', 'That Wanaka Tree'),
        act('湖畔午餐', 'food', '12:30', '13:30', 'Wanaka', 60),
        act('瓦納卡 → 庫克山', 'transport', '14:00', '16:30', 'SH8'),
        act('入住庫克山', 'lodging', '17:00', undefined, 'Aoraki/Mount Cook Village', 340),
        act('晚餐', 'food', '19:00', '20:00', '飯店餐廳', 110),
      ],
      [
        act('早餐', 'food', '07:00', '07:45', '飯店'),
        act('胡克谷步道', 'sight', '08:00', '11:30', 'Hooker Valley Track', undefined, '來回約 3 小時，帶防風外套'),
        act('午餐', 'food', '12:00', '13:00', '庫克山村', 55),
        act('庫克山 → 蒂卡波', 'transport', '13:30', '15:00', 'SH80 / SH8'),
        act('好牧羊人教堂', 'sight', '15:30', '16:30', 'Church of the Good Shepherd'),
        act('入住蒂卡波', 'lodging', '17:00', undefined, 'Lake Tekapo', 290),
        act('晚餐', 'food', '18:30', '19:30', 'Lake Tekapo', 85),
        act('星空導覽', 'sight', '21:30', '23:00', 'Dark Sky Project', 180, '已預約，天候不佳會改期'),
      ],
      [
        act('早餐', 'food', '08:00', '08:45', '飯店'),
        act('蒂卡波 → 基督城', 'transport', '09:30', '13:00', 'SH79 / SH1'),
        act('午餐', 'food', '13:30', '14:30', 'Riverside Market', 45),
        act('基督城植物園', 'sight', '15:00', '17:00', 'Christchurch Botanic Gardens'),
        act('入住基督城', 'lodging', '17:30', undefined, '基督城市區', 220),
        act('晚餐', 'food', '19:00', '20:00', '基督城市區', 95),
      ],
      [
        act('還車', 'transport', '05:30', '06:00', '基督城機場', undefined, '還車前加滿油'),
        act('機場早餐', 'food', '06:15', '06:45', '基督城機場', 30),
        act('奧克蘭轉國際線', 'transport', '08:20', '10:00', '奧克蘭機場'),
      ],
    ];
    return {
      id: uid(),
      title: '紐西蘭南島自駕',
      destination: '紐西蘭南島',
      startDate: start,
      endDate: day(days.length - 1),
      currency: 'NZD',
      days: days.map((activities, i) => ({ date: day(i), activities })),
      flights: [
        flight('紐西蘭航空', 'NZ 78', TPE, AKL, day(0), '23:10', day(1), '15:20',
          { boardingTime: '22:30', terminal: 'T1', gate: 'B5', seat: '42A', bookingRef: 'X7K2QP' }),
        flight('紐西蘭航空', 'NZ 615', AKL, { code: 'ZQN', city: '皇后鎮' }, day(1), '17:00', day(1), '18:50',
          { boardingTime: '16:30', terminal: 'D', seat: '12C', bookingRef: 'X7K2QP' }),
        flight('紐西蘭航空', 'NZ 506', { code: 'CHC', city: '基督城' }, AKL, day(6), '07:00', day(6), '08:20',
          { boardingTime: '06:30', terminal: 'D', seat: '8F', bookingRef: 'X7K2QP' }),
        flight('紐西蘭航空', 'NZ 77', AKL, TPE, day(6), '10:00', day(6), '16:30',
          { boardingTime: '09:15', terminal: 'I', seat: '38K', bookingRef: 'X7K2QP' }),
      ],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
  }

  // ---------- Actions ----------

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const route = parseRoute();
    const trip = route.name === 'trip' ? findTrip(route.id) : null;
    const dayIdx = trip ? clampDay(trip, route.day) : 0;

    switch (el.dataset.action) {
      case 'new-trip':
        openTripForm(null);
        break;
      case 'load-sample': {
        const created = sampleTrip();
        state.trips.push(JSON.parse(JSON.stringify(created)));
        save();
        // 在首頁載入就留在首頁，直接看到效果
        if (route.name === 'home') render();
        else location.hash = tripHref(created);
        break;
      }
      case 'new-flight':
        openFlightForm(trip, null);
        break;
      case 'edit-flight': {
        const flight = trip.flights.find((f) => f.id === el.dataset.id);
        if (flight) openFlightForm(trip, flight);
        break;
      }
      case 'edit-trip':
        openTripForm(trip);
        break;
      case 'new-activity':
        openActivityForm(trip, dayIdx, null);
        break;
      case 'edit-activity': {
        const activity = trip.days[dayIdx].activities.find((a) => a.id === el.dataset.id);
        if (activity) openActivityForm(trip, dayIdx, activity);
        break;
      }
      case 'sort-time': {
        // 有時間的依時間排序，沒時間的保持原順序放在最後
        const list = trip.days[dayIdx].activities;
        const timed = list.filter((a) => a.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
        trip.days[dayIdx].activities = [...timed, ...list.filter((a) => !a.startTime)];
        touch(trip);
        render();
        toast('已依時間排序');
        break;
      }
    }
  });

  window.addEventListener('hashchange', () => {
    if (sheet.open) sheet.close();
    render();
    window.scrollTo(0, 0);
  });

  render();
})();
