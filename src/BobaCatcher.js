import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './BobaCatcher.css';

// ─── Item Types ──────────────────────────────────────────────
const ITEM_TYPES = [
  { type: 'boba',       points: 1,  color: '#3D2B1F', radius: 13, weight: 40, bad: false },
  { type: 'tapioca',    points: 2,  color: '#BB8750', radius: 12, weight: 30, bad: false },
  { type: 'poppingBoba',points: 3,  color: null,      radius: 11, weight: 15, bad: false },
  { type: 'goldenBoba', points: 5,  color: '#FFD700', radius: 15, weight: 8,  bad: false },
  { type: 'teaCup',     points: 10, color: '#003333', radius: 16, weight: 2,  bad: false },
  { type: 'iceCube',    points: 0,  color: '#AAD4E6', radius: 14, weight: 3,  bad: true, effect: 'freeze' },
  { type: 'spill',      points: -3, color: '#8B4513', radius: 13, weight: 2,  bad: true, effect: 'spill' },
];

const POPPING_COLORS = ['#FF6B9D', '#C084FC', '#34D399', '#FB923C', '#60A5FA'];
const COMBO_WORDS = ['Jhakas!', 'Mast!', 'Zabardast!', 'Badhiya!', 'Ek dum!', 'Fatafat!', 'Jhakkas!'];
const GAME_DURATION = 60;

// ─── Weighted Random Pick ────────────────────────────────────
function pickItemType() {
  const totalWeight = ITEM_TYPES.reduce((sum, t) => sum + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const t of ITEM_TYPES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return ITEM_TYPES[0];
}

// ─── Sub-Components ──────────────────────────────────────────
function StartScreen({ onStart, highScore }) {
  return (
    <div className="boba-screen boba-start-screen">
      <div className="boba-start-content">
        <img src={process.env.PUBLIC_URL + '/logo.svg'} alt="BlendNBubbles" className="boba-game-logo" />
        <h1 className="boba-game-title">Boba Catcher</h1>
        <p className="boba-game-subtitle">Catch the boba, score big!</p>

        <div className="boba-instructions">
          <div className="boba-instruction-item">
            <span className="boba-item-preview boba-pearl"></span>
            <span>Boba = 1 pt</span>
          </div>
          <div className="boba-instruction-item">
            <span className="boba-item-preview boba-tapioca"></span>
            <span>Tapioca = 2 pts</span>
          </div>
          <div className="boba-instruction-item">
            <span className="boba-item-preview boba-golden"></span>
            <span>Golden = 5 pts</span>
          </div>
          <div className="boba-instruction-item">
            <span className="boba-item-preview boba-ice"></span>
            <span>Ice = Freeze!</span>
          </div>
        </div>

        <p className="boba-how-to">Slide your finger to move the cup</p>
        {highScore > 0 && <p className="boba-high-score">Best Score: {highScore} pts</p>}

        <button className="boba-start-btn" onClick={onStart}>Start Game</button>

        <p className="boba-tagline">Queue mein wait karo, game khelke maza karo!</p>
        <Link to="/menu" className="boba-menu-link">View Our Menu</Link>
      </div>
    </div>
  );
}

function GameHUD({ score, timeLeft, combo }) {
  return (
    <div className="boba-hud">
      <div className="boba-hud-item">
        <span className="boba-hud-label">Score</span>
        <span className="boba-hud-value">{score}</span>
      </div>
      <div className={`boba-hud-combo ${combo >= 3 ? 'active' : ''}`}>
        {combo >= 3 && `${combo}x Combo!`}
      </div>
      <div className="boba-hud-item">
        <span className="boba-hud-label">Time</span>
        <span className={`boba-hud-value ${timeLeft <= 10 ? 'boba-timer-urgent' : ''}`}>
          {timeLeft}s
        </span>
      </div>
    </div>
  );
}

function GameOverScreen({ score, highScore, onRestart }) {
  const isNewHigh = score >= highScore && score > 0;

  const getReward = () => {
    if (score >= 80) return { tier: 'BOBA MASTER', msg: 'Tumi darun! Show this to the counter for a FREE topping upgrade!' };
    if (score >= 50) return { tier: 'CHAI CHAMPION', msg: 'Bohot badhiya! Show this for 10% off your next drink!' };
    if (score >= 25) return { tier: 'BUBBLE BUDDY', msg: 'Accha khela! Show this for a surprise treat!' };
    return { tier: 'BOBA BEGINNER', msg: 'Aar ekbar try koro! Every player gets a smile from us!' };
  };

  const reward = getReward();

  return (
    <div className="boba-screen boba-gameover-screen">
      <div className="boba-gameover-content">
        {isNewHigh && <div className="boba-new-high">New High Score!</div>}
        <h2 className="boba-gameover-title">Game Over!</h2>

        <div className="boba-score-display">
          <div className="boba-final-score">{score}</div>
          <div className="boba-score-label">points</div>
        </div>

        <div className="boba-reward-card">
          <div className="boba-reward-tier">{reward.tier}</div>
          <p className="boba-reward-msg">{reward.msg}</p>
        </div>

        <div className="boba-gameover-actions">
          <button className="boba-restart-btn" onClick={onRestart}>Play Again</button>
          <Link to="/menu" className="boba-order-link-btn">Order Now</Link>
        </div>

        <p className="boba-gameover-footer">BlendNBubbles &middot; Barrackpore, Kolkata</p>
      </div>
    </div>
  );
}

// ─── Main Game Component ─────────────────────────────────────
function BobaCatcher() {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const gameStateRef = useRef(null);
  const endGameRef = useRef(null);
  const prevScoreRef = useRef(0);
  const prevTimeRef = useRef(GAME_DURATION);

  const [screen, setScreen] = useState('start');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('bobaCatcherHighScore') || '0', 10);
  });

  // Per-route SEO
  useEffect(() => {
    document.title = 'Boba Catcher - BlendNBubbles Game';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Play Boba Catcher while you wait! Catch boba pearls, score big, and win rewards at BlendNBubbles Barrackpore.');
  }, []);

  // ─── Canvas Setup ────────────────────────────────────────
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    if (gameStateRef.current) {
      gameStateRef.current.canvasWidth = rect.width;
      gameStateRef.current.canvasHeight = rect.height;
    }
  }, []);

  // ─── Create Initial Game State ────────────────────────────
  const createGameState = useCallback((w, h) => ({
    canvasWidth: w,
    canvasHeight: h,
    cup: {
      x: w / 2,
      y: h - 70,
      width: 68,
      height: 48,
      targetX: w / 2,
      isFrozen: false,
      frozenTimer: 0,
    },
    items: [],
    particles: [],
    score: 0,
    timeLeft: GAME_DURATION,
    lastTimestamp: performance.now(),
    spawnTimer: 0,
    spawnInterval: 1200,
    baseSpeed: 120,
    speedVariance: 60,
    difficulty: 1,
    comboCount: 0,
    comboTimer: 0,
    screenShake: 0,
  }), []);

  // ─── Spawn Items ──────────────────────────────────────────
  const spawnItem = useCallback((state) => {
    const typeDef = pickItemType();
    const padding = 30;
    const x = padding + Math.random() * (state.canvasWidth - padding * 2);
    const speed = state.baseSpeed + Math.random() * state.speedVariance;
    const color = typeDef.type === 'poppingBoba'
      ? POPPING_COLORS[Math.floor(Math.random() * POPPING_COLORS.length)]
      : typeDef.color;

    state.items.push({
      ...typeDef,
      color,
      x,
      y: -typeDef.radius * 2,
      speed,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 4,
      opacity: 1,
    });
  }, []);

  // ─── Spawn Particles ──────────────────────────────────────
  const spawnParticles = useCallback((x, y, color, count, type) => {
    const state = gameStateRef.current;
    if (!state) return;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 60 + Math.random() * 120;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 600 + Math.random() * 400,
        maxLife: 1000,
        color,
        size: 3 + Math.random() * 4,
        type: type || 'sparkle',
        text: '',
      });
    }
  }, []);

  const spawnTextParticle = useCallback((x, y, text, color) => {
    const state = gameStateRef.current;
    if (!state) return;
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 30,
      vy: -80,
      life: 900,
      maxLife: 900,
      color: color || '#FFD700',
      size: 16,
      type: 'text',
      text,
    });
  }, []);

  // ─── Drawing Functions ─────────────────────────────────────
  const drawBackground = useCallback((ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#F9F6F0');
    grad.addColorStop(1, '#F0EBE1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle decorative dots
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 12; i++) {
      const bx = ((i * 137.5) % w);
      const by = ((i * 97.3) % h);
      ctx.beginPath();
      ctx.arc(bx, by, 20 + (i % 3) * 10, 0, Math.PI * 2);
      ctx.fillStyle = '#BB8750';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  const drawCup = useCallback((ctx, cup) => {
    ctx.save();
    ctx.translate(cup.x, cup.y);

    // Cup body (trapezoid)
    ctx.beginPath();
    ctx.moveTo(-cup.width / 2, 0);
    ctx.lineTo(cup.width / 2, 0);
    ctx.lineTo(cup.width / 2 - 8, cup.height);
    ctx.lineTo(-cup.width / 2 + 8, cup.height);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, cup.height);
    grad.addColorStop(0, '#005050');
    grad.addColorStop(1, '#003333');
    ctx.fillStyle = grad;
    ctx.fill();

    // Gold rim
    ctx.beginPath();
    ctx.moveTo(-cup.width / 2 - 5, -4);
    ctx.lineTo(cup.width / 2 + 5, -4);
    ctx.lineTo(cup.width / 2 + 3, 3);
    ctx.lineTo(-cup.width / 2 - 3, 3);
    ctx.closePath();
    ctx.fillStyle = '#BB8750';
    ctx.fill();

    // Cup label
    ctx.fillStyle = '#CEAA67';
    ctx.font = 'bold 8px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('B&B', 0, cup.height / 2 + 4);

    // Straw
    ctx.fillStyle = '#BB8750';
    ctx.fillRect(-2, -22, 4, 22);
    ctx.beginPath();
    ctx.arc(4, -22, 4, 0, Math.PI, true);
    ctx.fill();

    // Frozen overlay
    if (cup.isFrozen) {
      ctx.beginPath();
      ctx.moveTo(-cup.width / 2, 0);
      ctx.lineTo(cup.width / 2, 0);
      ctx.lineTo(cup.width / 2 - 8, cup.height);
      ctx.lineTo(-cup.width / 2 + 8, cup.height);
      ctx.closePath();
      ctx.fillStyle = 'rgba(170, 212, 230, 0.45)';
      ctx.fill();

      // Ice crystal indicators
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const ix = -12 + i * 12;
        const iy = 10 + i * 8;
        ctx.beginPath();
        ctx.moveTo(ix, iy - 6);
        ctx.lineTo(ix, iy + 6);
        ctx.moveTo(ix - 5, iy - 3);
        ctx.lineTo(ix + 5, iy + 3);
        ctx.moveTo(ix + 5, iy - 3);
        ctx.lineTo(ix - 5, iy + 3);
        ctx.stroke();
      }
    }

    ctx.restore();
  }, []);

  const drawItem = useCallback((ctx, item) => {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    ctx.globalAlpha = item.opacity;

    if (item.type === 'iceCube') {
      // Square with rounded corners
      const s = item.radius;
      ctx.beginPath();
      ctx.moveTo(-s + 3, -s);
      ctx.lineTo(s - 3, -s);
      ctx.quadraticCurveTo(s, -s, s, -s + 3);
      ctx.lineTo(s, s - 3);
      ctx.quadraticCurveTo(s, s, s - 3, s);
      ctx.lineTo(-s + 3, s);
      ctx.quadraticCurveTo(-s, s, -s, s - 3);
      ctx.lineTo(-s, -s + 3);
      ctx.quadraticCurveTo(-s, -s, -s + 3, -s);
      ctx.closePath();

      const iceGrad = ctx.createLinearGradient(-s, -s, s, s);
      iceGrad.addColorStop(0, '#C8E6F0');
      iceGrad.addColorStop(0.5, '#AAD4E6');
      iceGrad.addColorStop(1, '#8CBFD6');
      ctx.fillStyle = iceGrad;
      ctx.fill();

      // Ice facet lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-s + 4, -s + 4);
      ctx.lineTo(s - 4, s - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s - 4, -s + 4);
      ctx.lineTo(-s + 4, s - 4);
      ctx.stroke();

    } else if (item.type === 'spill') {
      // Irregular blob
      ctx.beginPath();
      ctx.moveTo(0, -item.radius);
      ctx.bezierCurveTo(item.radius * 0.8, -item.radius * 0.6, item.radius, 0, item.radius * 0.7, item.radius * 0.5);
      ctx.bezierCurveTo(item.radius * 0.3, item.radius, -item.radius * 0.4, item.radius * 0.8, -item.radius * 0.7, item.radius * 0.4);
      ctx.bezierCurveTo(-item.radius, 0, -item.radius * 0.6, -item.radius * 0.7, 0, -item.radius);
      ctx.closePath();
      ctx.fillStyle = '#8B4513';
      ctx.fill();
      ctx.fillStyle = 'rgba(139, 69, 19, 0.5)';
      ctx.fill();

    } else if (item.type === 'teaCup') {
      // Mini cup shape
      const cw = item.radius * 1.2;
      const ch = item.radius * 1.5;
      ctx.beginPath();
      ctx.moveTo(-cw / 2, -ch / 2);
      ctx.lineTo(cw / 2, -ch / 2);
      ctx.lineTo(cw / 2 - 3, ch / 2);
      ctx.lineTo(-cw / 2 + 3, ch / 2);
      ctx.closePath();
      const cupGrad = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2);
      cupGrad.addColorStop(0, '#005050');
      cupGrad.addColorStop(1, '#003333');
      ctx.fillStyle = cupGrad;
      ctx.fill();
      // Gold rim
      ctx.fillStyle = '#CEAA67';
      ctx.fillRect(-cw / 2 - 2, -ch / 2 - 3, cw + 4, 4);
      // Star
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 4);

    } else if (item.type === 'goldenBoba') {
      // Glowing golden circle
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      const goldGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, item.radius);
      goldGrad.addColorStop(0, '#FFF0A0');
      goldGrad.addColorStop(0.6, '#FFD700');
      goldGrad.addColorStop(1, '#FFA500');
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle = goldGrad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight
      ctx.beginPath();
      ctx.arc(-item.radius * 0.3, -item.radius * 0.3, item.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();

    } else {
      // Standard boba / tapioca / popping boba
      const grad = ctx.createRadialGradient(
        -item.radius * 0.25, -item.radius * 0.25, item.radius * 0.1,
        0, 0, item.radius
      );
      grad.addColorStop(0, lightenColor(item.color, 40));
      grad.addColorStop(1, item.color);

      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Glossy highlight
      ctx.beginPath();
      ctx.arc(-item.radius * 0.3, -item.radius * 0.35, item.radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fill();
    }

    ctx.restore();
  }, []);

  const drawParticle = useCallback((ctx, p) => {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (p.type === 'text') {
      ctx.font = `bold ${p.size}px Poppins, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    ctx.restore();
  }, []);

  // ─── Game Loop ─────────────────────────────────────────────
  const gameLoop = useCallback((timestamp) => {
    const state = gameStateRef.current;
    if (!state) return;

    const delta = Math.min(timestamp - state.lastTimestamp, 50); // cap at 50ms to prevent large jumps
    state.lastTimestamp = timestamp;
    const dt = delta / 1000;

    // Update timer
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      if (endGameRef.current) endGameRef.current(state.score);
      return;
    }

    // Difficulty progression
    const elapsed = GAME_DURATION - state.timeLeft;
    if (elapsed < 15)      { state.spawnInterval = 1200; state.baseSpeed = 120; state.speedVariance = 60; }
    else if (elapsed < 30) { state.spawnInterval = 900;  state.baseSpeed = 165; state.speedVariance = 80; }
    else if (elapsed < 45) { state.spawnInterval = 700;  state.baseSpeed = 210; state.speedVariance = 100; }
    else                   { state.spawnInterval = 500;  state.baseSpeed = 260; state.speedVariance = 130; }

    // Spawn items
    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0) {
      spawnItem(state);
      state.spawnTimer = state.spawnInterval + (Math.random() - 0.5) * 200;
    }

    // Update cup position (smooth lerp)
    if (!state.cup.isFrozen) {
      state.cup.x += (state.cup.targetX - state.cup.x) * 0.14;
    } else {
      state.cup.frozenTimer -= delta;
      if (state.cup.frozenTimer <= 0) {
        state.cup.isFrozen = false;
      }
    }
    // Clamp cup
    const halfCup = state.cup.width / 2 + 5;
    state.cup.x = Math.max(halfCup, Math.min(state.canvasWidth - halfCup, state.cup.x));

    // Update items
    for (let i = state.items.length - 1; i >= 0; i--) {
      const item = state.items[i];
      item.y += item.speed * dt;
      item.rotation += item.rotationSpeed * dt;

      // Check collision with cup
      const cupTop = state.cup.y - 5;
      const cupLeft = state.cup.x - state.cup.width / 2;
      const cupRight = state.cup.x + state.cup.width / 2;

      if (
        item.y + item.radius > cupTop &&
        item.y - item.radius < cupTop + 20 &&
        item.x > cupLeft - 5 &&
        item.x < cupRight + 5
      ) {
        // Collision!
        if (item.bad) {
          if (item.effect === 'freeze') {
            state.cup.isFrozen = true;
            state.cup.frozenTimer = 1500;
            spawnParticles(item.x, item.y, '#AAD4E6', 8, 'sparkle');
            spawnTextParticle(item.x, item.y - 20, 'FREEZE!', '#AAD4E6');
          } else {
            state.score = Math.max(0, state.score + item.points);
            spawnParticles(item.x, item.y, '#FF4444', 6, 'sparkle');
            spawnTextParticle(item.x, item.y - 20, `${item.points}`, '#FF4444');
          }
          state.comboCount = 0;
          state.screenShake = 8;
        } else {
          // Good item caught
          state.comboCount++;
          state.comboTimer = 1500;
          let multiplier = 1;
          if (state.comboCount >= 8) multiplier = 3;
          else if (state.comboCount >= 5) multiplier = 2;
          else if (state.comboCount >= 3) multiplier = 1.5;

          const earned = Math.round(item.points * multiplier);
          state.score += earned;

          const particleColor = item.type === 'goldenBoba' ? '#FFD700' : (item.color || '#BB8750');
          spawnParticles(item.x, item.y, particleColor, item.type === 'goldenBoba' ? 12 : 6, 'sparkle');
          spawnTextParticle(item.x, item.y - 20, `+${earned}`, particleColor);

          // Combo exclamation
          if (state.comboCount >= 3 && state.comboCount % 2 === 1) {
            const word = COMBO_WORDS[Math.floor(Math.random() * COMBO_WORDS.length)];
            spawnTextParticle(state.canvasWidth / 2, state.canvasHeight / 2 - 40, word, '#FFD700');
          }
        }
        state.items.splice(i, 1);
        continue;
      }

      // Remove if below screen
      if (item.y > state.canvasHeight + item.radius * 2) {
        state.items.splice(i, 1);
      }
    }

    // Update combo timer
    if (state.comboTimer > 0) {
      state.comboTimer -= delta;
      if (state.comboTimer <= 0) {
        state.comboCount = 0;
      }
    }

    // Update particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity on particles
      p.life -= delta;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Screen shake decay
    if (state.screenShake > 0) {
      state.screenShake *= 0.88;
      if (state.screenShake < 0.3) state.screenShake = 0;
    }

    // ── Render ──
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = state.canvasWidth;
    const h = state.canvasHeight;

    ctx.save();
    // Screen shake
    if (state.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * state.screenShake * 2,
        (Math.random() - 0.5) * state.screenShake * 2
      );
    }

    drawBackground(ctx, w, h);
    state.items.forEach(item => drawItem(ctx, item));
    drawCup(ctx, state.cup);
    state.particles.forEach(p => drawParticle(ctx, p));

    ctx.restore();

    // Sync to React state (only when changed)
    if (state.score !== prevScoreRef.current) {
      setScore(state.score);
      prevScoreRef.current = state.score;
    }
    const t = Math.ceil(state.timeLeft);
    if (t !== prevTimeRef.current) {
      setTimeLeft(t);
      prevTimeRef.current = t;
    }
    setCombo(state.comboCount);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [spawnItem, spawnParticles, spawnTextParticle, drawBackground, drawCup, drawItem, drawParticle]);

  // ─── End Game ──────────────────────────────────────────────
  const endGame = useCallback((finalScore) => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    gameStateRef.current = null;

    const stored = parseInt(localStorage.getItem('bobaCatcherHighScore') || '0', 10);
    if (finalScore > stored) {
      localStorage.setItem('bobaCatcherHighScore', String(finalScore));
      setHighScore(finalScore);
    }

    setScore(finalScore);
    setScreen('gameover');
  }, []);

  // Keep ref in sync so gameLoop can call it without a stale closure
  endGameRef.current = endGame;

  // ─── Start Game ────────────────────────────────────────────
  const startGame = useCallback(() => {
    setScreen('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setCombo(0);
    prevScoreRef.current = 0;
    prevTimeRef.current = GAME_DURATION;

    // Wait for canvas to mount before starting
    requestAnimationFrame(() => {
      setupCanvas();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      gameStateRef.current = createGameState(rect.width, rect.height);
      gameStateRef.current.lastTimestamp = performance.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    });
  }, [setupCanvas, createGameState, gameLoop]);

  // ─── Touch / Mouse Controls ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || screen !== 'playing') return;

    const getX = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      return (clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1);
    };

    const handleTouchStart = (e) => {
      e.preventDefault();
      if (gameStateRef.current) {
        gameStateRef.current.cup.targetX = getX(e.touches[0].clientX);
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (gameStateRef.current) {
        gameStateRef.current.cup.targetX = getX(e.touches[0].clientX);
      }
    };

    const handleMouseMove = (e) => {
      if (gameStateRef.current) {
        gameStateRef.current.cup.targetX = getX(e.clientX);
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [screen]);

  // ─── Resize Handler ────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return;
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [screen, setupCanvas]);

  // ─── Cleanup on Unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, []);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="boba-game-container">
      {screen === 'start' && <StartScreen onStart={startGame} highScore={highScore} />}
      {screen === 'playing' && (
        <>
          <GameHUD score={score} timeLeft={timeLeft} combo={combo} />
          <canvas ref={canvasRef} className="boba-canvas" />
        </>
      )}
      {screen === 'gameover' && <GameOverScreen score={score} highScore={highScore} onRestart={startGame} />}
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────
function lightenColor(hex, amount) {
  if (!hex) return '#ffffff';
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
  const b = Math.min(255, (num & 0x0000FF) + amount);
  return `rgb(${r},${g},${b})`;
}

export default BobaCatcher;
