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

// Default game key for documents written before the multi-game split.
// Boba Catcher scores were stored without a `game` field, so any document
// missing the field is treated as a Boba Catcher score at read time.
const DEFAULT_GAME = 'bobacatcher';

// Per-game score ceilings. Real penalty play tops out at 18 (the keeper's
// read bias walls runs there), so 40 leaves honest headroom while rejecting
// spoofed submissions. Boba Catcher legitimately scores far higher.
export const SCORE_CEILINGS = { football: 40, bobacatcher: 1000 };

/**
 * Whether a score is plausible for the given game: a non-negative integer at
 * or below the game's ceiling. Used to refuse spoofed leaderboard writes.
 */
export function isPlausibleScore(score, game = DEFAULT_GAME) {
  if (!Number.isInteger(score) || score < 0) return false;
  const ceiling = SCORE_CEILINGS[game];
  return ceiling != null ? score <= ceiling : true;
}

export async function submitScore(name, phone, score, game = DEFAULT_GAME, team = null) {
  if (!isPlausibleScore(score, game)) {
    throw new Error(`Implausible score ${score} for ${game}; not submitting.`);
  }
  const doc = {
    name: name.trim(),
    phone: phone.trim(),
    score,
    game,
    week: getWeekKey(),
    createdAt: new Date(),
  };
  // Only write the team field when a nation was chosen, so Boba Catcher rows
  // (which have no team) are not given an empty value.
  if (team) doc.team = team;
  return addDoc(collection(db, 'leaderboard'), doc);
}

export async function getWeeklyLeaderboard(game = DEFAULT_GAME) {
  // Filter by week server-side, then split by game client-side. The game
  // filter runs in JS (not a Firestore `where`) so legacy documents that
  // predate the `game` field still surface on the Boba Catcher board
  // instead of disappearing.
  const q = query(
    collection(db, 'leaderboard'),
    where('week', '==', getWeekKey())
  );
  const snap = await getDocs(q);
  const entries = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(entry => (entry.game || DEFAULT_GAME) === game);
  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, 10);
}
