import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { submitScore, getWeeklyLeaderboard } from './firebase';
import {
  GOAL_WORDS,
  SAVE_WORDS,
  getKeeperDifficulty,
  keeperOscX,
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
          {reward.prize && <p className="pen-reward-prize">{reward.prize}</p>}
          <p className="pen-reward-msg">{reward.msg}</p>
          <div className="pen-reward-valid">
            <span className="pen-reward-date">
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="pen-reward-rule">Valid today only &middot; show this screen at the counter</span>
          </div>
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
          <a className="pen-order-link-btn" href="https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order" target="_blank" rel="noopener noreferrer">Order Now</a>
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
    // keeper (visible, gliding)
    elapsed: 0, // ms since play started, drives the keeper glide
    keeperX: 0.5, // current normalised keeper position (updated while aiming)
    keeperXAtShot: 0.5, // keeper position captured at the moment of the shot
    willSave: false, // outcome decided at the shot, drives the dive animation
    keeperDiff: getKeeperDifficulty(1),
    // shot in flight
    shotAim: null, // normalised landing point
    flightT: 0,
    ballSpin: 0, // accumulated ball rotation during flight
    resultTimer: 0,
    lastResult: null, // 'goal' | 'save'
    flashWord: '',
    // effects (decay over time; all skipped when reduced motion is on)
    reduced: typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    shake: 0, // camera-shake magnitude in px, decays
    crowdFlash: 0, // 0..1 crowd celebration brightness, decays
    netRipple: null, // { x, y, t } net bulge at the ball's impact point
    confetti: [], // active confetti particles
    bg: null, // cached offscreen backdrop
    bgW: 0,
    bgH: 0,
    lastTs: performance.now(),
  }), [geom]);

  // ─── Drawing ───────────────────────────────────────────────
  const drawScene = useCallback((ctx, s) => {
    const { w, h, g } = s;

    // (Re)build the static backdrop offscreen whenever the size changes, then
    // blit it each frame. Keeps per-frame work to the moving pieces only.
    if (!s.bg || s.bgW !== w || s.bgH !== h) {
      s.bg = buildBackdrop(w, h, g);
      s.bgW = w;
      s.bgH = h;
    }

    ctx.save();
    // Camera shake on goal / save.
    if (s.shake > 0.2 && !s.reduced) {
      ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
    }

    ctx.drawImage(s.bg, 0, 0, w, h);

    // Crowd celebration flash over the stand band.
    if (s.crowdFlash > 0.01) drawCrowdFlash(ctx, w, g, s.crowdFlash);

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

    // Net ripple where the ball hit (behind the keeper).
    if (s.netRipple) drawNetRipple(ctx, g, s.netRipple);

    // Keeper (idle bob + dive handled in keeperPixel)
    const keeperPx = keeperPixel(s);
    drawKeeper(ctx, keeperPx.x, keeperPx.y, keeperPx.lean);

    // Ball motion trail during flight.
    const ballFlying = s.phase === 'shooting' || (s.phase === 'result' && s.shotAim);
    if (ballFlying && !s.reduced) {
      for (let i = 1; i <= 3; i++) {
        const tt = s.flightT - i * 0.06;
        if (tt <= 0) break;
        const p = ballAt(s, tt);
        ctx.save();
        ctx.globalAlpha = 0.13 * (1 - i / 4);
        drawBall(ctx, p.x, p.y, p.scale, 0);
        ctx.restore();
      }
    }

    // Ball
    const ballPx = ballPixel(s);
    drawBall(ctx, ballPx.x, ballPx.y, ballPx.scale, s.ballSpin);

    // Confetti (goal celebration)
    if (s.confetti.length) drawConfetti(ctx, s.confetti);

    // Result flash word: shrink the font so long phrases fit the screen width.
    if (s.phase === 'result' && s.flashWord) {
      ctx.save();
      ctx.textAlign = 'center';
      const maxW = w * 0.9;
      let fontSize = 40;
      ctx.font = `900 ${fontSize}px "Open Sans", sans-serif`;
      const measured = ctx.measureText(s.flashWord).width;
      if (measured > maxW) {
        fontSize = Math.max(16, Math.floor((fontSize * maxW) / measured));
        ctx.font = `900 ${fontSize}px "Open Sans", sans-serif`;
      }
      ctx.fillStyle = s.lastResult === 'goal' ? '#CEAA67' : '#e74c3c';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillText(s.flashWord, w / 2, h * 0.52);
      ctx.restore();
    }

    ctx.restore();
  }, [aimToPixels]);

  // ─── Game loop ─────────────────────────────────────────────
  const gameLoop = useCallback((ts) => {
    const s = stateRef.current;
    if (!s) return;
    const delta = Math.min(ts - s.lastTs, 50);
    s.lastTs = ts;
    s.elapsed += delta;

    // Decay the visual effects.
    stepEffects(s, delta);

    // The keeper glides visibly along the goal while the player lines up.
    if (s.phase === 'aiming') {
      s.keeperX = keeperOscX(s.elapsed, s.keeperDiff);
    }

    if (s.phase === 'shooting') {
      s.flightT += delta / SHOT_FLIGHT_MS;
      s.ballSpin += delta * 0.02; // the ball spins as it flies
      if (s.flightT >= 1) {
        s.flightT = 1;
        const saved = s.willSave;
        if (saved) {
          s.phase = 'result';
          s.lastResult = 'save';
          s.flashWord = SAVE_WORDS[Math.floor(Math.random() * SAVE_WORDS.length)];
          s.resultTimer = 600;
          if (!s.reduced) s.shake = 7;
        } else {
          s.streak += 1;
          s.phase = 'result';
          s.lastResult = 'goal';
          s.flashWord = GOAL_WORDS[Math.floor(Math.random() * GOAL_WORDS.length)];
          s.resultTimer = RESULT_HOLD_GOAL_MS;
          // Celebrate: net ripple at the ball, crowd flash, confetti, big shake.
          const impact = ballAt(s, 1);
          s.netRipple = { x: impact.x, y: impact.y, t: 0 };
          s.crowdFlash = 1;
          if (!s.reduced) {
            s.shake = 12;
            spawnConfetti(s, impact.x, impact.y);
          }
        }
      }
    } else if (s.phase === 'result') {
      s.resultTimer -= delta;
      if (s.resultTimer <= 0) {
        if (s.lastResult === 'save') {
          if (endGameRef.current) endGameRef.current(s.streak);
          return;
        }
        // next penalty: difficulty steps up by kick number (1-5 hard,
        // 6-10 harder, 11+ extreme).
        s.shotNumber += 1;
        s.phase = 'aiming';
        s.shotAim = null;
        s.flightT = 0;
        s.ballSpin = 0;
        s.flashWord = '';
        s.netRipple = null;
        s.confetti = [];
        s.keeperDiff = getKeeperDifficulty(s.shotNumber);
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
      // Ignore a tap / downward flick: must drag upward toward goal. A small
      // up-flick is allowed so low/bottom-corner shots register.
      if (dragY > -10 || Math.hypot(dragX, dragY) < 24) return;
      const rawAim = dragToAim(dragX, dragY, 220);
      const aim = applyPowerWobble(rawAim, rawAim.power);
      s.shotAim = aim;
      // Freeze the keeper at the instant of the shot, plus a small random
      // anticipation nudge (tier-scaled) so it cannot be perfectly memorised.
      // Past 10 goals readBias also pulls the keeper toward the actual shot,
      // closing the far-corner exploit and capping marathon streaks.
      const anticipate = s.keeperDiff.anticipate || 0;
      const readBias = s.keeperDiff.readBias || 0;
      s.keeperXAtShot = s.keeperX
        + readBias * (aim.x - s.keeperX)
        + (Math.random() - 0.5) * 2 * anticipate;
      // Decide the outcome now so the dive animation can match it: a save dives
      // onto the ball, a goal stops short.
      s.willSave = isSaved(aim, s.keeperXAtShot, s.keeperDiff);
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

// ─── Static backdrop (pre-rendered once per size) ────────────
// Draws every non-moving layer to an offscreen canvas so the per-frame loop
// only has to blit it plus the moving pieces. Keeps things smooth on phones.
function buildBackdrop(w, h, g) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  // Night sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#012020');
  sky.addColorStop(0.55, '#013a3a');
  sky.addColorStop(1, '#0a5252');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  drawStands(ctx, w, g);
  drawPylons(ctx, w, g);

  // Floodlight glow over the pitch.
  const glow = ctx.createRadialGradient(w / 2, -h * 0.1, 0, w / 2, -h * 0.1, w * 0.95);
  glow.addColorStop(0, 'rgba(206,170,103,0.3)');
  glow.addColorStop(0.5, 'rgba(206,170,103,0.05)');
  glow.addColorStop(1, 'rgba(206,170,103,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  drawCrowdBase(ctx, w, g);
  drawPitch(ctx, w, h, g);
  drawGoal(ctx, g);
  return c;
}

// Tiered stands behind the goal, fading up into the dark.
function drawStands(ctx, w, g) {
  const base = g.goalTop - 10;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const y = base - 14 - i * 16;
    if (y < 0) break;
    ctx.fillStyle = `rgba(0,0,0,${0.28 + i * 0.08})`;
    ctx.fillRect(0, y, w, 16);
  }
  ctx.restore();
}

// Two floodlight pylons with a glowing lamp array, upper corners.
function drawPylons(ctx, w, g) {
  const top = Math.max(6, g.goalTop - 92);
  const headY = top;
  const poleBottom = g.goalTop - 18;
  if (poleBottom <= headY) return;
  for (const px of [w * 0.12, w * 0.88]) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,130,130,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, headY + 10);
    ctx.lineTo(px, poleBottom);
    ctx.stroke();
    // lamp panel
    ctx.fillStyle = '#1c2626';
    roundRect(ctx, px - 16, headY, 32, 12, 3);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#fff7e0' : '#ffe9b0';
      ctx.beginPath();
      ctx.arc(px - 12 + i * 5, headY + 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    const lampGlow = ctx.createRadialGradient(px, headY + 6, 0, px, headY + 6, 60);
    lampGlow.addColorStop(0, 'rgba(255,245,210,0.22)');
    lampGlow.addColorStop(1, 'rgba(255,245,210,0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(px - 60, headY - 40, 120, 120);
    ctx.restore();
  }
}

// Static crowd speckle inside the stand band.
function drawCrowdBase(ctx, w, g) {
  const standTop = g.goalTop - 52;
  const standBot = g.goalTop - 10;
  if (standBot <= 0) return;
  const shades = ['#CEAA67', '#9fd6c0', '#e8e8e8', '#BB8750', '#7fb7a6', '#d8d8d8', '#c6ff3d'];
  ctx.save();
  ctx.globalAlpha = 0.5;
  const cols = Math.floor(w / 12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = shades[(c * 73 + r * 131) % 7];
      ctx.beginPath();
      ctx.arc(6 + c * 12 + (r % 2) * 6, standTop + 8 + r * 13, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Perspective pitch: striped turf, grain texture, and penalty-box markings.
function drawPitch(ctx, w, h, g) {
  const pitchTop = g.goalBottom - 6;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w * 0.26, pitchTop);
  ctx.lineTo(w * 0.74, pitchTop);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.clip();

  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1f7a46' : '#155c33';
    const y0 = pitchTop + ((h - pitchTop) * i) / stripes;
    const y1 = pitchTop + ((h - pitchTop) * (i + 1)) / stripes;
    ctx.fillRect(0, y0, w, y1 - y0);
  }

  // Grain: faint deterministic speckle for turf texture.
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 240; i++) {
    const gx = ((i * 977) % 1000) / 1000 * w;
    const gy = pitchTop + (((i * 613) % 1000) / 1000) * (h - pitchTop);
    ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Penalty markings, drawn in perspective (wider at the bottom).
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  const cx = w / 2;
  const boxTopY = pitchTop + (h - pitchTop) * 0.12;
  const boxBotY = pitchTop + (h - pitchTop) * 0.62;
  const boxTopHalf = w * 0.16;
  const boxBotHalf = w * 0.34;
  ctx.beginPath();
  ctx.moveTo(cx - boxTopHalf, boxTopY);
  ctx.lineTo(cx + boxTopHalf, boxTopY);
  ctx.lineTo(cx + boxBotHalf, boxBotY);
  ctx.lineTo(cx - boxBotHalf, boxBotY);
  ctx.closePath();
  ctx.stroke();
  // six-yard box
  const sixTopY = pitchTop + (h - pitchTop) * 0.04;
  const sixTopHalf = w * 0.09;
  const sixBotHalf = w * 0.17;
  ctx.beginPath();
  ctx.moveTo(cx - sixTopHalf, sixTopY);
  ctx.lineTo(cx + sixTopHalf, sixTopY);
  ctx.lineTo(cx + sixBotHalf, boxTopY);
  ctx.lineTo(cx - sixBotHalf, boxTopY);
  ctx.closePath();
  ctx.stroke();
  // penalty spot + arc
  const spotY = pitchTop + (h - pitchTop) * 0.42;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(cx, spotY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, boxTopY, w * 0.12, (h - pitchTop) * 0.05, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

// Goal frame + static net.
function drawGoal(ctx, g) {
  ctx.save();
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
  ctx.fillStyle = '#f4f4f4';
  const bar = 7;
  ctx.fillRect(g.goalLeft - bar, g.goalTop - bar, g.goalW + bar * 2, bar);
  ctx.fillRect(g.goalLeft - bar, g.goalTop - bar, bar, g.goalH + bar);
  ctx.fillRect(g.goalRight, g.goalTop - bar, bar, g.goalH + bar);
  ctx.restore();
}

// ─── Dynamic effects ─────────────────────────────────────────
// Decay all the transient effects by elapsed time.
function stepEffects(s, delta) {
  if (s.shake > 0) s.shake = Math.max(0, s.shake - delta * 0.05);
  if (s.crowdFlash > 0) s.crowdFlash = Math.max(0, s.crowdFlash - delta * 0.0016);
  if (s.netRipple) {
    s.netRipple.t += delta;
    if (s.netRipple.t > 700) s.netRipple = null;
  }
  if (s.confetti.length) {
    for (const p of s.confetti) {
      p.life -= delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 0.0009 * delta; // gravity
      p.rot += p.vr * delta;
    }
    s.confetti = s.confetti.filter((p) => p.life > 0);
  }
}

// Brighten the crowd band during a celebration.
function drawCrowdFlash(ctx, w, g, k) {
  const standTop = g.goalTop - 52;
  const standBot = g.goalTop - 8;
  if (standBot <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.5 * k;
  const grad = ctx.createLinearGradient(0, standTop, 0, standBot);
  grad.addColorStop(0, 'rgba(206,170,103,0.9)');
  grad.addColorStop(1, 'rgba(206,170,103,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, standTop, w, standBot - standTop);
  ctx.restore();
}

// A bulge in the net where the ball struck.
function drawNetRipple(ctx, g, ripple) {
  const x = Math.max(g.goalLeft + 6, Math.min(g.goalRight - 6, ripple.x));
  const y = Math.max(g.goalTop + 6, Math.min(g.goalBottom - 4, ripple.y));
  const p = Math.min(1, ripple.t / 700);
  // Rings expand outward as the ripple ages; guard radii to stay positive.
  const grow = p * 22;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - p)})`;
  ctx.lineWidth = 1.4;
  for (let i = 1; i <= 3; i++) {
    const rad = Math.max(1, i * 7 + grow);
    ctx.beginPath();
    ctx.ellipse(x, y, rad, Math.max(1, rad * 0.7), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Spawn a capped burst of confetti at the impact point.
function spawnConfetti(s, x, y) {
  const colours = ['#CEAA67', '#BB8750', '#9fd6c0', '#ffffff', '#c6ff3d', '#ff8a65'];
  const n = 64;
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const spd = 0.12 + Math.random() * 0.26;
    out.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 0.18,
      vr: (Math.random() - 0.5) * 0.02,
      rot: Math.random() * Math.PI,
      size: 3 + Math.random() * 4,
      colour: colours[i % colours.length],
      life: 900 + Math.random() * 500,
      maxLife: 1400,
    });
  }
  s.confetti = out;
}

function drawConfetti(ctx, particles) {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 500));
    ctx.fillStyle = p.colour;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Pixel helpers (module-scope, pure) ──────────────────────
// Ball position along its flight arc at normalised time t (0 = spot, 1 = goal).
function ballAt(s, t) {
  const { g } = s;
  const tgt = { x: g.goalLeft + s.shotAim.x * g.goalW, y: g.goalTop + s.shotAim.y * g.goalH };
  return {
    x: g.ballX0 + (tgt.x - g.ballX0) * t,
    y: g.ballY0 + (tgt.y - g.ballY0) * t - g.arcLift * Math.sin(Math.PI * t),
    scale: 1 - 0.45 * t,
  };
}

function ballPixel(s) {
  const { g } = s;
  if (s.phase === 'shooting' || (s.phase === 'result' && s.shotAim)) {
    return ballAt(s, s.flightT);
  }
  return { x: g.ballX0, y: g.ballY0, scale: 1 };
}

function keeperPixel(s) {
  const { g } = s;
  const diff = s.keeperDiff;
  const guardYpx = g.goalTop + g.goalH * diff.guardY;
  const xToPx = (nx) => g.goalLeft + nx * g.goalW;
  if ((s.phase === 'shooting' || s.phase === 'result') && s.shotAim) {
    // The dive target depends on the outcome so the animation reads true:
    //   save  -> commit right onto the ball (a clear catch)
    //   goal  -> stop at the keeper's reach limit (a clear miss, ball sneaks by)
    let targetX;
    let targetY;
    if (s.willSave) {
      targetX = s.shotAim.x;
      targetY = s.shotAim.y;
    } else {
      const lungeX = Math.max(-diff.dive, Math.min(diff.dive, s.shotAim.x - s.keeperXAtShot));
      const lungeY = Math.max(-diff.diveVert, Math.min(diff.diveVert, s.shotAim.y - diff.guardY));
      targetX = s.keeperXAtShot + lungeX;
      targetY = diff.guardY + lungeY;
    }
    const t = Math.min(1, s.flightT * 1.15);
    const e = 1 - (1 - t) * (1 - t); // ease-out
    const startPx = xToPx(s.keeperXAtShot);
    const endPx = xToPx(targetX);
    const endYpx = g.goalTop + g.goalH * targetY;
    return {
      x: startPx + (endPx - startPx) * e,
      y: guardYpx + (endYpx - guardYpx) * e,
      lean: Math.sign(targetX - s.keeperXAtShot),
    };
  }
  // Aiming / idle: the keeper glides at its current position with a small
  // ready-stance bob so it feels alive.
  const bob = s.reduced ? 0 : Math.sin(s.elapsed * 0.005) * 2;
  return { x: xToPx(s.keeperX), y: guardYpx + bob, lean: 0 };
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
  ctx.font = '900 14px "Open Sans", sans-serif';
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
  ctx.font = '900 11px "Open Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('26', 0, 4);

  // head
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath();
  ctx.arc(0, -23, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBall(ctx, x, y, scale, spin = 0) {
  const r = 21 * scale;
  ctx.save();
  // shadow (fixed under the ball, does not spin)
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // ball body with a fixed light highlight
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#dfe6e6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // pentagons (BnB teal), rotated by the spin so the ball visibly turns
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#003333';
  ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.5, r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.62, -r * 0.4, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 0.6, -r * 0.32, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
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
