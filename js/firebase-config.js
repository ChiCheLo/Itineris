// Firebase 專案設定（Firebase 主控台 → 專案設定 → 你的應用程式）
// 這些值不是密碼，本來就會出現在網頁裡；資料安全由 firestore.rules 在伺服器端把關。
export const firebaseConfig = {
  apiKey: 'AIzaSyCgz1spinZ5auvhyoYiiOCNuFSii4fsomQ',
  // 登入網域用網站自己的網址：登入頁（/__/auth/handler）跟 App 同一個網域，
  // iPhone 加到主畫面後 Safari 才不會擋掉登入資訊（D-067）
  authDomain: 'itineris-de7ab.web.app',
  projectId: 'itineris-de7ab',
  storageBucket: 'itineris-de7ab.firebasestorage.app',
  messagingSenderId: '339627342938',
  appId: '1:339627342938:web:cf16f8b8d4ff3def83ac63',
};
