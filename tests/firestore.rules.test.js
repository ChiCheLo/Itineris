// Firestore 安全規則自動測試（在本機模擬器執行，不會碰到正式資料庫）
// 執行：npm run test:rules
//
// 角色：
//   alice：旅程 t1 的建立者
//   bob：一般使用者，拿到邀請連結後加入
//   carol：被 alice 用 Gmail 邀請的人
//   mallory：跟這趟旅程無關的人
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const DAY = 24 * 60 * 60 * 1000;
const VALID_CODE = 'validInviteCode_0123456789';
const EXPIRED_CODE = 'expiredInviteCode_0123456789';
const OTHER_TRIP_CODE = 'otherTripInviteCode_012345';

let env;

const baseTrip = () => ({
  title: '紐西蘭南島自駕',
  destination: '紐西蘭南島',
  startDate: '2026-11-01',
  endDate: '2026-11-07',
  currency: 'NZD',
  ownerId: 'alice',
  members: ['alice'],
  memberProfiles: { alice: { name: 'Alice' } },
  invitedEmails: ['carol@gmail.com'],
  flights: [],
  packing: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

const as = (uid, token) => env.authenticatedContext(uid, token).firestore();
const anon = () => env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-itineris',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

// 每個測試前清空並放入同一份初始資料（不經過規則）
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'trips/t1'), baseTrip());
    await setDoc(doc(db, 'trips/t2'), { ...baseTrip(), ownerId: 'zoe', members: ['zoe'], memberProfiles: {}, invitedEmails: [] });
    await setDoc(doc(db, 'trips/t1/days/2026-11-01'), { date: '2026-11-01', activities: [] });
    await setDoc(doc(db, 'users/alice/personal/t1'), { carried: { TWD: 10000, NZD: 1500 }, shopping: [] });
    await setDoc(doc(db, `invites/${VALID_CODE}`), { tripId: 't1', createdBy: 'alice', expiresAt: Timestamp.fromMillis(Date.now() + 7 * DAY) });
    await setDoc(doc(db, `invites/${EXPIRED_CODE}`), { tripId: 't1', createdBy: 'alice', expiresAt: Timestamp.fromMillis(Date.now() - DAY) });
    await setDoc(doc(db, `invites/${OTHER_TRIP_CODE}`), { tripId: 't2', createdBy: 'zoe', expiresAt: Timestamp.fromMillis(Date.now() + 7 * DAY) });
  });
});

const joinWith = (db, uid, code) => updateDoc(doc(db, 'trips/t1'), {
  members: arrayUnion(uid),
  [`memberProfiles.${uid}`]: { name: uid },
  joinCode: code,
  updatedAt: Timestamp.now(),
});

// 先用邀請連結讓 bob 加入，給需要「bob 是成員」的測試用
const bobJoins = () => env.withSecurityRulesDisabled(async (ctx) => {
  await updateDoc(doc(ctx.firestore(), 'trips/t1'), { members: ['alice', 'bob'], 'memberProfiles.bob': { name: 'Bob' } });
});

describe('沒登入', () => {
  test('讀不到旅程', async () => {
    await assertFails(getDoc(doc(anon(), 'trips/t1')));
  });
  test('讀不到個人資料', async () => {
    await assertFails(getDoc(doc(anon(), 'users/alice/personal/t1')));
  });
  test('不能建立旅程', async () => {
    await assertFails(setDoc(doc(anon(), 'trips/t3'), baseTrip()));
  });
});

describe('個人資料（預算、購買清單、證件）只有本人能讀寫', () => {
  test('本人可以讀寫', async () => {
    const db = as('alice');
    await assertSucceeds(getDoc(doc(db, 'users/alice/personal/t1')));
    await assertSucceeds(setDoc(doc(db, 'users/alice/personal/t1'), { carried: { TWD: 5000 }, shopping: [], passport: [], visa: [], fastTrack: { f1: true } }));
  });
  test('旅伴讀不到也改不了', async () => {
    await bobJoins();
    const db = as('bob');
    await assertFails(getDoc(doc(db, 'users/alice/personal/t1')));
    await assertFails(setDoc(doc(db, 'users/alice/personal/t1'), { carried: { TWD: 0 } }));
  });
  test('不能塞入規則以外的欄位', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice/personal/t1'), { carried: {}, secret: 'x' }));
  });
});

describe('旅程：只有成員能讀寫', () => {
  test('建立者可以讀旅程與每天行程', async () => {
    const db = as('alice');
    await assertSucceeds(getDoc(doc(db, 'trips/t1')));
    await assertSucceeds(getDoc(doc(db, 'trips/t1/days/2026-11-01')));
  });
  test('無關的人讀不到旅程與每天行程', async () => {
    const db = as('mallory');
    await assertFails(getDoc(doc(db, 'trips/t1')));
    await assertFails(getDoc(doc(db, 'trips/t1/days/2026-11-01')));
    await assertFails(setDoc(doc(db, 'trips/t1/days/2026-11-02'), { date: '2026-11-02', activities: [] }));
  });
  test('用「我的旅程」查詢只會拿到自己是成員的', async () => {
    await assertSucceeds(getDocs(query(collection(as('alice'), 'trips'), where('members', 'array-contains', 'alice'))));
    await assertFails(getDocs(collection(as('alice'), 'trips')));
  });
  test('成員可以編輯行程內容', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'trips/t1'), { title: '南島自駕 7 天', updatedAt: Timestamp.now() }));
    await assertSucceeds(setDoc(doc(as('alice'), 'trips/t1/days/2026-11-02'), { date: '2026-11-02', activities: [{ id: 'a1', title: '米佛峽灣' }] }));
  });
  test('欄位驗證：標題太長、多出欄位、日期格式錯誤都會被擋', async () => {
    const db = as('alice');
    await assertFails(updateDoc(doc(db, 'trips/t1'), { title: 'x'.repeat(61) }));
    await assertFails(updateDoc(doc(db, 'trips/t1'), { hacked: true }));
    await assertFails(updateDoc(doc(db, 'trips/t1'), { startDate: '11/01/2026' }));
    await assertFails(setDoc(doc(db, 'trips/t1/days/2026-11-03'), { date: '2026-11-04', activities: [] }));
  });
});

describe('建立旅程', () => {
  test('建立者必須是自己，成員只有自己', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), 'trips/t3'), { ...baseTrip(), ownerId: 'bob', members: ['bob'], memberProfiles: { bob: { name: 'Bob' } } }));
  });
  test('新旅程、第一天行程、個人資料可以同一批次建立（App 建立旅程的方式）', async () => {
    const db = as('bob');
    const batch = writeBatch(db);
    batch.set(doc(db, 'trips/t3'), { ...baseTrip(), ownerId: 'bob', members: ['bob'], memberProfiles: { bob: { name: 'Bob' } } });
    batch.set(doc(db, 'trips/t3/days/2026-11-01'), { date: '2026-11-01', activities: [{ id: 'a1', title: '出發' }] });
    batch.set(doc(db, 'users/bob/personal/t3'), { carried: {}, shopping: [] });
    await assertSucceeds(batch.commit());
  });
  test('非成員不能用批次偷寫別人旅程的行程', async () => {
    const db = as('mallory');
    const batch = writeBatch(db);
    batch.update(doc(db, 'trips/t1'), { title: '被改掉了' });
    batch.set(doc(db, 'trips/t1/days/2026-11-02'), { date: '2026-11-02', activities: [] });
    await assertFails(batch.commit());
  });
  test('不能幫別人建立，也不能一建立就把別人加進來', async () => {
    await assertFails(setDoc(doc(as('bob'), 'trips/t3'), { ...baseTrip(), ownerId: 'alice', members: ['alice'] }));
    await assertFails(setDoc(doc(as('bob'), 'trips/t3'), { ...baseTrip(), ownerId: 'bob', members: ['bob', 'mallory'] }));
  });
});

describe('用邀請連結加入', () => {
  test('有效的邀請碼可以加入', async () => {
    await assertSucceeds(joinWith(as('bob'), 'bob', VALID_CODE));
  });
  test('過期的邀請碼不行', async () => {
    await assertFails(joinWith(as('bob'), 'bob', EXPIRED_CODE));
  });
  test('別趟旅程的邀請碼不行', async () => {
    await assertFails(joinWith(as('bob'), 'bob', OTHER_TRIP_CODE));
  });
  test('亂猜的邀請碼不行', async () => {
    await assertFails(joinWith(as('bob'), 'bob', 'guessedCode_000000000000'));
  });
  test('只能加入自己，不能順便把別人加進來', async () => {
    await assertFails(joinWith(as('bob'), 'mallory', VALID_CODE));
  });
  test('加入時不能順便改其他內容', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'trips/t1'), {
      members: arrayUnion('bob'), joinCode: VALID_CODE, title: '被改掉了',
    }));
  });
  test('拿到邀請碼也不能列出所有邀請', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), `invites/${VALID_CODE}`)));
    await assertFails(getDocs(collection(as('bob'), 'invites')));
  });
});

describe('用 Gmail 邀請加入', () => {
  const carol = (verified = true) => as('carol', { email: 'carol@gmail.com', email_verified: verified });
  test('被邀請的人可以看到並加入', async () => {
    await assertSucceeds(getDoc(doc(carol(), 'trips/t1')));
    await assertSucceeds(updateDoc(doc(carol(), 'trips/t1'), { members: arrayUnion('carol'), 'memberProfiles.carol': { name: 'Carol' } }));
  });
  test('Email 未驗證不行', async () => {
    await assertFails(getDoc(doc(carol(false), 'trips/t1')));
    await assertFails(updateDoc(doc(carol(false), 'trips/t1'), { members: arrayUnion('carol') }));
  });
  test('不在邀請名單的 Email 不行', async () => {
    const db = as('mallory', { email: 'mallory@gmail.com', email_verified: true });
    await assertFails(getDoc(doc(db, 'trips/t1')));
    await assertFails(updateDoc(doc(db, 'trips/t1'), { members: arrayUnion('mallory') }));
  });
});

describe('成員權限', () => {
  test('旅伴不能改建立者，也不能刪除整趟旅程', async () => {
    await bobJoins();
    await assertFails(updateDoc(doc(as('bob'), 'trips/t1'), { ownerId: 'bob' }));
    await assertFails(deleteDoc(doc(as('bob'), 'trips/t1')));
  });
  test('建立者可以刪除旅程', async () => {
    await assertSucceeds(deleteDoc(doc(as('alice'), 'trips/t1')));
  });
  test('建立者可以標記刪除，也可以復原（拿掉標記）', async () => {
    const db = as('alice');
    await assertSucceeds(updateDoc(doc(db, 'trips/t1'), { deletedAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(db, 'trips/t1'), { deletedAt: deleteField(), updatedAt: Timestamp.now() }));
  });
  test('旅伴不能標記刪除', async () => {
    await bobJoins();
    await assertFails(updateDoc(doc(as('bob'), 'trips/t1'), { deletedAt: Timestamp.now() }));
  });
  test('標記刪除不能順便改其他內容、刪除標記一定要是時間', async () => {
    const db = as('alice');
    await assertFails(updateDoc(doc(db, 'trips/t1'), { deletedAt: Timestamp.now(), title: '改名' }));
    await assertFails(updateDoc(doc(db, 'trips/t1'), { deletedAt: 'yes' }));
  });
  test('已標記刪除的旅程不能再被加入', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'trips/t1'), { deletedAt: Timestamp.now() });
    });
    await assertFails(joinWith(as('bob'), 'bob', VALID_CODE));
    await assertFails(updateDoc(doc(as('carol', { email: 'carol@gmail.com', email_verified: true }), 'trips/t1'), { members: arrayUnion('carol') }));
  });
  test('旅伴可以退出', async () => {
    await bobJoins();
    await assertSucceeds(updateDoc(doc(as('bob'), 'trips/t1'), { members: arrayRemove('bob'), 'memberProfiles.bob': deleteField() }));
  });
  test('旅伴不能把別人踢出去', async () => {
    await bobJoins();
    await assertFails(updateDoc(doc(as('bob'), 'trips/t1'), { members: ['bob'] }));
  });
  test('建立者可以移除旅伴（連同顯示名稱）', async () => {
    await bobJoins();
    await assertSucceeds(updateDoc(doc(as('alice'), 'trips/t1'), { members: arrayRemove('bob'), 'memberProfiles.bob': deleteField(), updatedAt: Timestamp.now() }));
  });
  test('建立者不能移除自己', async () => {
    await bobJoins();
    await assertFails(updateDoc(doc(as('alice'), 'trips/t1'), { members: ['bob'] }));
  });
  test('建立者一次只能移除一位，也不能順便加人或改其他內容', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'trips/t1'), { members: ['alice', 'bob', 'carol'] });
    });
    const db = as('alice');
    await assertFails(updateDoc(doc(db, 'trips/t1'), { members: ['alice'] }));
    await assertFails(updateDoc(doc(db, 'trips/t1'), { members: ['alice', 'bob', 'mallory'] }));
    await assertFails(updateDoc(doc(db, 'trips/t1'), { members: arrayRemove('carol'), title: '順便改名' }));
  });
  test('移除旅伴時不能改到其他人的顯示名稱', async () => {
    await bobJoins();
    await assertFails(updateDoc(doc(as('alice'), 'trips/t1'), { members: arrayRemove('bob'), 'memberProfiles.alice': { name: '改掉' } }));
  });
  test('被移除的人有有效的邀請連結就能再加回來', async () => {
    await bobJoins();
    await updateDoc(doc(as('alice'), 'trips/t1'), { members: arrayRemove('bob'), 'memberProfiles.bob': deleteField() });
    await assertSucceeds(joinWith(as('bob'), 'bob', VALID_CODE));
  });
  test('建立者不能退出（要刪除旅程）', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'trips/t1'), { members: arrayRemove('alice') }));
  });
  test('只能改自己的顯示名稱，不能改別人的', async () => {
    await bobJoins();
    await assertSucceeds(updateDoc(doc(as('bob'), 'trips/t1'), { 'memberProfiles.bob': { name: 'Bobby' } }));
    await assertFails(updateDoc(doc(as('bob'), 'trips/t1'), { 'memberProfiles.alice': { name: '被改掉了' } }));
  });
});

describe('建立邀請連結', () => {
  const invite = (tripId, createdBy, days) => ({ tripId, createdBy, expiresAt: Timestamp.fromMillis(Date.now() + days * DAY) });
  test('成員可以建立 7 天的邀請', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'invites/newInviteCode_012345678901'), invite('t1', 'alice', 7)));
  });
  test('非成員不能幫別人的旅程建立邀請', async () => {
    await assertFails(setDoc(doc(as('mallory'), 'invites/newInviteCode_012345678901'), invite('t1', 'mallory', 7)));
  });
  test('期限超過 30 天、邀請碼太短、冒用別人名義都不行', async () => {
    await assertFails(setDoc(doc(as('alice'), 'invites/newInviteCode_012345678901'), invite('t1', 'alice', 60)));
    await assertFails(setDoc(doc(as('alice'), 'invites/short'), invite('t1', 'alice', 7)));
    await assertFails(setDoc(doc(as('alice'), 'invites/newInviteCode_012345678901'), invite('t1', 'bob', 7)));
  });
});
