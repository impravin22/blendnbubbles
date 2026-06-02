import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { submitScore, getWeeklyLeaderboard } from './firebase';
import {
  GOAL_WORDS,
  SAVE_WORDS,
  getKeeperDifficulty,
  pickKeeperGuess,
  isSaved,
  dragToAim,
  applyPowerWobble,
  getReward,
} from './penaltyLogic';
import TeamSelectScreen from './TeamSelectScreen';
import { getTeamByCode, numberColourFor } from './teams';
import './PenaltyShootout.css';

// The striker's kit falls back to the BnB home colours until a nation is picked.
const BNB_TEAM = { code: 'BNB', name: 'BnB FC', flag: '🧋', primary: '#004d4d', secondary: '#CEAA67' };

const GAME_KEY = 'football';

// ─── Geofence (BlendNBubbles, Barrackpore) ───────────────────
// OFF for launch: everyone can play while we trial the game. Flip
// GEOFENCE_ENABLED to true to restrict play to within MAX_DISTANCE_M of the
// shop, reusing the same coordinates the Boba Catcher game verified.
const GEOFENCE_ENABLED = false;
const STORE_LAT = 22.7579739;
const STORE_LNG = 88.3688296;
const MAX_DISTANCE_M = 100;

function getDistanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Timing constants (ms).
const SHOT_FLIGHT_MS = 520;
const RESULT_HOLD_GOAL_MS = 850;

// ─── Start Screen ────────────────────────────────────────────
function StartScreen({ onStart, highScore }) {
  const [locStatus, setLocStatus] = useState('idle');
  const [locMsg, setLocMsg] = useState('');

  const handleStart = () => {
    if (!GEOFENCE_ENABLED) {
      onStart();
      return;
    }
    if (!navigator.geolocation) {
      setLocStatus('error');
      setLocMsg('Location not supported on this browser.');
      return;
    }
    setLocStatus('checking');
    setLocMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = getDistanceMetres(
          pos.coords.latitude,
          pos.coords.longitude,
          STORE_LAT,
          STORE_LNG,
        );
        if (dist <= MAX_DISTANCE_M) {
          setLocStatus('idle');
          onStart();
        } else {
          setLocStatus('too_far');
          setLocMsg('You need to be at BlendNBubbles to play! Visit us at Feeder Road, Barrackpore.');
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus('denied');
          setLocMsg("Please allow location access to play. We only check that you're at the store.");
        } else {
          setLocStatus('error');
          setLocMsg('Could not get your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="pen-screen pen-start-screen">
      <div className="pen-start-content">
        <img src={process.env.PUBLIC_URL + '/logo.svg'} alt="BlendNBubbles" className="pen-game-logo" />
        <span className="pen-season-badge">SEASON '26</span>
        <h1 className="pen-game-title">BnB Shootout '26</h1>
        <p className="pen-game-subtitle">Pull on the BnB kit. Beat the keeper. Keep the streak alive.</p>

        <div className="pen-howto">
          <div className="pen-howto-item"><span className="pen-howto-ic">👆</span>Drag from the ball to aim &amp; power</div>
          <div className="pen-howto-item"><span className="pen-howto-ic">🧤</span>Keeper reads you: mix your corners</div>
          <div className="pen-howto-item"><span className="pen-howto-ic">🔥</span>Score until he saves one</div>
        </div>

        {highScore > 0 && <p className="pen-high-score">Best run: {highScore} goals</p>}

        <button className="pen-start-btn" onClick={handleStart} disabled={locStatus === 'checking'}>
          {locStatus === 'checking' ? 'Checking location...' : 'Take the First Penalty'}
        </button>

        {locMsg && <p className="pen-loc-msg">{locMsg}</p>}

        <p className="pen-tagline">Queue mein wait karo, goal maaro!</p>
        <Link to="/menu" className="pen-menu-link">View Our Menu</Link>
      </div>
    </div>
  );
}

function GameHUD({ streak, shotNumber, team }) {
  // Broadcast-style scoreboard bug: the player's nation vs the Keeper, live
  // score = streak. The badge keeps the BnB mark; the team shows flag + code.
  return (
    <div className="pen-hud">
      <div className="pen-scorebug">
        <span className="pen-sb-badge">BnB</span>
        <span className="pen-sb-team">
          <span className="pen-sb-flag" aria-hidden="true">{team.flag}</span> {team.code}
        </span>
        <span className="pen-sb-score">{streak}</span>
        <span className="pen-sb-sep">-</span>
        <span className="pen-sb-score pen-sb-score-keeper">{shotNumber - 1 - streak}</span>
        <span className="pen-sb-team pen-sb-team-keeper">GK</span>
      </div>
      <div className="pen-scorebug-meta">
        <span className="pen-sb-pen">PEN #{shotNumber}</span>
        <span className="pen-sb-season">SHOOTOUT '26</span>
      </div>
    </div>
  );
}

function GameOverScreen({
  score, highScore, onSubmit, onSkip,
  playerName, playerPhone, setPlayerName, setPlayerPhone,
  submitting, submitted, submitError,
}) {
  const isNewHigh = score >= highScore && score > 0;
  const reward = getReward(score);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !playerPhone.trim()) return;
    onSubmit();
  };

  return (
    <div className="pen-screen pen-gameover-screen">
      <div className="pen-gameover-content">
        {isNewHigh && <div className="pen-new-high">New Best Run!</div>}
        <h2 className="pen-gameover-title">Full Time</h2>

        <div className="pen-score-display">
          <div className="pen-final-score">{score}</div>
          <div className="pen-score-label">goals this run</div>
        </div>

        <div className="pen-reward-card">
          <div className="pen-reward-tier">{reward.tier}</div>
          <p className="pen-reward-msg">{reward.msg}</p>
        </div>

        {!submitted ? (
          <form className="pen-submit-form" onSubmit={handleSubmit}>
            <p className="pen-form-title">Join the Weekly Leaderboard</p>
            <input
              className="pen-input"
              type="text"
              placeholder="Your Name"
              aria-label="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              autoComplete="name"
            />
            <input
              className="pen-input"
              type="tel"
              placeholder="Phone Number"
              aria-label="Phone number"
              value={playerPhone}
              onChange={(e) => setPlayerPhone(e.target.value)}
              maxLength={15}
              autoComplete="tel"
            />
            {submitError && <p className="pen-submit-error" role="alert">{submitError}</p>}
            <button className="pen-start-btn" type="submit" disabled={submitting || !playerName.trim() || !playerPhone.trim()}>
              {submitting ? 'Submitting...' : 'Submit Score'}
            </button>
            <button type="button" className="pen-skip-btn" onClick={onSkip}>
              Skip &amp; View Leaderboard
            </button>
          </form>
        ) : (
          <div className="pen-submit-success" role="status">
            <span className="pen-check-icon">&#10003;</span> Score submitted!
          </div>
        )}

        <p className="pen-gameover-footer">BlendNBubbles &middot; Barrackpore, Kolkata</p>
      </div>
    </div>
  );
}

function LeaderboardScreen({ leaderboard, playerScore, loading, onRestart }) {
  return (
    <div className="pen-screen pen-leaderboard-screen">
      <div className="pen-leaderboard-content">
        <h2 className="pen-lb-title">This Week's Top Strikers</h2>
        <p className="pen-lb-subtitle">Your run: {playerScore} goals</p>

        {loading ? (
          <div className="pen-lb-loading">Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div className="pen-lb-empty">No goals yet this week. Be the first!</div>
        ) : (
          <div className="pen-lb-list">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className={`pen-lb-row ${entry.score === playerScore ? 'pen-lb-highlight' : ''}`}>
                <span className="pen-lb-rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                {getTeamByCode(entry.team) && (
                  <span className="pen-lb-flag" aria-hidden="true">{getTeamByCode(entry.team).flag}</span>
                )}
                <span className="pen-lb-name">{entry.name}</span>
                <span className="pen-lb-score">{entry.score} goals</span>
              </div>
            ))}
          </div>
        )}

        <div className="pen-gameover-actions">
          <button className="pen-restart-btn" onClick={onRestart}>Play Again</button>
          <Link to="/menu" className="pen-order-link-btn">Order Now</Link>
        </div>

        <p className="pen-gameover-footer">BlendNBubbles &middot; Barrackpore, Kolkata</p>
      </div>
    </div>
  );
}

// ─── Main Game Component ─────────────────────────────────────
function PenaltyShootout() {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const stateRef = useRef(null);
  const endGameRef = useRef(null);
  const prevStreakRef = useRef(0);
  const prevShotRef = useRef(1);
  const submitTimeoutRef = useRef(null);

  const [screen, setScreen] = useState('start');
  const [streak, setStreak] = useState(0);
  const [shotNumber, setShotNumber] = useState(1);
  const [highScore, setHighScore] = useState(() =>
    parseInt(localStorage.getItem('penaltyHighScore') || '0', 10),
  );
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('bobaPlayerName') || '');
  const [playerPhone, setPlayerPhone] = useState(() => localStorage.getItem('bobaPlayerPhone') || '');
  const [team, setTeam] = useState(() => getTeamByCode(localStorage.getItem('penaltyTeam')) || BNB_TEAM);

  useEffect(() => {
    const prevTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta ? meta.getAttribute('content') : null;
    document.title = "BnB Shootout '26 - BlendNBubbles Game";
    if (meta) {
      meta.setAttribute('content', "Play BnB Shootout '26 while you wait at BlendNBubbles Barrackpore: beat the keeper, climb the weekly leaderboard, win rewards.");
    }
    // Restore on unmount so other SPA routes keep their own title / description.
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc !== null) meta.setAttribute('content', prevDesc);
    };
  }, []);

  // ─── Geometry helper ───────────────────────────────────────
  const geom = useCallback((w, h) => {
    const goalLeft = w * 0.16;
    const goalRight = w * 0.84;
    const goalTop = h * 0.13;
    const goalBottom = h * 0.4;
    return {
      goalLeft,
      goalRight,
      goalTop,
      goalBottom,
      goalW: goalRight - goalLeft,
      goalH: goalBottom - goalTop,
      ballX0: w / 2,
      ballY0: h * 0.82,
      arcLift: h * 0.14,
    };
  }, []);

  const aimToPixels = useCallback((aim, g) => ({
    x: g.goalLeft + aim.x * g.goalW,
    y: g.goalTop + aim.y * g.goalH,
  }), []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.getContext('2d').scale(dpr, dpr);
    if (stateRef.current) {
      stateRef.current.w = rect.width;
      stateRef.current.h = rect.height;
      stateRef.current.g = geom(rect.width, rect.height);
    }
  }, [geom]);

  const createState = useCallback((w, h, kit) => ({
    w,
    h,
    g: geom(w, h),
    team: kit, // selected nation kit, drives the striker colours + scorebug
    phase: 'aiming', // aiming | shooting | result
    streak: 0,
    shotNumber: 1,
    // drag tracking
    dragging: false,
    dragStart: null,
    dragCur: null,
    // shot in flight
    shotAim: null, // normalised landing point
    keeperGuess: null, // normalised dive point
    keeperDiff: getKeeperDifficulty(0),
    flightT: 0,
    resultTimer: 0,
    lastResult: null, // 'goal' | 'save'
    flashWord: '',
    lastTs: performance.now(),
  }), [geom]);

  // ─── Drawing ───────────────────────────────────────────────
  const drawScene = useCallback((ctx, s) => {
    const { w, h, g } = s;

    // Night sky + floodlight glow
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#012a2a');
    sky.addColorStop(0.6, '#004444');
    sky.addColorStop(1, '#0a5252');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w / 2, -h * 0.1, 0, w / 2, -h * 0.1, w * 0.9);
    glow.addColorStop(0, 'rgba(206,170,103,0.28)');
    glow.addColorStop(0.5, 'rgba(206,170,103,0.05)');
    glow.addColorStop(1, 'rgba(206,170,103,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Crowd stand behind the goal: a dark tier dotted with speckled fans for
    // a stadium feel. Static (no per-frame randomness) so it never flickers.
    const standTop = g.goalTop - 52;
    const standBot = g.goalTop - 10;
    if (standBot > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, standTop, w, standBot - standTop);
      const cols2 = Math.floor(w / 12);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < cols2; c++) {
          // Deterministic pseudo-random shade from indices (no Math.random).
          const seed = (c * 73 + r * 131) % 7;
          const shades = ['#CEAA67', '#9fd6c0', '#e8e8e8', '#BB8750', '#7fb7a6', '#d8d8d8', '#c6ff3d'];
          ctx.fillStyle = shades[seed];
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(6 + c * 12 + (r % 2) * 6, standTop + 8 + r * 13, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Perspective pitch
    const pitchTop = g.goalBottom - 6;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.26, pitchTop);
    ctx.lineTo(w * 0.74, pitchTop);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    const stripeCount = 7;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1f7a46' : '#155c33';
      const y0 = pitchTop + ((h - pitchTop) * i) / stripeCount;
      const y1 = pitchTop + ((h - pitchTop) * (i + 1)) / stripeCount;
      ctx.fillRect(0, y0, w, y1 - y0);
    }
    ctx.restore();

    // Goal: net + posts + faint zone hints
    ctx.save();
    // net
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    const cols = 9;
    const rows = 5;
    for (let c = 0; c <= cols; c++) {
      const x = g.goalLeft + (g.goalW * c) / cols;
      ctx.beginPath();
      ctx.moveTo(x, g.goalTop);
      ctx.lineTo(x, g.goalBottom);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = g.goalTop + (g.goalH * r) / rows;
      ctx.beginPath();
      ctx.moveTo(g.goalLeft, y);
      ctx.lineTo(g.goalRight, y);
      ctx.stroke();
    }
    // posts + crossbar
    ctx.fillStyle = '#f4f4f4';
    const bar = 7;
    ctx.fillRect(g.goalLeft - bar, g.goalTop - bar, g.goalW + bar * 2, bar); // crossbar
    ctx.fillRect(g.goalLeft - bar, g.goalTop - bar, bar, g.goalH + bar); // left post
    ctx.fillRect(g.goalRight, g.goalTop - bar, bar, g.goalH + bar); // right post
    ctx.restore();

    // Keeper
    const keeperPx = keeperPixel(s);
    drawKeeper(ctx, keeperPx.x, keeperPx.y, keeperPx.lean);

    // Aim guide while dragging
    if (s.phase === 'aiming' && s.dragging && s.dragStart && s.dragCur) {
      const dragX = s.dragCur.x - s.dragStart.x;
      const dragY = s.dragCur.y - s.dragStart.y;
      const aim = dragToAim(dragX, dragY, 220);
      const tgt = aimToPixels(aim, g);
      // dashed guide
      ctx.save();
      ctx.strokeStyle = 'rgba(206,170,103,0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 9]);
      ctx.beginPath();
      ctx.moveTo(g.ballX0, g.ballY0);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // reticle
      ctx.strokeStyle = '#CEAA67';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#CEAA67';
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // power meter
      drawPowerMeter(ctx, w, h, aim.power);
    }

    // Striker in the BnB home kit, planted just behind/left of the spot so the
    // ball sits at his feet. Drawn before the ball so the ball layers on top.
    drawStriker(ctx, g.ballX0 - 46, g.ballY0 - 6, s.team);

    // Ball
    const ballPx = ballPixel(s);
    drawBall(ctx, ballPx.x, ballPx.y, ballPx.scale);

    // Result flash word
    if (s.phase === 'result' && s.flashWord) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 40px Poppins, sans-serif';
      ctx.fillStyle = s.lastResult === 'goal' ? '#CEAA67' : '#e74c3c';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillText(s.flashWord, w / 2, h * 0.52);
      ctx.restore();
    }
  }, [aimToPixels]);

  // ─── Game loop ─────────────────────────────────────────────
  const gameLoop = useCallback((ts) => {
    const s = stateRef.current;
    if (!s) return;
    const delta = Math.min(ts - s.lastTs, 50);
    s.lastTs = ts;

    if (s.phase === 'shooting') {
      s.flightT += delta / SHOT_FLIGHT_MS;
      if (s.flightT >= 1) {
        s.flightT = 1;
        const saved = isSaved(s.shotAim, s.keeperGuess, s.keeperDiff);
        if (saved) {
          s.phase = 'result';
          s.lastResult = 'save';
          s.flashWord = SAVE_WORDS[Math.floor(Math.random() * SAVE_WORDS.length)];
          s.resultTimer = 600;
        } else {
          s.streak += 1;
          s.phase = 'result';
          s.lastResult = 'goal';
          s.flashWord = GOAL_WORDS[Math.floor(Math.random() * GOAL_WORDS.length)];
          s.resultTimer = RESULT_HOLD_GOAL_MS;
        }
      }
    } else if (s.phase === 'result') {
      s.resultTimer -= delta;
      if (s.resultTimer <= 0) {
        if (s.lastResult === 'save') {
          if (endGameRef.current) endGameRef.current(s.streak);
          return;
        }
        // next penalty, harder keeper
        s.shotNumber += 1;
        s.phase = 'aiming';
        s.shotAim = null;
        s.keeperGuess = null;
        s.flightT = 0;
        s.flashWord = '';
        s.keeperDiff = getKeeperDifficulty(s.streak);
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawScene(ctx, s);

    if (s.streak !== prevStreakRef.current) {
      setStreak(s.streak);
      prevStreakRef.current = s.streak;
    }
    if (s.shotNumber !== prevShotRef.current) {
      setShotNumber(s.shotNumber);
      prevShotRef.current = s.shotNumber;
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [drawScene]);

  const endGame = useCallback((finalScore) => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    stateRef.current = null;
    const stored = parseInt(localStorage.getItem('penaltyHighScore') || '0', 10);
    if (finalScore > stored) {
      localStorage.setItem('penaltyHighScore', String(finalScore));
      setHighScore(finalScore);
    }
    setStreak(finalScore);
    setScreen('gameover');
  }, []);
  endGameRef.current = endGame;

  // ─── Leaderboard ───────────────────────────────────────────
  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      setLeaderboard(await getWeeklyLeaderboard(GAME_KEY));
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLbLoading(false);
    }
  }, []);

  const handleSubmitScore = useCallback(async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      localStorage.setItem('bobaPlayerName', playerName.trim());
      localStorage.setItem('bobaPlayerPhone', playerPhone.trim());
      await submitScore(playerName, playerPhone, streak, GAME_KEY, team.code);
      setSubmitted(true);
      submitTimeoutRef.current = setTimeout(async () => {
        let data = [];
        try {
          data = await getWeeklyLeaderboard(GAME_KEY);
        } catch (err) {
          console.error('Failed to load leaderboard:', err);
        }
        const included = data.some((e) => e.name === playerName.trim() && e.score === streak);
        if (!included) {
          data.push({ id: 'self', name: playerName.trim(), score: streak, team: team.code });
          data.sort((a, b) => b.score - a.score);
          data = data.slice(0, 10);
        }
        setLeaderboard(data);
        setScreen('leaderboard');
      }, 800);
    } catch (err) {
      console.error('Submit failed:', err);
      setSubmitError('Could not submit. Try again!');
    } finally {
      setSubmitting(false);
    }
  }, [playerName, playerPhone, streak, team]);

  const handleSkipToLeaderboard = useCallback(async () => {
    await loadLeaderboard();
    setScreen('leaderboard');
  }, [loadLeaderboard]);

  // ─── Start ─────────────────────────────────────────────────
  // `kit` is the nation chosen on the team-select screen; falls back to the
  // current team (used by "Play Again", which reuses the last selection).
  const startGame = useCallback((kit) => {
    const activeKit = kit || team;
    setScreen('playing');
    setStreak(0);
    setShotNumber(1);
    setSubmitted(false);
    setSubmitError('');
    prevStreakRef.current = 0;
    prevShotRef.current = 1;
    requestAnimationFrame(() => {
      setupCanvas();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      stateRef.current = createState(rect.width, rect.height, activeKit);
      stateRef.current.lastTs = performance.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    });
  }, [setupCanvas, createState, gameLoop, team]);

  // Chosen on the team-select screen: remember it and kick off immediately.
  const handlePickTeam = useCallback((picked) => {
    setTeam(picked);
    localStorage.setItem('penaltyTeam', picked.code);
    startGame(picked);
  }, [startGame]);

  // ─── Input (drag to shoot) ─────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || screen !== 'playing') return;

    const toCanvas = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const down = (clientX, clientY) => {
      const s = stateRef.current;
      if (!s || s.phase !== 'aiming') return;
      s.dragging = true;
      s.dragStart = toCanvas(clientX, clientY);
      s.dragCur = { ...s.dragStart };
    };
    const move = (clientX, clientY) => {
      const s = stateRef.current;
      if (!s || !s.dragging) return;
      s.dragCur = toCanvas(clientX, clientY);
    };
    const up = () => {
      const s = stateRef.current;
      if (!s || !s.dragging || s.phase !== 'aiming') return;
      s.dragging = false;
      const dragX = s.dragCur.x - s.dragStart.x;
      const dragY = s.dragCur.y - s.dragStart.y;
      // Ignore a tap / downward flick: must drag upward toward goal.
      if (dragY > -20 || Math.hypot(dragX, dragY) < 24) return;
      const rawAim = dragToAim(dragX, dragY, 220);
      const aim = applyPowerWobble(rawAim, rawAim.power);
      s.shotAim = aim;
      s.keeperGuess = pickKeeperGuess(aim, s.streak);
      s.keeperDiff = getKeeperDifficulty(s.streak);
      s.flightT = 0;
      s.phase = 'shooting';
    };

    const onTouchStart = (e) => { e.preventDefault(); down(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove = (e) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchEnd = (e) => { e.preventDefault(); up(); };
    const onMouseDown = (e) => down(e.clientX, e.clientY);
    const onMouseMove = (e) => move(e.clientX, e.clientY);
    const onMouseUp = () => up();

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [screen, setupCanvas]);

  useEffect(() => () => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
  }, []);

  return (
    <div className="pen-game-container">
      {screen === 'start' && <StartScreen onStart={() => setScreen('teamselect')} highScore={highScore} />}
      {screen === 'teamselect' && (
        <TeamSelectScreen
          onPick={handlePickTeam}
          onBack={() => setScreen('start')}
          initialCode={team.code}
        />
      )}
      {screen === 'playing' && (
        <>
          <GameHUD streak={streak} shotNumber={shotNumber} team={team} />
          <canvas
            ref={canvasRef}
            className="pen-canvas"
            aria-label="Penalty shootout pitch. Drag from the ball to aim and shoot."
            role="img"
          />
          <p className="pen-swipe-hint">Drag from the ball: aim a corner, flick for power</p>
        </>
      )}
      {screen === 'gameover' && (
        <GameOverScreen
          score={streak}
          highScore={highScore}
          onSubmit={handleSubmitScore}
          onSkip={handleSkipToLeaderboard}
          playerName={playerName}
          playerPhone={playerPhone}
          setPlayerName={setPlayerName}
          setPlayerPhone={setPlayerPhone}
          submitting={submitting}
          submitted={submitted}
          submitError={submitError}
        />
      )}
      {screen === 'leaderboard' && (
        <LeaderboardScreen
          leaderboard={leaderboard}
          playerScore={streak}
          loading={lbLoading}
          onRestart={() => setScreen('teamselect')}
        />
      )}
    </div>
  );
}

// ─── Pixel helpers (module-scope, pure) ──────────────────────
function ballPixel(s) {
  const { g } = s;
  if (s.phase === 'shooting' || (s.phase === 'result' && s.shotAim)) {
    const t = s.flightT;
    const tgt = { x: g.goalLeft + s.shotAim.x * g.goalW, y: g.goalTop + s.shotAim.y * g.goalH };
    const x = g.ballX0 + (tgt.x - g.ballX0) * t;
    const y = g.ballY0 + (tgt.y - g.ballY0) * t - g.arcLift * Math.sin(Math.PI * t);
    const scale = 1 - 0.45 * t; // shrinks as it flies away
    return { x, y, scale };
  }
  return { x: g.ballX0, y: g.ballY0, scale: 1 };
}

function keeperPixel(s) {
  const { g } = s;
  const baseX = (g.goalLeft + g.goalRight) / 2;
  const baseY = g.goalTop + g.goalH * 0.62;
  if ((s.phase === 'shooting' || s.phase === 'result') && s.keeperGuess) {
    const t = Math.min(1, s.flightT * 1.1);
    const e = 1 - (1 - t) * (1 - t); // ease-out
    const gx = g.goalLeft + s.keeperGuess.x * g.goalW;
    const gy = g.goalTop + s.keeperGuess.y * g.goalH;
    return { x: baseX + (gx - baseX) * e, y: baseY + (gy - baseY) * e, lean: Math.sign(gx - baseX) };
  }
  return { x: baseX, y: baseY, lean: 0 };
}

// Keeper in the BnB home kit (teal jersey, gold trim, number 1) with white
// gloves, scaled up so it reads clearly. Arms reach toward the dive.
function drawKeeper(ctx, x, y, lean) {
  const BNB = '#004d4d'; // BnB teal jersey
  const TRIM = '#CEAA67'; // BnB gold trim
  const SCALE = 1.35; // keeper sized up so it reads clearly against the goal
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * 0.32);
  ctx.scale(SCALE, SCALE);

  // legs / shorts
  ctx.fillStyle = BNB;
  roundRect(ctx, -10, 16, 8, 16, 3); ctx.fill(); // left leg
  roundRect(ctx, 2, 16, 8, 16, 3); ctx.fill(); // right leg
  // socks (gold)
  ctx.fillStyle = TRIM;
  ctx.fillRect(-10, 30, 8, 6);
  ctx.fillRect(2, 30, 8, 6);

  // jersey torso
  ctx.fillStyle = BNB;
  roundRect(ctx, -12, -16, 24, 34, 7);
  ctx.fill();
  // gold side panels (kit detailing)
  ctx.fillStyle = TRIM;
  ctx.fillRect(-12, -16, 4, 34);
  ctx.fillRect(8, -16, 4, 34);
  // collar
  ctx.fillStyle = TRIM;
  roundRect(ctx, -7, -18, 14, 6, 3);
  ctx.fill();
  // number 1
  ctx.fillStyle = TRIM;
  ctx.font = '900 14px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1', 0, 6);

  // head
  ctx.fillStyle = '#f1d6a8';
  ctx.beginPath();
  ctx.arc(0, -26, 8, 0, Math.PI * 2);
  ctx.fill();

  // arms (BnB kit sleeves) + white gloves reaching out
  ctx.strokeStyle = BNB;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -10); ctx.lineTo(-24, -26);
  ctx.moveTo(10, -10); ctx.lineTo(24, -26);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-26, -28, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(26, -28, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Striker behind the ball, wearing the picked nation's kit (jersey = primary,
// shoulder / sleeve trim = secondary). Number stays 26 for the '26 season; its
// colour is derived from the jersey luminance so it stays legible on any kit.
// Purely cosmetic; sits just below the penalty spot.
function drawStriker(ctx, x, y, team) {
  const kit = team || { primary: '#004d4d', secondary: '#CEAA67' };
  const HOME = kit.primary;
  const TRIM = kit.secondary;
  const NUM = numberColourFor(kit.primary);
  ctx.save();
  ctx.translate(x, y);

  // legs / shorts
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -9, 14, 7, 14, 3); ctx.fill();
  roundRect(ctx, 2, 14, 7, 14, 3); ctx.fill();
  // socks (kit colour)
  ctx.fillStyle = HOME;
  ctx.fillRect(-9, 26, 7, 6);
  ctx.fillRect(2, 26, 7, 6);

  // jersey torso
  ctx.fillStyle = HOME;
  roundRect(ctx, -11, -15, 22, 31, 6);
  ctx.fill();
  // shoulder trim (accent colour)
  ctx.fillStyle = TRIM;
  ctx.fillRect(-11, -15, 22, 4);
  // sleeves
  ctx.fillStyle = HOME;
  roundRect(ctx, -16, -13, 6, 12, 3); ctx.fill();
  roundRect(ctx, 10, -13, 6, 12, 3); ctx.fill();
  ctx.fillStyle = TRIM;
  ctx.fillRect(-16, -13, 6, 3);
  ctx.fillRect(10, -13, 6, 3);
  // number 26
  ctx.fillStyle = NUM;
  ctx.font = '900 11px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('26', 0, 4);

  // head
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath();
  ctx.arc(0, -23, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBall(ctx, x, y, scale) {
  const r = 21 * scale;
  ctx.save();
  // shadow
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // ball
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#dfe6e6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // pentagons (BnB teal)
  ctx.fillStyle = '#003333';
  ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - r * 0.5, y + r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.5, y + r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPowerMeter(ctx, w, h, power) {
  const mx = 18;
  const my = h * 0.5;
  const mh = h * 0.26;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, mx, my - mh / 2, 9, mh, 5);
  ctx.fill();
  const fillH = mh * power;
  const grad = ctx.createLinearGradient(0, my + mh / 2 - fillH, 0, my + mh / 2);
  grad.addColorStop(0, '#e74c3c');
  grad.addColorStop(0.5, '#f1c40f');
  grad.addColorStop(1, '#2ecc71');
  ctx.fillStyle = grad;
  roundRect(ctx, mx, my + mh / 2 - fillH, 9, fillH, 5);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export default PenaltyShootout;
