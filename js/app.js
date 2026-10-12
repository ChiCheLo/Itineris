import * as data from './data.js';

(() => {
  // 原型版存在 localStorage 的資料：第一次登入時自動上傳到帳號（D-041），之後只當備份不再使用
  const LEGACY_KEY = 'travelplan.v1';
  const CURRENT_TRIP_KEY = 'itineris.currentTrip';
  const MAX_ACTIVITIES_PER_DAY = 100;
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
  // 抵達後是否轉機、轉機要不要入境（D-065，兩人共用，存在機票上）
  const TRANSIT = {
    none: { option: '不是轉機' },
    enter: { option: '轉機，需要入境', label: '轉機・需要入境', note: '要過海關、領行李後再轉機' },
    airside: { option: '轉機，不用入境', label: '轉機・不用入境', note: '留在管制區直接轉機' },
  };
  // 共用資料只認得這三種值，其他一律當成「不是轉機」
  const transitOf = (f) => (Object.hasOwn(TRANSIT, f.transit) ? f.transit : 'none');
  const CURRENCY_NAMES = {
    TWD: '台幣', NZD: '紐幣', JPY: '日圓', KRW: '韓元', USD: '美元', EUR: '歐元',
    THB: '泰銖', HKD: '港幣', CNY: '人民幣', SGD: '新幣', GBP: '英鎊',
  };

  const PREP_GROUPS = [
    { key: 'packing', label: '攜帶物品', placeholder: '新增物品，例：轉接頭' },
    { key: 'passport', label: '護照', placeholder: '新增項目，例：護照影本' },
    { key: 'visa', label: '簽證與入境資料', placeholder: '新增項目，例：NZeTA 電子旅行授權' },
  ];

  const app = document.getElementById('app');
  const tabbar = document.getElementById('tabbar');
  const appbar = document.getElementById('appbar');
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
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    checks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    transfer: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  };

  const icon = (name, size = 20) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  // ---------- 資料 ----------
  // state 是畫面用的資料；改完呼叫 save()，data.js 會比對出改了哪些文件再寫到 Firestore。
  // 旅伴的修改由 data.js 即時監聽後交給 applyRemote()。

  const state = {
    trips: [],
    personal: {},        // tripId → { carried, shopping }：只有自己看得到（D-025）
    invitations: [],     // 用 Gmail 邀請我、還沒加入的旅程
    currentTripId: readLocal(CURRENT_TRIP_KEY),
  };
  let user = null;       // 目前登入的 Google 帳號
  let ready = false;     // 第一次從雲端讀完資料了沒
  let pendingRemote = null;

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 無痕模式等情況，不影響主要功能 */ }
  }

  function save() {
    data.saveAll(state);
  }

  const me = () => user?.uid;

  // ---------- Utils ----------

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

  // 幣別來自共用的旅程資料，一律跳脫（資安檢查：XSS）
  const fmtMoney = (n, currency) => `${esc(currency)} ${(Number(n) || 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;

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
  // 行程花費預設除以成員人數（D-043）
  const membersOf = (trip) => (trip.members?.length ? trip.members : [me()]);
  const memberName = (trip, uid) => trip.memberProfiles?.[uid]?.name || '旅伴';
  const isOwner = (trip) => !trip.ownerId || trip.ownerId === me();

  // 共用資料可能被旅伴改成奇怪的格式：花費一律轉成數字、分攤名單一定是陣列，格式不對就當成「全部平分」，
  // 避免畫面因此當掉（資安檢查：別人不能藉由亂寫資料讓你的 App 打不開）
  const costOf = (a) => {
    const n = Number(a.cost);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const splitUids = (s) => (Array.isArray(s?.uids) ? s.uids.filter((u) => typeof u === 'string') : []);
  const hasTime = (a) => typeof a.startTime === 'string' && a.startTime !== '';

  // 這筆花費算在我身上多少：全部平分／部分人分攤／個人開銷
  function myShare(a, trip) {
    const cost = costOf(a);
    if (!cost) return 0;
    const s = a.split;
    if (s?.type === 'self') return s.uid === me() ? cost : 0;
    if (s?.type === 'some' && splitUids(s).length) return splitUids(s).includes(me()) ? cost / splitUids(s).length : 0;
    return cost / membersOf(trip).length;
  }

  function touch() {
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
    const before = JSON.stringify({ trips: state.trips, personal: state.personal });
    return () => {
      Object.assign(state, JSON.parse(before));
      save();
      render();
    };
  }

  // ---------- Routing ----------
  // #/                 首頁：現在時間、機票、當下行程
  // #/prep             準備清單
  // #/shop             購買清單與預算
  // #/trips            旅程列表
  // #/trip/:id/:day    旅程詳情（day 從 0 起算）＝「行程」分頁
  // #/join/:id/:code   邀請連結：登入後加入旅程

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'trip' && parts[1]) {
      return { name: 'trip', id: decodeURIComponent(parts[1]), day: Number(parts[2]) || 0 };
    }
    if (parts[0] === 'join' && parts[1] && parts[2]) {
      return { name: 'join', id: decodeURIComponent(parts[1]), code: decodeURIComponent(parts[2]) };
    }
    if (parts[0] === 'trips') return { name: 'list' };
    if (parts[0] === 'prep') return { name: 'prep' };
    if (parts[0] === 'shop') return { name: 'shop' };
    return { name: 'home' };
  }

  const tripHref = (trip, day = 0) => `#/trip/${encodeURIComponent(trip.id)}/${day}`;
  const clampDay = (trip, day) => Math.min(Math.max(day, 0), trip.days.length - 1);
  const todayIndex = (trip) => Math.max(trip.days.findIndex((d) => d.date === todayISO()), 0);

  function render() {
    const route = parseRoute();
    app.classList.toggle('is-home', route.name === 'home' && !!user && ready);
    // 一定要先登入（D-045）；讀完雲端資料前先顯示載入中
    tabbar.hidden = !user || !ready || route.name === 'join';
    renderAppbar();
    if (!user) {
      renderLogin(route);
      return;
    }
    if (!ready) {
      renderLoading();
      return;
    }
    if (route.name === 'join') {
      renderJoin(route);
      return;
    }
    if (route.name === 'trip') {
      const trip = findTrip(route.id);
      if (!trip) {
        location.hash = '#/trips';
        return;
      }
      // 從旅程列表點進哪一趟，其他分頁就跟著顯示那一趟（記在這支手機）
      if (state.currentTripId !== trip.id) {
        state.currentTripId = trip.id;
        writeLocal(CURRENT_TRIP_KEY, trip.id);
      }
      renderTrip(trip, clampDay(trip, route.day));
    } else if (route.name === 'list') {
      renderList();
    } else if (route.name === 'prep') {
      renderPrep();
    } else if (route.name === 'shop') {
      renderShop();
    } else {
      renderHome();
    }
    renderTabbar(route);
  }

  // Logo 字（使用者提供的 LOGO字.png；深色模式換成淺藍版，CSS 依主題切換）
  const BRAND_LOGO = `
    <span class="brand-logo" role="img" aria-label="Itineris">
      <img class="logo-light" src="assets/logo-wordmark.png" alt="" width="600" height="202">
      <img class="logo-dark" src="assets/logo-wordmark-dark.png" alt="" width="600" height="202">
    </span>`;

  // ---------- 標題列：Logo＋帳號選單（D-056） ----------
  // 登入後固定在所有頁面最上方；只在換帳號時重畫，避免同步資料時把打開的選單關掉

  function renderAppbar() {
    if (!user || !ready) {
      appbar.hidden = true;
      delete appbar.dataset.uid;
      return;
    }
    appbar.hidden = false;
    if (appbar.dataset.uid === user.uid) return;
    appbar.dataset.uid = user.uid;
    const name = user.displayName || user.email || '我';
    const avatar = user.photoURL
      ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer" width="32" height="32">`
      : esc(name.slice(0, 1));
    appbar.innerHTML = `
      <div class="appbar-inner">
        <a class="appbar-brand" href="#/" aria-label="Itineris 首頁">${BRAND_LOGO}</a>
        <div class="account-menu">
          <button class="account-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="account-pop" aria-label="帳號：${esc(name)}">
            <span class="avatar">${avatar}</span>
          </button>
          <div class="account-pop" id="account-pop" hidden>
            <div class="account-info">
              <span class="account-name">${esc(name)}</span>
              <span class="account-email">${esc(user.email || '')}</span>
            </div>
            <button class="btn secondary" type="button" data-appbar="sign-out">登出</button>
          </div>
        </div>
      </div>`;
  }

  function setAccountMenu(open) {
    const btn = appbar.querySelector('.account-btn');
    const pop = appbar.querySelector('.account-pop');
    if (!btn || !pop) return;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) pop.querySelector('button')?.focus();
  }

  appbar.addEventListener('click', (e) => {
    if (e.target.closest('.account-btn')) {
      setAccountMenu(appbar.querySelector('.account-pop').hidden);
      return;
    }
    if (e.target.closest('[data-appbar="sign-out"]')) {
      setAccountMenu(false);
      data.signOutUser().then(() => {
        location.hash = '#/';
        toast('已登出');
      });
    }
  });

  // 點選單外面或按 Esc 就關掉
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account-menu')) setAccountMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !appbar.querySelector('.account-pop')?.hidden) {
      setAccountMenu(false);
      appbar.querySelector('.account-btn')?.focus();
    }
  });

  // ---------- 登入（只用 Google，D-036） ----------

  function renderLogin(route) {
    document.title = '登入 · Itineris';
    const joining = route.name === 'join';
    app.innerHTML = `
      <div class="login">
        ${BRAND_LOGO}
        <h1 class="login-title">把機票、行程與預算<br>放在同一個地方</h1>
        <p class="login-text">${joining
          ? '你收到一趟旅程的邀請。用 Google 帳號登入後就會加入。'
          : '用 Google 帳號登入，兩支手機就能看同一份行程；預算、購買清單和證件只有你自己看得到。'}</p>
        <button class="btn primary login-btn" type="button" data-action="sign-in">${GOOGLE_ICON}用 Google 登入</button>
        <p class="form-error" id="login-error" role="alert" hidden></p>
        <p class="login-note">Itineris 不會看到或儲存你的 Google 密碼。</p>
      </div>`;
  }

  const GOOGLE_ICON = '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>';

  function renderLoading() {
    app.innerHTML = '<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>正在讀取你的旅程…</div>';
  }

  // ---------- 邀請連結：#/join/:id/:code ----------

  let joinAttempt = '';
  function renderJoin(route) {
    if (findTrip(route.id)) {
      // 已經是成員了
      location.replace(tripHref(findTrip(route.id)));
      return;
    }
    app.innerHTML = '<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>正在加入旅程…</div>';
    const key = `${route.id}/${route.code}`;
    if (joinAttempt === key) return;
    joinAttempt = key;
    data.joinByInvite(route.id, route.code)
      .then(() => toast('已加入旅程'))
      .catch(() => {
        app.innerHTML = `
          <header class="page-head"><div><h1>無法加入</h1></div></header>
          <div class="empty">
            <strong>邀請連結無效或已過期</strong>
            <p>請旅伴重新產生一個邀請連結傳給你。邀請連結的有效期限是 7 天。</p>
            <div class="empty-actions"><a class="btn primary" href="#/">回到首頁</a></div>
          </div>`;
      });
  }

  // 加入成功後，旅程會出現在 state（雲端同步進來），這時再跳過去
  function finishJoin() {
    const route = parseRoute();
    if (route.name === 'join' && findTrip(route.id)) location.replace(tripHref(findTrip(route.id)));
  }

  // ---------- Gmail 邀請：還沒加入的旅程 ----------

  function invitationBanner() {
    if (!state.invitations.length) return '';
    return `<div class="invites">${state.invitations.map((inv) => `
      <div class="invite-card">
        <div class="invite-text">
          <span class="invite-label">${esc(inv.ownerName || '旅伴')} 邀請你加入</span>
          <strong>${esc(inv.title)}</strong>
          <span class="trip-meta">${esc(inv.destination)} · ${fmtShort(inv.startDate)} – ${fmtShort(inv.endDate)}</span>
        </div>
        <button class="btn primary small" type="button" data-action="accept-invite" data-id="${esc(inv.id)}">加入</button>
      </div>`).join('')}</div>`;
  }

  // ---------- 雲端同步進來的資料 ----------

  // 編輯面板開著時先不套用，等關掉再套，避免蓋掉正在填的內容
  function applyRemote(snap) {
    if (sheet.open) {
      pendingRemote = snap;
      return;
    }
    pendingRemote = null;
    const wasReady = ready;
    ready = true;
    const changed = data.stable({ t: state.trips, p: state.personal, i: state.invitations })
      !== data.stable({ t: snap.trips, p: snap.personal, i: snap.invitations });
    if (changed) {
      state.trips = snap.trips;
      state.personal = snap.personal;
      state.invitations = snap.invitations;
    }
    if (!wasReady) migrateLegacy();
    if (changed || !wasReady) {
      render();
      finishJoin();
    }
  }

  sheet.addEventListener('close', () => {
    if (pendingRemote) applyRemote(pendingRemote);
  });

  // 原型存在這支手機的資料：第一次登入時上傳到帳號（D-041）。
  // 一支手機只做一次、只給第一個登入的帳號，共用手機時別人的舊資料不會被上傳到你的帳號
  function migrateLegacy() {
    const flag = 'itineris.legacyUploadedBy';
    if (readLocal(flag)) return;
    writeLocal(flag, me());
    let old;
    try { old = JSON.parse(readLocal(LEGACY_KEY) || 'null'); } catch { old = null; }
    const oldTrips = Array.isArray(old?.trips) ? old.trips : [];
    let count = 0;
    for (const t of oldTrips) {
      if (!t?.id || findTrip(t.id) || !t.startDate || !t.endDate) continue;
      state.trips.push({
        id: t.id,
        title: String(t.title || '未命名旅程').slice(0, 60),
        destination: String(t.destination || '未填目的地').slice(0, 60),
        startDate: t.startDate,
        endDate: t.endDate,
        currency: t.currency || 'TWD',
        ownerId: me(),
        members: [me()],
        memberProfiles: {},
        invitedEmails: [],
        days: (t.days || []).map((d) => ({ date: d.date, activities: d.activities || [] })),
        flights: t.flights || [],
        prep: {
          packing: t.prep?.packing || [],
          passport: t.prep?.passport || [data.DEFAULT_PASSPORT],
          visa: t.prep?.visa || [],
        },
      });
      const p = old.personal?.[t.id];
      if (p) state.personal[t.id] = { carried: p.carried || {}, shopping: p.shopping || [] };
      count++;
    }
    if (count) {
      save();
      toast(`已把這支手機上的 ${count} 趟旅程上傳到你的帳號`);
    }
  }

  // ---------- 標籤列 ----------

  function renderTabbar(route) {
    const trip = currentTrip();
    const tabs = [
      { name: 'home', label: '首頁', icon: 'home', href: '#/' },
      { name: 'prep', label: '準備清單', icon: 'checks', href: '#/prep' },
      { name: 'trip', label: '行程', icon: 'calendar', href: trip ? tripHref(trip, todayIndex(trip)) : '#/trips' },
      { name: 'shop', label: '購買・預算', icon: 'bag', href: '#/shop' },
    ];
    tabbar.innerHTML = `<div class="tabbar-inner">${tabs.map((t) => `
      <a class="tab" href="${t.href}"${t.name === route.name ? ' aria-current="page"' : ''}>
        ${icon(t.icon, 22)}<span>${t.label}</span>
      </a>`).join('')}</div>`;
  }

  // 沒有旅程時，準備清單、購買・預算共用的空狀態
  function noTripEmpty(title) {
    return `
      <header class="page-head"><div><h1>${title}</h1></div></header>
      <div class="empty">
        <strong>還沒有旅程</strong>
        <p>先建立一趟旅程，才能開始整理。</p>
        <div class="empty-actions">
          <button class="btn primary" type="button" data-action="new-trip">${icon('plus', 18)}建立旅程</button>
          <button class="btn secondary" type="button" data-action="load-sample">看範例行程</button>
        </div>
      </div>`;
  }

  // ---------- 首頁 ----------
  // 打開 App 第一眼：現在時間 → 機票 → 當下行程

  // 使用者選過的旅程優先；沒有的話自動挑
  function currentTrip() {
    return findTrip(state.currentTripId) || homeTrip();
  }

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
      const timed = d.activities.filter(hasTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
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
    document.title = 'Itineris 行程規劃';
    const today = todayISO();
    const trip = currentTrip();

    const clock = `
      <section class="home-clock" aria-label="現在時間">
        <time class="clock" datetime="${nowKey()}">${nowTime()}</time>
        <p class="clock-date">${fmtLongDate(today)}</p>
      </section>`;

    if (!trip) {
      app.innerHTML = `
        <div class="home">
          ${homeTop()}
          ${invitationBanner()}
          ${clock}
          <div class="empty home-empty">
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
        ${invitationBanner()}
        ${clock}
        <a class="home-trip" href="${tripHref(trip, Math.max(todayIdx, 0))}">
          <span class="home-trip-text">
            ${status.cls === 'ongoing' ? '<span class="home-trip-label">進行中的旅程</span>' : ''}
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
        ${costTag(a, trip)}
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

  // ---------- 準備清單 ----------
  // 全部用勾選，App 不做判斷

  function prepOf(trip) {
    if (!trip.prep) {
      trip.prep = { packing: [], passport: [{ id: uid(), text: '護照效期已確認', done: false }], visa: [] };
    }
    return trip.prep;
  }

  function renderPrep() {
    document.title = '準備清單 · Itineris';
    const trip = currentTrip();
    if (!trip) {
      app.innerHTML = noTripEmpty('準備清單');
      return;
    }
    const prep = prepOf(trip);
    const all = PREP_GROUPS.flatMap((g) => prep[g.key]);
    const done = all.filter((x) => x.done).length;
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;

    app.innerHTML = `
      <header class="page-head">
        <div>
          <h1>準備清單</h1>
          <p>${esc(trip.title)} · ${tripStatus(trip).label}</p>
        </div>
      </header>

      <div class="prep-progress">
        <div class="prep-progress-text"><span>已完成</span><strong>${done} / ${all.length}</strong></div>
        <div class="progress" role="progressbar" aria-label="準備進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
          <span style="width:${pct}%"></span>
        </div>
      </div>

      ${PREP_GROUPS.map((g) => checkGroup(g, prep[g.key])).join('')}
    `;
  }

  function checkGroup(g, items) {
    const done = items.filter((x) => x.done).length;
    return `
      <section class="check-group" aria-labelledby="group-${g.key}">
        <div class="check-group-head">
          <h2 id="group-${g.key}">${g.label}</h2>
          <span class="check-count">${done} / ${items.length}</span>
        </div>
        ${items.length ? `<ul class="check-list">${items.map((x) => `
          <li class="check-item">
            <label>
              <input type="checkbox" data-check="${g.key}" data-id="${esc(x.id)}"${x.done ? ' checked' : ''}>
              <span>${esc(x.text)}</span>
            </label>
            <button class="icon-btn subtle" type="button" data-action="check-delete" data-group="${g.key}" data-id="${esc(x.id)}" aria-label="刪除「${esc(x.text)}」">${icon('trash', 18)}</button>
          </li>`).join('')}</ul>` : ''}
        <form class="check-add" data-group="${g.key}">
          <input name="text" maxlength="80" placeholder="${g.placeholder}" autocomplete="off" aria-label="新增到${g.label}">
          <button class="btn secondary small" type="submit">${icon('plus', 16)}新增</button>
        </form>
      </section>`;
  }

  // ---------- 購買清單與預算 ----------

  // 預算用台幣 + 目的地貨幣
  const budgetCurrencies = (trip) => [...new Set(['TWD', trip.currency])];
  const curName = (c) => esc(`${CURRENCY_NAMES[c] || c} ${c}`);

  function personalOf(trip) {
    if (!state.personal[trip.id]) state.personal[trip.id] = { carried: {}, shopping: [] };
    return state.personal[trip.id];
  }

  // 購買清單：勾了「已買」的才算
  function shopSpentIn(p, c) {
    return p.shopping.filter((x) => x.done && x.currency === c).reduce((s, x) => s + (x.price || 0), 0);
  }

  // 行程：活動上有填花費的都算（包含住宿），幣別是旅程設定的幣別
  // total＝行程上顯示的全額；mine＝依分攤方式算在我身上的部分（D-030、D-043）
  function tripSpentIn(trip, c) {
    if (trip.currency !== c) return { total: 0, mine: 0 };
    let total = 0;
    let mine = 0;
    for (const d of trip.days) {
      for (const a of d.activities) {
        total += costOf(a);
        mine += myShare(a, trip);
      }
    }
    return { total, mine };
  }

  function renderShop() {
    document.title = '購買・預算 · Itineris';
    const trip = currentTrip();
    if (!trip) {
      app.innerHTML = noTripEmpty('購買・預算');
      return;
    }
    const p = personalOf(trip);
    const currencies = budgetCurrencies(trip);
    const bought = p.shopping.filter((x) => x.done).length;

    const budgetCard = (c) => {
      const carried = p.carried[c] || 0;
      // 行程花費依分攤方式算出我的部分；購買清單本來就是個人的，不用分
      const { total: tripTotal, mine: fromTrip } = tripSpentIn(trip, c);
      const fromShop = shopSpentIn(p, c);
      const spent = fromTrip + fromShop;
      const left = carried - spent;
      const pct = carried > 0 ? Math.min(100, Math.round((spent / carried) * 100)) : 0;
      return `
        <section class="budget-card" aria-label="${curName(c)}">
          <div class="budget-head">
            <h2>${curName(c)}</h2>
            <span class="budget-left${left < 0 ? ' over' : ''}">${left < 0 ? '超支' : '剩下'} ${fmtMoney(Math.abs(left), c)}</span>
          </div>
          <div class="budget-row">
            <label class="budget-field"><span>帶了</span>
              <input type="number" min="0" step="any" inputmode="decimal" data-carried="${esc(c)}" value="${esc(carried || '')}" placeholder="0">
            </label>
            <div class="budget-field"><span>花了</span><strong>${fmtMoney(spent, c)}</strong></div>
          </div>
          <p class="budget-breakdown">行程（我的分攤）${fmtMoney(fromTrip, c)}${tripTotal && tripTotal !== fromTrip ? `，全額 ${fmtMoney(tripTotal, c)}` : ''} · 購買 ${fmtMoney(fromShop, c)}</p>
          <div class="progress${left < 0 ? ' over' : ''}" role="progressbar" aria-label="${curName(c)} 已花比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
            <span style="width:${left < 0 ? 100 : pct}%"></span>
          </div>
        </section>`;
    };

    app.innerHTML = `
      <header class="page-head">
        <div>
          <h1>購買・預算</h1>
          <p>${esc(trip.title)} · 只存在這支手機，不會給旅伴看</p>
        </div>
      </header>

      <div class="budget-grid">${currencies.map(budgetCard).join('')}</div>

      <section class="check-group" aria-labelledby="group-shop">
        <div class="check-group-head">
          <h2 id="group-shop">購買清單</h2>
          <span class="check-count">已買 ${bought} / ${p.shopping.length}</span>
        </div>
        ${p.shopping.length ? `<ul class="check-list">${p.shopping.map((x) => `
          <li class="check-item">
            <label>
              <input type="checkbox" data-buy="${esc(x.id)}"${x.done ? ' checked' : ''}>
              <span>${esc(x.name)}</span>
            </label>
            <span class="shop-price">${x.price != null ? fmtMoney(x.price, x.currency) : '—'}</span>
            <button class="icon-btn subtle" type="button" data-action="shop-delete" data-id="${esc(x.id)}" aria-label="刪除「${esc(x.name)}」">${icon('trash', 18)}</button>
          </li>`).join('')}</ul>` : ''}
        <form class="shop-add">
          <input name="name" maxlength="60" placeholder="品名，例：麥蘆卡蜂蜜" autocomplete="off" aria-label="品名">
          <div class="shop-add-row">
            <input name="price" type="number" min="0" step="any" inputmode="decimal" placeholder="價格" aria-label="價格">
            ${currencies.length > 1
              ? `<select name="currency" aria-label="幣別">${currencies.map((c) => `<option value="${c}"${c === trip.currency ? ' selected' : ''}>${c}</option>`).join('')}</select>`
              : `<input type="hidden" name="currency" value="${esc(currencies[0])}">`}
            <button class="btn secondary small" type="submit">${icon('plus', 16)}新增</button>
          </div>
          <p class="form-error" role="alert" hidden></p>
        </form>
        <p class="shop-hint">行程上填的花費（包含住宿），以及這裡勾選「已買」的項目，都會算進上方的「花了」。</p>
      </section>`;
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
            ${transitOf(f) !== 'none'
              ? `<p class="bp-transit" data-transit="${transitOf(f)}">${icon('transfer', 16)}<span><strong>${TRANSIT[transitOf(f)].label}</strong>${TRANSIT[transitOf(f)].note}</span></p>`
              : ''}
            <label class="bp-check">
              <input type="checkbox" data-flight-check="${esc(f.id)}"${f.fastTrack ? ' checked' : ''}>
              <span>入境可走快速通關</span>
            </label>
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
    document.title = 'Itineris 行程規劃';
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
      ${invitationBanner()}
      ${trips.length
        ? `<ul class="trip-grid">${trips.map(tripCard).join('')}</ul>`
        : `<div class="empty">
             <strong>還沒有旅程</strong>
             <p>建立一趟旅程，選好日期後就能逐日安排景點、餐廳與交通。</p>
             <div class="empty-actions">
               <button class="btn primary" type="button" data-action="new-trip">${icon('plus', 18)}建立第一趟旅程</button>
               <button class="btn secondary" type="button" data-action="load-sample">看範例行程</button>
             </div>
           </div>`}
      <p class="list-footer">資料存在你的 Google 帳號（Firebase），兩支手機登入同一趟旅程就會同步。</p>
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
    const dayCost = day.activities.reduce((s, a) => s + costOf(a), 0);
    document.title = `${trip.title} · Itineris`;

    app.innerHTML = `
      <header class="topbar">
        <a class="icon-btn back" href="#/trips" aria-label="返回旅程列表">${icon('back', 24)}</a>
        <div class="topbar-title">
          <h1>${esc(trip.title)}</h1>
          <p>${esc(trip.destination)} · ${fmtShort(trip.startDate)} – ${fmtShort(trip.endDate)}</p>
        </div>
        <button class="btn ghost small members-btn" type="button" data-action="members" aria-label="成員 ${membersOf(trip).length} 人">${icon('users', 18)}<span aria-hidden="true">${membersOf(trip).length}</span></button>
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

      <div class="trip-search" role="search">
        <label class="search-field">
          ${icon('search', 18)}
          <input type="search" id="trip-search" value="${esc(searchQuery)}" placeholder="查詢行程：名稱、地點、備註" autocomplete="off" aria-label="查詢行程">
        </label>
      </div>
      <div id="search-results" hidden></div>

      <div id="day-view">
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
               <strong>這天還沒有安排</strong>
               <p>新增景點、三餐、住宿或交通。有填開始時間的活動會自動依時間排好；沒填時間的放在最後，可以按住左側把手拖曳調整。</p>
             </div>`}

        ${dayCost > 0 ? `<div class="day-summary"><span>本日花費</span><strong>${fmtMoney(dayCost, trip.currency)}</strong></div>` : ''}

        <button class="btn primary block" type="button" data-action="new-activity">${icon('plus', 20)}新增活動</button>
      </section>
      </div>
    `;

    const active = app.querySelector('.day-tab.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (searchQuery) showSearch(trip);

    const list = document.getElementById('activity-list');
    if (list) {
      enableDrag(list, (ids) => {
        const byId = new Map(day.activities.map((a) => [a.id, a]));
        day.activities = ids.map((id) => byId.get(id));
        touch(trip);
      });
    }
  }

  // 有花費的活動加上標註；這些花費會算進「購買・預算」的花了多少
  const costTag = (a, trip) =>
    costOf(a) ? `<span class="cost-tag">${icon('wallet', 14)}<span>花費 ${fmtMoney(costOf(a), trip.currency)}${splitLabel(a, trip)}</span></span>` : '';

  // 行程上顯示全額，另外標出分攤方式（只有一個成員時不標）
  // 旅伴的顯示名稱是對方自己可以改的資料，一定要跳脫（資安檢查：儲存型 XSS）
  function splitLabel(a, trip) {
    if (membersOf(trip).length < 2) return '';
    if (a.split?.type === 'self') return ` · ${a.split.uid === me() ? '我' : esc(memberName(trip, a.split.uid))}的個人開銷`;
    if (a.split?.type === 'some' && splitUids(a.split).length) return ` · ${splitUids(a.split).length} 人分攤`;
    return ` · ${membersOf(trip).length} 人平分`;
  }

  // 有開始時間的依時間排，沒有時間的保持原順序放在最後
  function sortByTime(list) {
    const timed = list.filter(hasTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return [...timed, ...list.filter((a) => !hasTime(a))];
  }

  // ---------- 查詢行程 ----------
  // 在整趟旅程的所有天裡找名稱、地點、備註、類型

  let searchQuery = '';

  function showSearch(trip) {
    const results = document.getElementById('search-results');
    const dayView = document.getElementById('day-view');
    const q = searchQuery.trim().toLowerCase();
    results.hidden = !q;
    dayView.hidden = !!q;
    if (!q) return;

    const hits = [];
    trip.days.forEach((d, dayIdx) => d.activities.forEach((a) => {
      const text = [a.title, a.location?.name, a.note, TYPES[a.type]].filter(Boolean).join(' ').toLowerCase();
      if (text.includes(q)) hits.push({ a, d, dayIdx });
    }));

    results.innerHTML = hits.length
      ? `<p class="search-count" role="status">找到 ${hits.length} 個行程</p>
         <div class="now-list">${hits.map(({ a, d, dayIdx }) => {
           const type = TYPES[a.type] ? a.type : 'other';
           return `
             <a class="now-card search-hit" href="${tripHref(trip, dayIdx)}" data-type="${type}">
               <span class="now-top">
                 <span class="now-label">Day ${dayIdx + 1} · ${fmtShort(d.date)}</span>
                 <span class="type-tag">${TYPES[type]}</span>
               </span>
               <span class="now-time">${esc(fmtTime(a))}</span>
               <span class="now-title">${esc(a.title)}</span>
               ${a.location?.name ? `<span class="activity-meta">${icon('pin', 14)}<span>${esc(a.location.name)}</span></span>` : ''}
               ${costTag(a, trip)}
             </a>`;
         }).join('')}</div>`
      : `<div class="empty compact" role="status"><p>找不到和「${esc(searchQuery.trim())}」有關的行程。</p></div>`;
  }

  // 時間軸左欄：開始時間在上、結束時間在下
  function actTime(a) {
    if (a.startTime) return `<span>${esc(a.startTime)}</span>${a.endTime ? `<span class="end">${esc(a.endTime)}</span>` : ''}`;
    if (a.endTime) return `<span class="end">～${esc(a.endTime)}</span>`;
    return '<span class="none">未定</span>';
  }

  function activityItem(a, trip) {
    const type = TYPES[a.type] ? a.type : 'other';
    return `
      <li class="activity" data-id="${esc(a.id)}" data-type="${type}">
        <div class="act-time" aria-hidden="true">${actTime(a)}</div>
        <div class="act-rail" aria-hidden="true"></div>
        <button class="activity-body" type="button" data-action="edit-activity" data-id="${esc(a.id)}">
          <span class="sr-only">${esc(fmtTime(a))}</span>
          <span class="activity-top">
            <span class="type-tag">${TYPES[type]}</span>
          </span>
          <span class="activity-title">${esc(a.title)}</span>
          ${a.location?.name ? `<span class="activity-meta">${icon('pin', 14)}<span>${esc(a.location.name)}</span></span>` : ''}
          ${a.note ? `<span class="activity-note">${esc(a.note)}</span>` : ''}
          ${costTag(a, trip)}
        </button>
        <button class="drag-handle" type="button" aria-label="拖曳排序：${esc(a.title)}">${icon('grip', 18)}</button>
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

  // 關閉面板：先播「往下滑出去」的動畫再真的關（打開是往上滑進來）。
  // 收起比打開快（240ms vs 360ms）；開啟「減少動態效果」時直接關
  const SHEET_CLOSE_MS = 240;
  let sheetCloseTimer;
  function closeSheet() {
    if (!sheet.open || sheet.classList.contains('is-closing')) return;
    if (reducedMotion()) {
      sheet.close();
      return;
    }
    sheet.classList.add('is-closing');
    sheetCloseTimer = setTimeout(() => {
      sheet.classList.remove('is-closing');
      if (sheet.open) sheet.close();
    }, SHEET_CLOSE_MS);
  }

  // Esc 鍵、Android 返回鍵也走同一個動畫
  sheet.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeSheet();
  });

  function openSheet(title, body, { onSubmit, actions = {}, deleteLabel, submitLabel }) {
    // 正在往下關的時候又要打開：取消關閉
    clearTimeout(sheetCloseTimer);
    sheet.classList.remove('is-closing');
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
      if (result === false) return; // 回傳 false：面板保持開著、不顯示錯誤
      if (typeof result === 'string') {
        errorEl.innerHTML = `${icon('alert', 16)}<span>${esc(result)}</span>`;
        errorEl.hidden = false;
      } else {
        closeSheet();
      }
    });
    // 已經開著時只換內容（例如成員面板新增邀請後重畫）
    if (!sheet.open) sheet.showModal();
  }

  sheet.addEventListener('click', (e) => {
    // 點到 dialog 本身代表點在遮罩上
    if (e.target === sheet || e.target.closest('[data-close]')) {
      closeSheet();
      return;
    }
    const btn = e.target.closest('[data-sheet-action]');
    if (btn && sheetActions[btn.dataset.sheetAction]) sheetActions[btn.dataset.sheetAction](btn);
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
      ${pickerGroup(pickerTrigger('range-start', 'startDate', '出發日', t.startDate) + pickerTrigger('range-end', 'endDate', '回程日', t.endDate))}
      <label class="field"><span>幣別</span>
        <select name="currency">
          ${CURRENCIES.map((c) => `<option${c === t.currency ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </label>
      <p class="field-hint">行程上的花費預設除以成員人數，再算進每個人的預算；部分人分攤或個人開銷可以在活動裡另外設定。</p>`, {
      submitLabel: isNew ? '建立旅程' : '儲存',
      // 只有建立者能刪除整趟旅程；旅伴只能退出（D-039）
      deleteLabel: isNew ? null : (isOwner(trip) ? '刪除旅程' : '退出旅程'),
      onSubmit: (fd) => {
        const fields = {
          title: fd.get('title').trim(),
          destination: fd.get('destination').trim(),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
          currency: fd.get('currency'),
        };
        if (!fields.title) return '請填寫旅程名稱';
        if (!fields.destination) return '請填寫目的地';
        if (!fields.startDate || !fields.endDate) return '請選擇出發日與回程日';
        if (fields.endDate < fields.startDate) return '回程日不能早於出發日';
        const dates = dateRange(fields.startDate, fields.endDate);
        if (dates.length > MAX_DAYS) return `一趟旅程最多 ${MAX_DAYS} 天`;

        if (isNew) {
          const created = {
            id: uid(),
            ...fields,
            ownerId: me(),
            members: [me()],
            memberProfiles: {},
            invitedEmails: [],
            days: dates.map((date) => ({ date, activities: [] })),
            flights: [],
            prep: { packing: [], passport: [data.DEFAULT_PASSPORT], visa: [] },
          };
          state.trips.push(created);
          save();
          location.hash = tripHref(created);
          return;
        }

        // 日期變更時依「第幾天」對應：Day 1 的活動仍留在 Day 1
        const undo = snapshot();
        const lost = trip.days.slice(dates.length).reduce((n, d) => n + d.activities.length, 0);
        Object.assign(trip, fields);
        trip.days = dates.map((date, i) => ({ date, activities: trip.days[i]?.activities || [] }));
        touch(trip);
        render();
        toast(lost ? `已更新旅程，移除了 ${lost} 個活動` : '已更新旅程', lost ? undo : null);
      },
      actions: {
        delete: () => {
          closeSheet();
          if (!isOwner(trip)) {
            data.leaveTrip(trip.id)
              .then(() => toast(`已退出「${trip.title}」`))
              .catch(() => toast('退出失敗，請確認網路後再試一次'));
            state.trips = state.trips.filter((x) => x.id !== trip.id);
            location.hash = '#/trips';
            return;
          }
          const undo = snapshot();
          state.trips = state.trips.filter((x) => x.id !== trip.id);
          save();
          location.hash = '#/trips';
          toast(`已刪除「${trip.title}」`, undo);
        },
      },
    });
  }

  // ---------- 成員與邀請（D-038：邀請連結、輸入 Gmail 兩種） ----------

  function openMembers(trip, inviteLink) {
    const members = membersOf(trip);
    openSheet('成員', `
      <ul class="member-list">
        ${members.map((u) => `
          <li class="member">
            <span class="avatar" aria-hidden="true">${esc(memberName(trip, u).slice(0, 1))}</span>
            <span class="member-name">${esc(u === me() ? `${user.displayName || '我'}（你）` : memberName(trip, u))}</span>
            ${u === trip.ownerId ? '<span class="badge">建立者</span>' : ''}
          </li>`).join('')}
        ${trip.invitedEmails.filter((e) => e !== user.email).map((e) => `
          <li class="member pending">
            <span class="avatar" aria-hidden="true">@</span>
            <span class="member-name">${esc(e)}<span class="member-sub">已邀請，等對方登入</span></span>
            <button class="icon-btn subtle" type="button" data-sheet-action="remove-email" data-email="${esc(e)}" aria-label="取消邀請 ${esc(e)}">${icon('close', 18)}</button>
          </li>`).join('')}
      </ul>

      <div class="field">
        <span>用 Gmail 邀請</span>
        <div class="inline-add">
          <input name="email" type="email" inputmode="email" autocomplete="off" placeholder="旅伴的 Gmail，例：friend@gmail.com" aria-label="旅伴的 Gmail">
          <button class="btn secondary small" type="button" data-sheet-action="add-email">${icon('plus', 16)}邀請</button>
        </div>
        <p class="field-hint">對方用這個 Google 帳號登入後，首頁會出現「加入」。</p>
      </div>

      <div class="field">
        <span>用邀請連結</span>
        ${inviteLink
          ? `<div class="invite-link">
               <input value="${esc(inviteLink)}" readonly aria-label="邀請連結">
               <button class="btn secondary small" type="button" data-sheet-action="copy-link">複製</button>
               ${navigator.share ? '<button class="btn secondary small" type="button" data-sheet-action="share-link">分享</button>' : ''}
             </div>
             <p class="field-hint">7 天內有效。傳給旅伴（例如用 LINE），對方點開登入後就會加入。</p>`
          : `<button class="btn secondary" type="button" data-sheet-action="create-link">${icon('plus', 16)}產生邀請連結</button>
             <p class="field-hint">連結 7 天內有效，任何拿到連結的人登入後都能加入，請只傳給旅伴。</p>`}
      </div>`, {
      submitLabel: '完成',
      // 在 Gmail 欄位按 Enter＝邀請，不要直接關掉面板
      onSubmit: (fd) => {
        if (String(fd.get('email') || '').trim()) {
          sheetActions['add-email']();
          return false;
        }
        return undefined;
      },
      actions: {
        'add-email': () => {
          const input = sheet.querySelector('input[name="email"]');
          const email = input.value.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showSheetError('請輸入正確的 Email，例如 friend@gmail.com');
            return;
          }
          if (email === user.email?.toLowerCase()) {
            showSheetError('這是你自己的帳號');
            return;
          }
          if (!trip.invitedEmails.includes(email)) {
            trip.invitedEmails.push(email);
            touch(trip);
          }
          openMembers(trip, inviteLink);
          toast(`已邀請 ${email}`);
        },
        'remove-email': (btn) => {
          trip.invitedEmails = trip.invitedEmails.filter((e) => e !== btn.dataset.email);
          touch(trip);
          openMembers(trip, inviteLink);
        },
        'create-link': () => {
          data.createInvite(trip.id)
            .then(({ code }) => {
              const link = `${location.origin}${location.pathname}${location.search}#/join/${encodeURIComponent(trip.id)}/${code}`;
              if (sheet.open) openMembers(trip, link);
            })
            .catch(() => showSheetError('無法產生邀請連結，請確認網路後再試一次'));
        },
        'copy-link': () => {
          navigator.clipboard?.writeText(inviteLink)
            .then(() => toast('已複製邀請連結'))
            .catch(() => {
              sheet.querySelector('.invite-link input')?.select();
              toast('請長按連結手動複製');
            });
        },
        'share-link': () => {
          navigator.share({ title: `加入「${trip.title}」`, text: `一起規劃「${trip.title}」`, url: inviteLink }).catch(() => {});
        },
      },
    });
  }

  // ---------- 日期／時間選取 ----------
  // 點欄位後在下方展開日曆或時間選項（不另外疊彈窗）。一組 .picker-group 共用一個展開區，
  // 值存在隱藏的 <input>，表單照常用 FormData 讀取。
  //   date：單一日期；range-start / range-end：旅程的出發日、回程日共用一個日曆；
  //   time：「時」「分」兩欄捲動清單，以 1 分鐘為刻度（每格 44px，60 個分鐘不用擠成小格子）

  function fmtPickerDate(str) {
    if (!str) return '';
    const d = parseDate(str);
    return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEKDAYS[d.getUTCDay()]}）`;
  }

  // 一個選取按鈕（外觀像輸入框）＋隱藏的值
  function pickerTrigger(kind, name, label, value, extra = '') {
    const placeholder = kind === 'time' ? '選擇時間' : '選擇日期';
    const shown = kind === 'time' ? value : fmtPickerDate(value);
    return `
      <div class="field">
        <span id="lbl-${name}">${label}</span>
        <button type="button" class="picker-btn${value ? '' : ' is-empty'}" data-picker="${kind}" data-target="${name}" aria-expanded="false" aria-labelledby="lbl-${name} val-${name}" ${extra}>
          ${icon(kind === 'time' ? 'clock' : 'calendar', 18)}<span class="picker-value" id="val-${name}">${esc(shown || placeholder)}</span>
        </button>
        <input type="hidden" name="${name}" value="${esc(value || '')}">
      </div>`;
  }

  // 展開區：外層 drawer 負責高度從 0 長出來，內層 panel 負責淡入與微微滑下；收起時 inert，鍵盤與點擊都碰不到
  const pickerGroup = (triggers) => `
    <div class="picker-group">
      <div class="field-row">${triggers}</div>
      <div class="picker-drawer" inert><div class="picker-drawer-inner"><div class="picker-panel"></div></div></div>
    </div>`;

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 動畫時間要跟 style.css 的 .picker-drawer 一致：展開 0.8 秒、收起 0.35 秒（D-054）
  const PICKER_OPEN_MS = 800;
  const PICKER_CLOSE_MS = 350;

  const pickerInput = (group, name) => group.querySelector(`input[name="${name}"]`);

  function setPickerValue(group, name, value) {
    pickerInput(group, name).value = value;
    const btn = group.querySelector(`[data-target="${name}"]`);
    btn.classList.toggle('is-empty', !value);
    btn.querySelector('.picker-value').textContent = btn.dataset.picker === 'time'
      ? (value || '選擇時間')
      : (fmtPickerDate(value) || '選擇日期');
  }

  function calendarHtml(group, btn) {
    const kind = btn.dataset.picker;
    const value = pickerInput(group, btn.dataset.target).value;
    const start = group.querySelector('[data-picker="range-start"]') ? pickerInput(group, 'startDate').value : '';
    const end = group.querySelector('[data-picker="range-end"]') ? pickerInput(group, 'endDate').value : '';
    // 日期下限：抵達日不能早於出發日；回程日不能早於出發日
    const minName = btn.dataset.min;
    const min = kind === 'range-end' ? start : (minName ? group.closest('form').querySelector(`input[name="${minName}"]`)?.value : '');
    const view = group.dataset.view || (value || min || todayISO()).slice(0, 7);
    group.dataset.view = view;
    const [y, m] = view.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const today = todayISO();

    const cells = [];
    for (let i = 0; i < first.getUTCDay(); i++) cells.push('<span class="cal-blank"></span>');
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${view}-${pad(d)}`;
      const isRange = kind.startsWith('range');
      const selected = isRange ? (date === start || date === end) : date === value;
      const inRange = isRange && start && end && date > start && date < end;
      const disabled = min && date < min;
      const cls = [
        'cal-day',
        selected && 'is-selected',
        inRange && 'in-range',
        isRange && date === start && end && 'range-start',
        isRange && date === end && start && 'range-end',
        date === today && 'is-today',
      ].filter(Boolean).join(' ');
      const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      cells.push(`<button type="button" class="${cls}" data-cal-day="${date}"${disabled ? ' disabled' : ''} aria-pressed="${selected}" aria-label="${y} 年 ${m} 月 ${d} 日 星期${wd}">${d}</button>`);
    }

    let hint = '';
    if (kind === 'range-start') hint = '選擇出發日';
    if (kind === 'range-end') hint = start ? '選擇回程日' : '先選出發日';
    if (start && end) hint += ` · 共 ${Math.round((parseDate(end) - parseDate(start)) / 86400000) + 1} 天`;

    return `
      <div class="cal-head">
        <button type="button" class="icon-btn" data-cal-nav="-1" aria-label="上個月">${icon('back', 20)}</button>
        <strong class="cal-title" aria-live="polite">${y} 年 ${m} 月</strong>
        <button type="button" class="icon-btn" data-cal-nav="1" aria-label="下個月">${icon('chevron', 20)}</button>
      </div>
      ${hint ? `<p class="picker-hint">${hint}</p>` : ''}
      <div class="cal-grid" role="group" aria-label="${y} 年 ${m} 月">
        ${WEEKDAYS.map((w) => `<span class="cal-wd" aria-hidden="true">${w}</span>`).join('')}
        ${cells.join('')}
      </div>`;
  }

  function timeHtml(group, btn) {
    const value = pickerInput(group, btn.dataset.target).value;
    const [h, mi] = value ? value.split(':') : ['', ''];
    const col = (attr, count, current, unit, label) => `
      <div class="time-col" role="group" aria-label="${label}">
        ${Array.from({ length: count }, (_, i) => pad(i)).map((v) =>
          `<button type="button" class="time-cell${v === current ? ' is-selected' : ''}" ${attr}="${v}" aria-pressed="${v === current}" aria-label="${Number(v)} ${unit}">${v}</button>`).join('')}
      </div>`;
    return `
      <div class="time-cols">
        <div><p class="picker-hint">時</p>${col('data-time-hour', 24, h, '點', '時')}</div>
        <span class="time-colon" aria-hidden="true">:</span>
        <div><p class="picker-hint">分</p>${col('data-time-minute', 60, mi, '分', '分')}</div>
      </div>
      <div class="picker-foot">
        <button type="button" class="btn ghost small" data-picker-clear>清除</button>
        <button type="button" class="btn secondary small" data-picker-done>完成</button>
      </div>`;
  }

  // 把選到的那一格捲到欄位中間
  function centerSelected(panel) {
    panel.querySelectorAll('.time-col').forEach((col) => {
      const sel = col.querySelector('.is-selected');
      if (sel) col.scrollTop = sel.offsetTop - col.offsetTop - (col.clientHeight - sel.offsetHeight) / 2;
    });
  }

  // effect：'swap' 同一組內換內容時淡入；'next'／'prev' 換月份時左右滑動
  function renderPicker(group, effect) {
    const btn = group.querySelector(`[data-target="${group.dataset.active}"]`);
    const panel = group.querySelector('.picker-panel');
    if (!btn) return;
    panel.innerHTML = btn.dataset.picker === 'time' ? timeHtml(group, btn) : calendarHtml(group, btn);
    if (btn.dataset.picker === 'time') centerSelected(panel);
    const target = effect === 'swap' ? panel : panel.querySelector('.cal-grid');
    if (effect && target && !reducedMotion()) {
      const name = { swap: 'picker-swap', next: 'cal-next', prev: 'cal-prev' }[effect];
      target.classList.remove('picker-swap', 'cal-next', 'cal-prev');
      void target.offsetWidth; // 重新觸發動畫
      target.classList.add(name);
    }
  }

  // 時間：只換選取樣式，不重畫，捲動位置才不會跳掉
  function markTime(group, attr, v) {
    group.querySelectorAll(`[${attr}]`).forEach((b) => {
      const on = b.getAttribute(attr) === v;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function openPicker(group, name) {
    // 同一個面板裡一次只展開一組
    sheet.querySelectorAll('.picker-group').forEach((g) => {
      if (g !== group && g.dataset.active) closePicker(g);
    });
    const drawer = group.querySelector('.picker-drawer');
    const wasOpen = drawer.classList.contains('is-open');
    clearTimeout(Number(group.dataset.closeTimer));
    group.dataset.active = name;
    group.querySelectorAll('.picker-btn').forEach((b) => b.setAttribute('aria-expanded', String(b.dataset.target === name)));
    renderPicker(group, wasOpen ? 'swap' : null);
    if (!wasOpen) {
      drawer.inert = false;
      drawer.classList.add('is-open');
      // 等展開動畫跑完，展開區還在畫面外才捲過去
      setTimeout(() => {
        if (drawer.classList.contains('is-open')) {
          drawer.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
      }, reducedMotion() ? 0 : PICKER_OPEN_MS);
    }
  }

  function closePicker(group) {
    delete group.dataset.active;
    delete group.dataset.view;
    group.querySelectorAll('.picker-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    const drawer = group.querySelector('.picker-drawer');
    drawer.classList.remove('is-open');
    drawer.inert = true;
    // 收起動畫跑完才清空內容，不留看不見的按鈕
    group.dataset.closeTimer = String(setTimeout(() => {
      if (!drawer.classList.contains('is-open')) group.querySelector('.picker-panel').innerHTML = '';
    }, reducedMotion() ? 0 : PICKER_CLOSE_MS));
  }

  sheet.addEventListener('click', (e) => {
    const group = e.target.closest('.picker-group');
    if (!group) return;
    const trigger = e.target.closest('.picker-btn');
    if (trigger) {
      if (group.dataset.active === trigger.dataset.target) closePicker(group);
      else openPicker(group, trigger.dataset.target);
      return;
    }
    const active = group.dataset.active;
    if (!active) return;
    const btn = group.querySelector(`[data-target="${active}"]`);

    const nav = e.target.closest('[data-cal-nav]');
    if (nav) {
      const [y, m] = group.dataset.view.split('-').map(Number);
      const step = Number(nav.dataset.calNav);
      const d = new Date(Date.UTC(y, m - 1 + step, 1));
      group.dataset.view = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
      renderPicker(group, step > 0 ? 'next' : 'prev');
      return;
    }

    const day = e.target.closest('[data-cal-day]');
    if (day) {
      const date = day.dataset.calDay;
      if (btn.dataset.picker === 'range-start') {
        setPickerValue(group, 'startDate', date);
        const end = pickerInput(group, 'endDate').value;
        if (end && end < date) setPickerValue(group, 'endDate', '');
        // 選完出發日，接著選回程日
        openPicker(group, 'endDate');
        return;
      }
      setPickerValue(group, active, date);
      // 出發日期改了：抵達日期沒填或比出發早，就跟著改成同一天
      const follower = btn.dataset.syncTo && sheet.querySelector(`input[name="${btn.dataset.syncTo}"]`);
      if (follower && (!follower.value || follower.value < date)) {
        setPickerValue(follower.closest('.picker-group'), btn.dataset.syncTo, date);
      }
      closePicker(group);
      return;
    }

    // 點「時」或「分」都馬上更新；另一欄還沒選就先用 00
    const hour = e.target.closest('[data-time-hour]');
    const minute = e.target.closest('[data-time-minute]');
    if (hour || minute) {
      const [ch, cm] = (pickerInput(group, active).value || '00:00').split(':');
      const h = hour ? hour.dataset.timeHour : ch;
      const m = minute ? minute.dataset.timeMinute : cm;
      setPickerValue(group, active, `${h}:${m}`);
      markTime(group, 'data-time-hour', h);
      markTime(group, 'data-time-minute', m);
      return;
    }
    if (e.target.closest('[data-picker-done]')) {
      closePicker(group);
      return;
    }
    if (e.target.closest('[data-picker-clear]')) {
      setPickerValue(group, active, '');
      closePicker(group);
    }
  });

  function showSheetError(msg) {
    const el = sheet.querySelector('.form-error');
    if (!el) return;
    el.innerHTML = `${icon('alert', 16)}<span>${esc(msg)}</span>`;
    el.hidden = false;
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
      ${pickerGroup(
        pickerTrigger('time', 'startTime', '開始時間', a.startTime)
        + pickerTrigger('time', 'endTime', '結束時間', a.endTime))}
      <label class="field"><span>地點</span>
        <input name="location" maxlength="120" value="${esc(a.location?.name || '')}" placeholder="地址或地標名稱" autocomplete="off">
      </label>
      <div class="field-row">
        <label class="field"><span>花費（${esc(trip.currency)}）</span>
          <input type="number" name="cost" min="0" step="any" inputmode="decimal" value="${esc(a.cost ?? '')}" placeholder="0">
        </label>
        <label class="field"><span>日期</span>
          <select name="day">
            ${trip.days.map((d, i) => `<option value="${i}"${i === dayIdx ? ' selected' : ''}>Day ${i + 1} · ${fmtShort(d.date)}</option>`).join('')}
          </select>
        </label>
      </div>
      ${splitFields(trip, a)}
      <label class="field"><span>備註</span>
        <textarea name="note" maxlength="1000" placeholder="訂位代號、營業時間、注意事項">${esc(a.note || '')}</textarea>
      </label>`, {
      submitLabel: isNew ? '新增' : '儲存',
      deleteLabel: isNew ? null : '刪除活動',
      onSubmit: (fd) => {
        const targetList = trip.days[Number(fd.get('day'))].activities;
        if ((isNew || Number(fd.get('day')) !== dayIdx) && targetList.length >= MAX_ACTIVITIES_PER_DAY) {
          return `一天最多 ${MAX_ACTIVITIES_PER_DAY} 個活動`;
        }
        const split = readSplit(fd, trip);
        if (typeof split === 'string') return split;
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
          split: cost ? split : undefined,
          note: note || undefined,
        };

        const fromList = trip.days[dayIdx].activities;
        if (!isNew && targetDay === dayIdx) {
          fromList[fromList.indexOf(activity)] = next;
        } else {
          if (!isNew) fromList.splice(fromList.indexOf(activity), 1);
          trip.days[targetDay].activities.push(next);
        }
        // 新增或修改後自動依時間排好
        trip.days[targetDay].activities = sortByTime(trip.days[targetDay].activities);
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
          closeSheet();
          render();
          toast(`已刪除「${activity.title}」`, undo);
        },
      },
    });

    // 選「部分成員」才顯示成員勾選
    const someBox = sheet.querySelector('.split-some');
    sheet.querySelectorAll('input[name="split"]').forEach((r) => r.addEventListener('change', () => {
      if (someBox) someBox.hidden = sheet.querySelector('input[name="split"]:checked')?.value !== 'some';
    }));
  }

  // 花費分攤（D-043）：預設全部成員平分；只有一個成員時不顯示
  function splitFields(trip, a) {
    const members = membersOf(trip);
    if (members.length < 2) return '';
    const type = a.split?.type || 'all';
    const picked = a.split?.type === 'some' ? a.split.uids : members;
    const radio = (value, label) =>
      `<label class="chip"><input type="radio" name="split" value="${value}"${type === value ? ' checked' : ''}><span>${label}</span></label>`;
    return `
      <fieldset class="chips">
        <legend>花費分攤</legend>
        ${radio('all', `全部 ${members.length} 人平分`)}
        ${radio('some', '部分成員分攤')}
        ${radio('self', '只算我（個人開銷）')}
      </fieldset>
      <fieldset class="chips split-some"${type === 'some' ? '' : ' hidden'}>
        <legend>誰要分攤</legend>
        ${members.map((u) => `
          <label class="chip"><input type="checkbox" name="splitUids" value="${esc(u)}"${picked.includes(u) ? ' checked' : ''}><span>${esc(u === me() ? '我' : memberName(trip, u))}</span></label>`).join('')}
      </fieldset>`;
  }

  function readSplit(fd, trip) {
    if (membersOf(trip).length < 2) return undefined;
    const type = fd.get('split') || 'all';
    if (type === 'self') return { type: 'self', uid: me() };
    if (type === 'some') {
      const uids = fd.getAll('splitUids');
      if (!uids.length) return '請至少勾選一位要分攤的成員';
      if (uids.length === membersOf(trip).length) return { type: 'all' };
      return { type: 'some', uids };
    }
    return { type: 'all' };
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
      ${pickerGroup(
        pickerTrigger('date', 'departDate', '出發日期', f.departDate, 'data-sync-to="arriveDate"')
        + pickerTrigger('time', 'departTime', '出發時間', f.departTime))}
      ${pickerGroup(
        pickerTrigger('date', 'arriveDate', '抵達日期', f.arriveDate, 'data-min="departDate"')
        + pickerTrigger('time', 'arriveTime', '抵達時間', f.arriveTime))}
      <p class="field-hint">時間請填機票上的當地時間。</p>
      <fieldset class="chips">
        <legend>抵達後轉機</legend>
        ${Object.entries(TRANSIT).map(([key, t]) => `
          <label class="chip"><input type="radio" name="transit" value="${key}"${key === transitOf(f) ? ' checked' : ''}><span>${t.option}</span></label>`).join('')}
      </fieldset>
      ${pickerGroup(
        pickerTrigger('time', 'boardingTime', '登機時間', f.boardingTime)
        + `<label class="field"><span>艙等</span>
             <select name="cabin">${CABINS.map((c) => `<option${c === f.cabin ? ' selected' : ''}>${c}</option>`).join('')}</select>
           </label>`)}
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
          transit: transitOf({ transit: fd.get('transit') }) !== 'none' ? fd.get('transit') : undefined,
          fastTrack: flight?.fastTrack || false,
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
          closeSheet();
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
      ownerId: me(),
      members: [me()],
      memberProfiles: {},
      invitedEmails: [],
      days: days.map((activities, i) => ({ date: day(i), activities })),
      flights: [
        flight('紐西蘭航空', 'NZ 78', TPE, AKL, day(0), '23:10', day(1), '15:20',
          { boardingTime: '22:30', terminal: 'T1', gate: 'B5', seat: '42A', bookingRef: 'X7K2QP', transit: 'enter' }),
        flight('紐西蘭航空', 'NZ 615', AKL, { code: 'ZQN', city: '皇后鎮' }, day(1), '17:00', day(1), '18:50',
          { boardingTime: '16:30', terminal: 'D', seat: '12C', bookingRef: 'X7K2QP' }),
        flight('紐西蘭航空', 'NZ 506', { code: 'CHC', city: '基督城' }, AKL, day(6), '07:00', day(6), '08:20',
          { boardingTime: '06:30', terminal: 'D', seat: '8F', bookingRef: 'X7K2QP' }),
        flight('紐西蘭航空', 'NZ 77', AKL, TPE, day(6), '10:00', day(6), '16:30',
          { boardingTime: '09:15', terminal: 'I', seat: '38K', bookingRef: 'X7K2QP' }),
      ],
      prep: (() => {
        const item = (text, done = false) => ({ id: uid(), text, done });
        return {
          packing: [item('轉接頭（I 型插座）'), item('防風外套'), item('登山鞋'), item('行動電源', true)],
          passport: [{ ...data.DEFAULT_PASSPORT, done: true }, item('護照影本')],
          visa: [item('NZeTA 電子旅行授權'), item('國際駕照')],
        };
      })(),
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
      case 'sign-in': {
        const err = document.getElementById('login-error');
        el.disabled = true;
        data.signIn()
          .catch((e) => {
            if (err) {
              err.innerHTML = `${icon('alert', 16)}<span>${esc(signInMessage(e))}</span>`;
              err.hidden = false;
            }
          })
          .finally(() => { el.disabled = false; });
        break;
      }
      case 'accept-invite': {
        el.disabled = true;
        data.joinByEmail(el.dataset.id)
          .then(() => toast('已加入旅程'))
          .catch(() => {
            el.disabled = false;
            toast('加入失敗，請確認網路後再試一次');
          });
        break;
      }
      case 'members':
        openMembers(trip);
        break;
      case 'new-trip':
        openTripForm(null);
        break;
      case 'load-sample': {
        const created = sampleTrip();
        state.trips.push(JSON.parse(JSON.stringify(created)));
        const buy = (name, price, currency, done = false) => ({ id: uid(), name, price, currency, done });
        state.personal[created.id] = {
          carried: { TWD: 10000, NZD: 3000 },
          shopping: [buy('eSIM 上網卡', 650, 'TWD', true), buy('綿羊油', 20, 'NZD', true), buy('麥蘆卡蜂蜜', 45, 'NZD'), buy('羊毛襪', 30, 'NZD')],
        };
        save();
        // 在首頁載入就留在首頁，直接看到效果
        if (route.name === 'home') render();
        else location.hash = tripHref(created);
        break;
      }
      case 'check-delete': {
        const t = currentTrip();
        const list = prepOf(t)[el.dataset.group];
        const item = list.find((x) => x.id === el.dataset.id);
        if (!item) break;
        const undo = snapshot();
        list.splice(list.indexOf(item), 1);
        touch(t);
        render();
        toast(`已刪除「${item.text}」`, undo);
        break;
      }
      case 'shop-delete': {
        const p = personalOf(currentTrip());
        const item = p.shopping.find((x) => x.id === el.dataset.id);
        if (!item) break;
        const undo = snapshot();
        p.shopping.splice(p.shopping.indexOf(item), 1);
        save();
        render();
        toast(`已刪除「${item.name}」`, undo);
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
        trip.days[dayIdx].activities = sortByTime(trip.days[dayIdx].activities);
        touch(trip);
        render();
        toast('已依時間排序');
        break;
      }
    }
  });

  // 機票上的快速通關勾選
  app.addEventListener('change', (e) => {
    const box = e.target.closest('[data-flight-check]');
    if (!box) return;
    const t = currentTrip();
    const flight = t?.flights.find((f) => f.id === box.dataset.flightCheck);
    if (!flight) return;
    flight.fastTrack = box.checked;
    touch(t);
  });

  // 準備清單：勾選
  app.addEventListener('change', (e) => {
    const box = e.target.closest('[data-check]');
    if (!box) return;
    const t = currentTrip();
    const item = prepOf(t)[box.dataset.check].find((x) => x.id === box.dataset.id);
    if (!item) return;
    item.done = box.checked;
    touch(t);
    render();
    app.querySelector(`[data-check="${CSS.escape(box.dataset.check)}"][data-id="${CSS.escape(box.dataset.id)}"]`)?.focus();
  });

  // 查詢行程：邊打邊找，只更新結果區，輸入框不會失去焦點
  app.addEventListener('input', (e) => {
    if (e.target.id !== 'trip-search') return;
    const route = parseRoute();
    const trip = route.name === 'trip' ? findTrip(route.id) : null;
    if (!trip) return;
    searchQuery = e.target.value;
    showSearch(trip);
  });

  // 同一趟旅程裡換日期（日期分頁、查詢結果）：網址跟著變，但用 replaceState 取代目前紀錄，
  // 按返回鍵會直接回到上一個頁面，不會一天一天倒退；畫面停在原本的捲動位置
  app.addEventListener('click', (e) => {
    const link = e.target.closest('.day-tab, .search-hit');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (link.classList.contains('search-hit')) searchQuery = '';
    history.replaceState(null, '', link.getAttribute('href'));
    lastRoute = parseRoute();
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  });

  // 預算：帶了多少
  app.addEventListener('change', (e) => {
    const input = e.target.closest('[data-carried]');
    if (!input) return;
    const n = Number(input.value);
    personalOf(currentTrip()).carried[input.dataset.carried] = Number.isFinite(n) && n > 0 ? n : 0;
    save();
    render();
  });

  // 購買清單：勾選已買
  app.addEventListener('change', (e) => {
    const box = e.target.closest('[data-buy]');
    if (!box) return;
    const item = personalOf(currentTrip()).shopping.find((x) => x.id === box.dataset.buy);
    if (!item) return;
    item.done = box.checked;
    save();
    render();
    app.querySelector(`[data-buy="${CSS.escape(box.dataset.buy)}"]`)?.focus();
  });

  // 購買清單：新增
  app.addEventListener('submit', (e) => {
    const form = e.target.closest('.shop-add');
    if (!form) return;
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const priceRaw = form.elements.price.value.trim();
    const price = priceRaw === '' ? undefined : Number(priceRaw);
    const errorEl = form.querySelector('.form-error');
    const fail = (msg) => {
      errorEl.innerHTML = `${icon('alert', 16)}<span>${esc(msg)}</span>`;
      errorEl.hidden = false;
    };
    if (!name) return fail('請填寫品名');
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return fail('價格請輸入 0 以上的數字');
    personalOf(currentTrip()).shopping.push({ id: uid(), name, price, currency: form.elements.currency.value, done: false });
    save();
    render();
    app.querySelector('.shop-add input[name="name"]')?.focus();
  });

  // 準備清單：新增項目，新增完游標留在同一個輸入框，方便連續輸入
  app.addEventListener('submit', (e) => {
    const form = e.target.closest('.check-add');
    if (!form) return;
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    const t = currentTrip();
    const group = form.dataset.group;
    prepOf(t)[group].push({ id: uid(), text, done: false });
    touch(t);
    render();
    app.querySelector(`.check-add[data-group="${group}"] input`)?.focus();
  });

  let lastRoute = parseRoute();
  window.addEventListener('hashchange', () => {
    if (sheet.open) closeSheet();
    const route = parseRoute();
    if (route.name !== 'trip') searchQuery = '';
    // 同一趟旅程裡切換日期：停在原本的位置，不跳回最上面；換頁才回到頂端
    const sameTrip = route.name === 'trip' && lastRoute.name === 'trip' && route.id === lastRoute.id;
    lastRoute = route;
    const y = window.scrollY;
    render();
    window.scrollTo(0, sameTrip ? y : 0);
  });

  // ---------- 啟動：等 Firebase 告訴我們有沒有登入 ----------

  function signInMessage(e) {
    if (e?.code === 'auth/network-request-failed') return '連不上網路，請確認網路後再試一次';
    if (e?.code === 'auth/unauthorized-domain') return '這個網址還沒加入 Firebase 的授權網域';
    return '登入失敗，請再試一次';
  }

  // 儲存或讀取被拒絕（例如權限、網路），用 toast 告訴使用者，不讓錯誤默默消失
  function onDataError(err) {
    console.error(err);
    if (err?.code === 'permission-denied') toast('沒有權限修改這份資料，畫面已還原成雲端的版本');
    else if (err?.code === 'unavailable') toast('目前離線，修改會在連上網路後自動同步');
    else toast('同步時發生問題，請稍後再試');
  }

  // 啟動時先顯示載入中，等 Firebase 回報登入狀態
  renderLoading();
  data.onUser((u) => {
    user = u;
    ready = false;
    pendingRemote = null;
    state.trips = [];
    state.personal = {};
    state.invitations = [];
    if (u) data.watch(u, { onChange: applyRemote, onError: onDataError });
    render();
  });

  // 只在本機模擬器模式提供給自動測試使用
  if (data.EMULATOR) window.__itinerisTest = { signIn: data.testSignIn, state, uid: () => data.currentUser()?.uid };
})();
