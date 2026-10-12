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
  const CURRENCIES = ['TWD', 'JPY', 'KRW', 'USD', 'EUR', 'THB', 'HKD', 'CNY', 'SGD', 'GBP'];

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
  };

  const icon = (name, size = 20) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  // ---------- Storage ----------

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { trips: [] };
      const data = JSON.parse(raw);
      return data && Array.isArray(data.trips) ? data : { trips: [] };
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
  // #/                 旅程列表
  // #/trip/:id/:day    旅程詳情（day 從 0 起算）

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'trip' && parts[1]) {
      return { name: 'trip', id: decodeURIComponent(parts[1]), day: Number(parts[2]) || 0 };
    }
    return { name: 'list' };
  }

  const tripHref = (trip, day = 0) => `#/trip/${encodeURIComponent(trip.id)}/${day}`;
  const clampDay = (trip, day) => Math.min(Math.max(day, 0), trip.days.length - 1);

  function render() {
    const route = parseRoute();
    if (route.name === 'trip') {
      const trip = findTrip(route.id);
      if (!trip) {
        location.hash = '#/';
        return;
      }
      renderTrip(trip, clampDay(trip, route.day));
    } else {
      renderList();
    }
  }

  // ---------- 旅程列表 ----------

  function renderList() {
    document.title = 'TravelPlan 行程規劃';
    const trips = [...state.trips].sort((a, b) => a.startDate.localeCompare(b.startDate));

    app.innerHTML = `
      <header class="page-head">
        <div>
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
        <a class="icon-btn back" href="#/" aria-label="返回旅程列表">${icon('back', 24)}</a>
        <div class="topbar-title">
          <h1>${esc(trip.title)}</h1>
          <p>${esc(trip.destination)} · ${fmtShort(trip.startDate)} – ${fmtShort(trip.endDate)}</p>
        </div>
        <button class="btn ghost small" type="button" data-action="edit-trip">編輯</button>
      </header>

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
          location.hash = '#/';
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

  // ---------- 範例行程 ----------

  function sampleTrip() {
    const start = addDays(todayISO(), 14);
    const act = (title, type, startTime, endTime, location, cost, note) => ({
      id: uid(), title, type,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: location ? { name: location } : undefined,
      cost, note,
    });
    const days = [
      [
        act('桃園機場 → 成田機場', 'transport', '08:50', '13:05', '桃園國際機場 第二航廈', undefined, '提早 2 小時報到，行李限重 23kg'),
        act('Skyliner 前往上野', 'transport', '14:20', '15:01', '成田機場第 1 航廈站', 2580),
        act('飯店入住', 'lodging', '16:00', undefined, '上野站步行 5 分鐘', 41800, '共 3 晚，已付訂金'),
        act('阿美橫丁晚餐', 'food', '18:30', '20:00', '阿美橫丁商店街', 2350),
      ],
      [
        act('築地場外市場早餐', 'food', '08:00', '09:30', '築地場外市場', 3200, '海鮮丼店 7:00 開門，早點去不用排隊'),
        act('淺草寺・雷門', 'sight', '10:30', '12:30', '東京都台東區淺草 2-3-1'),
        act('東京晴空塔 天望甲板', 'sight', '14:00', '16:00', '東京都墨田區押上 1-1-2', 3100, '已預約 14:00 入場'),
        act('燒肉晚餐', 'food', '19:00', '20:30', '錦糸町', 6480),
      ],
      [
        act('明治神宮', 'sight', '09:30', '11:00', '東京都澀谷區代代木神園町 1-1'),
        act('表參道午餐', 'food', '12:00', '13:00', '表參道', 1850),
        act('原宿竹下通', 'sight', '13:30', '15:30', '竹下通'),
        act('澀谷觀景台看夕陽', 'sight', '17:00', '18:30', '澀谷站', 2500, '日落時段需提前一週預約'),
      ],
      [
        act('退房', 'lodging', '10:00'),
        act('銀座逛街', 'sight', '11:00', '15:00', '銀座中央通'),
        act('Skyliner 前往成田機場', 'transport', '15:40', '16:24', '京成上野站', 2580),
        act('成田機場 → 桃園機場', 'transport', '18:35', '21:55', '成田機場 第 2 航廈'),
      ],
    ];
    return {
      id: uid(),
      title: '東京四日遊',
      destination: '日本東京',
      startDate: start,
      endDate: addDays(start, days.length - 1),
      currency: 'JPY',
      days: days.map((activities, i) => ({ date: addDays(start, i), activities })),
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
        location.hash = tripHref(created);
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
