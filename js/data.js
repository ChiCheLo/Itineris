// 資料存取層：畫面程式（app.js）只透過這裡讀寫 Firebase，不直接碰資料庫。
// 權限一律由 firestore.rules 在伺服器端檢查；這裡只負責「讀進來組成畫面要的樣子」與「找出改了什麼再寫回去」。
//
// Firestore 結構（docs/index.html 第 6 節）：
//   trips/{tripId}                 共用：旅程、機票、簽證與入境資料的項目、成員
//   trips/{tripId}/days/{date}     共用：每天的行程
//   users/{uid}/personal/{tripId}  個人：預算、購買清單、攜帶物品、護照、簽證項目的勾選、快速通關（D-075）
//   invites/{code}                 邀請連結
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// 本機開發時網址加上 ?emulator 就改連本機模擬器（不會碰到正式資料庫）
export const EMULATOR = ['localhost', '127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).has('emulator');

const fbApp = initializeApp(EMULATOR ? { ...firebaseConfig, projectId: 'demo-itineris' } : firebaseConfig);
const auth = getAuth(fbApp);

// 離線快取：沒網路時仍可查看與修改，連線後自動同步（D-046：登出時保留）
function makeDb() {
  const settings = { ignoreUndefinedProperties: true };
  if (EMULATOR) return initializeFirestore(fbApp, { ...settings, localCache: memoryLocalCache() });
  try {
    return initializeFirestore(fbApp, { ...settings, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    // 部分瀏覽器（例如無痕模式）不能用 IndexedDB，就只用記憶體快取
    return initializeFirestore(fbApp, { ...settings, localCache: memoryLocalCache() });
  }
}
const db = makeDb();

if (EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_DAYS = 7;
// 刪除旅程（D-071）：按下刪除就在旅程上寫 deletedAt（立刻存下、離線也會排隊），所有人馬上看不到；
// 按「復原」就拿掉。過了這段時間，建立者的 App 下次讀到時才把旅程與每天行程真的刪掉
const PURGE_AFTER = 60 * 1000;
// 旅程上舊的 packing（以前共用的攜帶物品）不再寫入，只在個人還沒有自己的清單時拿來當起點（D-075）
// 旅程上舊的 flights（以前共用的機票）也不再寫入，建立者搬到個人資料後就拿掉（D-077）
const TRIP_FIELDS = ['title', 'destination', 'startDate', 'endDate', 'currency', 'invitedEmails', 'visa'];

// 護照預設項目用固定 id，每次組出來都一樣
export const DEFAULT_PASSPORT = { id: 'passport-validity', text: '護照效期已確認', done: false };

// ---------- 小工具 ----------

// 依 key 排序的 JSON，用來比較「內容有沒有變」（Firestore 回傳的欄位順序不固定）
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v instanceof Timestamp) return `"ts:${v.toMillis()}"`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k]]));

function dateRange(start, end) {
  const out = [];
  const t0 = Date.parse(`${start}T00:00:00Z`);
  const t1 = Date.parse(`${end}T00:00:00Z`);
  for (let t = t0; t <= t1 && out.length <= 60; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// 邀請碼：24 碼網址安全的亂數
function randomCode(len = 24) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const profileOf = (user) => ({ name: user.displayName || user.email || '旅伴', photoURL: user.photoURL || '' });

// ---------- 登入 ----------

export const currentUser = () => auth.currentUser;
export const onUser = (cb) => onAuthStateChanged(auth, cb);

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // 彈出視窗被擋時改用整頁跳轉
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      throw err;
    }
  }
}

export async function signOutUser() {
  stopWatching();
  await signOut(auth);
}

// 只在本機模擬器模式提供：用假的 Google 帳號登入，讓自動測試不用真的開 Google 視窗
export async function testSignIn(sub, email, name) {
  if (!EMULATOR) throw new Error('testSignIn 只能在模擬器模式使用');
  const token = JSON.stringify({ sub, email, email_verified: true, name });
  await signInWithCredential(auth, GoogleAuthProvider.credential(token));
}

// ---------- 讀：即時監聽 ----------

const cache = {
  trips: new Map(),          // tripId → 旅程文件
  days: new Map(),           // tripId → Map(date → 那天的文件)
  personal: new Map(),       // tripId → 個人文件（沒有就是 null）
  daysLoaded: new Set(),
  personalLoaded: new Set(),
  invitations: new Map(),    // 用 Gmail 邀請我、但我還不是成員的旅程
  tripsLoaded: false,
};
let rootUnsubs = [];
const tripUnsubs = new Map();
const purging = new Set(); // 正在真的刪除的旅程，避免重複送出
const isDeleted = (t) => !!t && 'deletedAt' in t; // 剛寫入、伺服器時間還沒回來時值是 null，一樣算已刪除
let notify = () => {};
let reportError = () => {};

function resetCache() {
  cache.trips.clear();
  cache.days.clear();
  cache.personal.clear();
  cache.daysLoaded.clear();
  cache.personalLoaded.clear();
  cache.invitations.clear();
  cache.tripsLoaded = false;
}

export function stopWatching() {
  rootUnsubs.forEach((u) => u());
  rootUnsubs = [];
  tripUnsubs.forEach((us) => us.forEach((u) => u()));
  tripUnsubs.clear();
  resetCache();
}

// 共用資料可能被旅伴寫成奇怪的格式（規則只檢查到清單長度）：清單一定是陣列、裡面只留物件，
// 機票的出發／抵達一定是物件，避免畫面因此當掉（資安檢查）
const objects = (v) => (Array.isArray(v) ? v.filter((o) => o && typeof o === 'object' && !Array.isArray(o)) : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);

// 機票（D-077 改成個人）：每個人只看得到自己的機票。改版前旅程上的共用機票只歸建立者，
// 建立者下次存檔時搬到自己的個人資料，並從旅程上拿掉
const flightsOf = (t, p) => objects(p?.flights ?? (t?.ownerId === auth.currentUser?.uid ? t?.flights : []));

// 攜帶物品（D-075 改成個人）：自己還沒存過就沿用旅程上舊的共用清單當起點
const packingOf = (t, p) => objects(p?.packing ?? t?.packing);

// 簽證與入境資料（D-075）：項目是旅程共用的，勾選是自己的（visaDone）。
// 舊版每個人自己的簽證清單（personal.visa）併進來，下次存檔時搬到旅程上
function visaOf(t, p) {
  const done = { ...obj(p?.visaDone) };
  const items = objects(t?.visa).map(({ done: _, ...v }) => v);
  for (const v of objects(p?.visa)) {
    if (!items.some((x) => x.id === v.id)) {
      const { done: legacyDone, ...rest } = v;
      items.push(rest);
      if (legacyDone) done[v.id] = true;
    }
  }
  return items.map((v) => ({ ...v, done: !!done[v.id] }));
}

function composeTrip(id) {
  const t = cache.trips.get(id);
  const days = cache.days.get(id) || new Map();
  const p = cache.personal.get(id) || {};
  return {
    id,
    title: t.title,
    destination: t.destination,
    startDate: t.startDate,
    endDate: t.endDate,
    currency: t.currency,
    ownerId: t.ownerId,
    members: strings(t.members),
    memberProfiles: obj(t.memberProfiles),
    invitedEmails: strings(t.invitedEmails),
    days: dateRange(t.startDate, t.endDate).map((date) => ({ date, activities: objects(days.get(date)?.activities) })),
    flights: flightsOf(t, p).map((f) => ({ ...f, from: obj(f.from), to: obj(f.to), fastTrack: !!obj(p.fastTrack)[f.id] })),
    prep: {
      packing: packingOf(t, p),
      passport: p.passport ? objects(p.passport) : [DEFAULT_PASSPORT],
      visa: visaOf(t, p),
    },
  };
}

const allLoaded = () => [...cache.trips.keys()].every((id) => cache.daysLoaded.has(id) && cache.personalLoaded.has(id));

// 等每趟旅程的「每天行程」與「個人資料」都讀到了才通知畫面，避免畫面閃一下空的
function emit() {
  if (!cache.tripsLoaded || !allLoaded()) return;
  const trips = [];
  const personal = {};
  for (const id of cache.trips.keys()) {
    if (isDeleted(cache.trips.get(id))) continue;
    trips.push(composeTrip(id));
    const p = cache.personal.get(id) || {};
    personal[id] = { carried: obj(p.carried), shopping: objects(p.shopping) };
  }
  const uid = auth.currentUser?.uid;
  const invitations = [...cache.invitations.entries()]
    .filter(([id, t]) => !cache.trips.has(id) && !isDeleted(t) && !(t.members || []).includes(uid))
    .map(([id, t]) => ({ id, title: t.title, destination: t.destination, startDate: t.startDate, endDate: t.endDate, ownerName: t.memberProfiles?.[t.ownerId]?.name || '' }));
  // 交給畫面的是複本：畫面直接修改物件時，不能連帶改到這裡的「伺服器版本」，否則比對不出差異、不會寫入
  notify(structuredClone({ trips, personal, invitations }));
  purgeDeleted();
}

// 標記刪除超過 PURGE_AFTER 的旅程（自己是建立者），真的刪掉
function purgeDeleted() {
  const uid = auth.currentUser?.uid;
  for (const [id, t] of cache.trips) {
    if (!isDeleted(t) || t.ownerId !== uid || purging.has(id) || !cache.daysLoaded.has(id)) continue;
    if (!(t.deletedAt instanceof Timestamp) || Date.now() - t.deletedAt.toMillis() < PURGE_AFTER) continue;
    purging.add(id);
    deleteTripNow(id);
  }
}

function watchTrip(uid, tripId) {
  const unsubDays = onSnapshot(collection(db, 'trips', tripId, 'days'), (snap) => {
    const m = new Map();
    snap.forEach((d) => m.set(d.id, d.data()));
    cache.days.set(tripId, m);
    cache.daysLoaded.add(tripId);
    emit();
  }, (err) => {
    cache.daysLoaded.add(tripId);
    reportError(err);
    emit();
  });
  const unsubPersonal = onSnapshot(doc(db, 'users', uid, 'personal', tripId), (snap) => {
    cache.personal.set(tripId, snap.exists() ? snap.data() : null);
    cache.personalLoaded.add(tripId);
    emit();
  }, (err) => {
    cache.personalLoaded.add(tripId);
    reportError(err);
    emit();
  });
  tripUnsubs.set(tripId, [unsubDays, unsubPersonal]);
}

function unwatchTrip(tripId) {
  tripUnsubs.get(tripId)?.forEach((u) => u());
  tripUnsubs.delete(tripId);
  cache.days.delete(tripId);
  cache.personal.delete(tripId);
  cache.daysLoaded.delete(tripId);
  cache.personalLoaded.delete(tripId);
}

export function watch(user, { onChange, onError }) {
  stopWatching();
  notify = onChange;
  reportError = onError;

  // 我是成員的旅程（includeMetadataChanges：才知道剛建立的旅程什麼時候真的寫進伺服器）
  const myTrips = query(collection(db, 'trips'), where('members', 'array-contains', user.uid));
  rootUnsubs.push(onSnapshot(myTrips, { includeMetadataChanges: true }, (snap) => {
    const ids = new Set();
    snap.forEach((d) => {
      ids.add(d.id);
      cache.trips.set(d.id, d.data());
      // 這支手機剛建立、還沒寫進伺服器的旅程先不監聽每天行程（伺服器還不認得它，規則會拒絕），
      // 畫面先用剛寫入的內容；寫進伺服器後才開始監聽
      if (!tripUnsubs.has(d.id) && !d.metadata.hasPendingWrites) watchTrip(user.uid, d.id);
    });
    for (const id of [...cache.trips.keys()]) {
      if (!ids.has(id)) {
        cache.trips.delete(id);
        unwatchTrip(id);
      }
    }
    cache.tripsLoaded = true;
    emit();
  }, (err) => {
    cache.tripsLoaded = true;
    onError(err);
    emit();
  }));

  // 用 Gmail 邀請我的旅程
  if (user.email) {
    rootUnsubs.push(onSnapshot(query(collection(db, 'trips'), where('invitedEmails', 'array-contains', user.email)), (snap) => {
      cache.invitations.clear();
      snap.forEach((d) => cache.invitations.set(d.id, d.data()));
      emit();
    }, onError));
  }

  // 記下 Google 帳號基本資料（只有本人能讀）
  write(setDoc(doc(db, 'users', user.uid), {
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    updatedAt: serverTimestamp(),
  }, { merge: true }));
}

// ---------- 寫：找出改了什麼，只寫那幾份文件 ----------

// 寫入不等伺服器回應（離線時會先排隊）；失敗時交給畫面顯示
function write(promise) {
  promise.catch((err) => reportError(err));
}

const created = new Set(); // 這支手機建立過的旅程（避免重複建立）

function personalDoc(trip, p = {}) {
  return {
    carried: p.carried || {},
    shopping: p.shopping || [],
    passport: trip.prep?.passport || [],
    packing: trip.prep?.packing || [],
    visaDone: Object.fromEntries((trip.prep?.visa || []).filter((v) => v.done).map((v) => [v.id, true])),
    flights: (trip.flights || []).map(({ fastTrack, ...f }) => f),
    fastTrack: Object.fromEntries((trip.flights || []).filter((f) => f.fastTrack).map((f) => [f.id, true])),
  };
}

// 新旅程：旅程、每天行程、個人資料放在同一批次寫入（規則用 getAfter 看得到同批次建立的旅程）。
// 離線時這一批會先排隊，連上網路後一起送出。
function createTrip(user, trip, fields, personal) {
  created.add(trip.id);
  const tripRef = doc(db, 'trips', trip.id);
  const batch = writeBatch(db);
  batch.set(tripRef, {
    ...fields,
    ownerId: user.uid,
    members: [user.uid],
    memberProfiles: { [user.uid]: profileOf(user) },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const days = new Map();
  for (const d of trip.days) {
    if (!d.activities.length) continue;
    const dayData = { date: d.date, activities: d.activities };
    days.set(d.date, dayData);
    batch.set(doc(tripRef, 'days', d.date), { ...dayData, updatedAt: serverTimestamp() });
  }
  const p = personalDoc(trip, personal);
  batch.set(doc(db, 'users', user.uid, 'personal', trip.id), { ...p, updatedAt: serverTimestamp() });
  write(batch.commit());
  // 寫進伺服器前，先用剛寫的內容當作已讀到的資料（之後監聽到伺服器資料會取代）；同樣存複本
  cache.days.set(trip.id, structuredClone(days));
  cache.personal.set(trip.id, structuredClone(p));
  cache.daysLoaded.add(trip.id);
  cache.personalLoaded.add(trip.id);
}

export function saveAll(state) {
  const user = auth.currentUser;
  if (!user || !cache.tripsLoaded) return;
  const seen = new Set();

  for (const trip of state.trips) {
    seen.add(trip.id);
    const tripRef = doc(db, 'trips', trip.id);
    const raw = cache.trips.get(trip.id);
    if (isDeleted(raw)) {
      // 刪除後按了復原：拿掉刪除標記
      write(updateDoc(tripRef, { deletedAt: deleteField(), updatedAt: serverTimestamp() }));
    }
    const fields = {
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      currency: trip.currency,
      invitedEmails: trip.invitedEmails || [],
      visa: (trip.prep?.visa || []).map(({ done, ...v }) => v),
    };

    const isNew = !raw && !created.has(trip.id);
    if (isNew) {
      createTrip(user, trip, fields, state.personal[trip.id]);
      continue;
    }
    if (raw && stable({ ...pick(raw, TRIP_FIELDS), visa: raw.visa || [] }) !== stable(fields)) {
      write(updateDoc(tripRef, { ...fields, updatedAt: serverTimestamp() }));
    }

    // 每天的行程：還沒讀到伺服器資料的旅程先不寫，避免把別人的行程蓋成空的
    if (cache.daysLoaded.has(trip.id)) {
      const known = cache.days.get(trip.id) || new Map();
      for (const d of trip.days) {
        const k = known.get(d.date);
        const changed = k ? stable(k.activities) !== stable(d.activities) : d.activities.length > 0;
        if (changed) write(setDoc(doc(tripRef, 'days', d.date), { date: d.date, activities: d.activities, updatedAt: serverTimestamp() }));
      }
      for (const date of known.keys()) {
        if (!trip.days.some((d) => d.date === date)) write(deleteDoc(doc(tripRef, 'days', date)));
      }
    }

    // 個人資料
    if (cache.personalLoaded.has(trip.id)) {
      const personal = personalDoc(trip, state.personal[trip.id]);
      const kp = cache.personal.get(trip.id);
      const before = {
        carried: kp?.carried || {},
        shopping: kp?.shopping || [],
        passport: kp?.passport || [DEFAULT_PASSPORT],
        packing: packingOf(raw, kp),
        visaDone: kp?.visaDone || {},
        flights: kp?.flights, // 還沒存過自己的機票（undefined）就一定寫一次，完成搬移
        fastTrack: kp?.fastTrack || {},
        // 還留著舊版個人簽證清單的話一定要重寫一次，把它拿掉（項目已經併到旅程上）
        ...(kp?.visa ? { visa: kp.visa } : {}),
      };
      if (stable(before) !== stable(personal)) {
        write(setDoc(doc(db, 'users', user.uid, 'personal', trip.id), { ...personal, updatedAt: serverTimestamp() }));
      }
      // 舊的共用機票已經搬到建立者自己的個人資料：從旅程上拿掉，旅伴就讀不到
      if (raw && 'flights' in raw && raw.ownerId === user.uid) {
        write(updateDoc(tripRef, { flights: deleteField(), updatedAt: serverTimestamp() }));
      }
    }
  }

  // 畫面上不見的旅程＝刪除：馬上寫刪除標記（之後由 purgeDeleted 真的刪掉）
  for (const [id, t] of cache.trips) {
    if (!seen.has(id) && !isDeleted(t) && t.ownerId === user.uid) {
      write(updateDoc(doc(db, 'trips', id), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    }
  }
}

// 每天的行程、自己的個人資料、旅程本身放在同一批次刪除（規則用批次前的旅程文件判斷成員）
function deleteTripNow(tripId) {
  const uid = auth.currentUser?.uid;
  const batch = writeBatch(db);
  for (const date of (cache.days.get(tripId) || new Map()).keys()) batch.delete(doc(db, 'trips', tripId, 'days', date));
  if (uid) batch.delete(doc(db, 'users', uid, 'personal', tripId));
  batch.delete(doc(db, 'trips', tripId));
  write(batch.commit());
}

// ---------- 旅伴 ----------

export async function createInvite(tripId) {
  const code = randomCode();
  await setDoc(doc(db, 'invites', code), {
    tripId,
    createdBy: auth.currentUser.uid,
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_DAYS * DAY_MS),
  });
  return { code, days: INVITE_DAYS };
}

export function joinByInvite(tripId, code) {
  const user = auth.currentUser;
  return updateDoc(doc(db, 'trips', tripId), {
    members: arrayUnion(user.uid),
    [`memberProfiles.${user.uid}`]: profileOf(user),
    joinCode: code,
    updatedAt: serverTimestamp(),
  });
}

export function joinByEmail(tripId) {
  const user = auth.currentUser;
  return updateDoc(doc(db, 'trips', tripId), {
    members: arrayUnion(user.uid),
    [`memberProfiles.${user.uid}`]: profileOf(user),
    updatedAt: serverTimestamp(),
  });
}

// 建立者把旅伴移出旅程（D-074）；對方自己的預算等個人資料在他的帳號裡，不受影響
export function removeMember(tripId, uid) {
  return updateDoc(doc(db, 'trips', tripId), {
    members: arrayRemove(uid),
    [`memberProfiles.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export function leaveTrip(tripId) {
  const uid = auth.currentUser.uid;
  write(deleteDoc(doc(db, 'users', uid, 'personal', tripId)));
  return updateDoc(doc(db, 'trips', tripId), {
    members: arrayRemove(uid),
    [`memberProfiles.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
