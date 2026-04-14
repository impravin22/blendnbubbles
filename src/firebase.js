import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBTuYMNsRT665qMD3wwb3UabTfjf6sIm4Q",
  authDomain: "blendnbubbles-b166b.firebaseapp.com",
  projectId: "blendnbubbles-b166b",
  storageBucket: "blendnbubbles-b166b.firebasestorage.app",
  messagingSenderId: "1002005993561",
  appId: "1:1002005993561:web:e10f6c899e85750a35f948",
  measurementId: "G-XBVN20TKF9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - jan1) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function submitScore(name, phone, score) {
  return addDoc(collection(db, 'leaderboard'), {
    name: name.trim(),
    phone: phone.trim(),
    score,
    week: getWeekKey(),
    createdAt: new Date(),
  });
}

export async function getWeeklyLeaderboard() {
  const q = query(
    collection(db, 'leaderboard'),
    where('week', '==', getWeekKey())
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, 10);
}
