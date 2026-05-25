import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Wheel } from 'react-custom-roulette';

/**
 * Anniversary spin wheel.
 *
 * - Renders a real animated wheel via react-custom-roulette.
 * - One spin per browser via localStorage soft-lock; staff is the real
 *   enforcement at the counter.
 * - Returning visitors see their previously won prize.
 *
 * Reset for testing in DevTools console:
 *   localStorage.removeItem('bnb_anniversary_spin_v1'); location.reload();
 */

const STORAGE_KEY = 'bnb_anniversary_spin_v1';
const BRAND_TEAL = '#0F3C3C';
const BRAND_AMBER = '#C89B4A';

// Prize catalogue. `option` is the short label rendered on the wheel slice.
// `title` and `body` populate the result card and the collapsible list.
// Exported so the Offers page can render the same list under the wheel
// without duplicating copy.
export const PRIZES = [
  {
    option: '1 STAMP',
    title: '1 Free stamp on your loyalty card',
    body: 'Show this screen to the counter to redeem the stamp.',
  },
  {
    option: '2 STAMPS',
    title: '2 Free stamps on your loyalty card',
    body: 'Show this screen to the counter to redeem the stamps.',
  },
  {
    option: '3 STAMPS',
    title: '3 Free stamps on your loyalty card',
    body: 'Show this screen to the counter to redeem the stamps.',
  },
  {
    option: '50% OFF',
    title: '50% off your next visit',
    body: 'Plus 10% extra off when you share our story on socials.',
  },
  {
    option: '10% OFF',
    title: '10% off coupon',
    body: 'Show this screen on your next order to claim the discount.',
  },
  {
    option: 'FREE BOBA',
    title: 'Free boba for a month',
    body: 'One boba per week, on the house. Staff will set you up at the counter.',
  },
  {
    option: 'HALL OF FAME',
    title: 'BnB Hall of Fame',
    body: 'Exclusive offers and recognition. Winners contacted post-anniversary.',
  },
  {
    option: 'GOODIES',
    title: 'BnB Anniversary Goodies',
    body: 'Limited-edition goodies hand-picked by the team. Collect at the counter.',
  },
];

const WHEEL_DATA = PRIZES.map((prize, index) => ({
  option: prize.option,
  style: {
    backgroundColor: index % 2 === 0 ? BRAND_TEAL : BRAND_AMBER,
    textColor: '#FFFFFF',
  },
}));

function loadSavedPrize() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.prizeIndex !== 'number' ||
      parsed.prizeIndex < 0 ||
      parsed.prizeIndex >= PRIZES.length
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

function savePrize(prizeIndex) {
  if (typeof window === 'undefined') return;
  const payload = {
    prizeIndex,
    prizeLabel: PRIZES[prizeIndex].option,
    prizeTitle: PRIZES[prizeIndex].title,
    spunAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Storage full / disabled — staff can still verify in-store.
  }
}

function pickRandomPrizeIndex() {
  return Math.floor(Math.random() * PRIZES.length);
}

function SpinWheel() {
  // CRA does not server-render, so a lazy initialiser is enough to read
  // localStorage on first mount without flashing the spin button.
  const [savedPrize, setSavedPrize] = useState(() => loadSavedPrize());
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeIndex, setPrizeIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const modalCloseButtonRef = useRef(null);
  const modalTriggerRef = useRef(null);

  // Dev helper to clear the soft lock during local testing. Only attached
  // in development so production bundles stay clean.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined;
    if (typeof window === 'undefined') return undefined;
    window.__bnbResetSpin = () => {
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    };
    return () => {
      delete window.__bnbResetSpin;
    };
  }, []);

  const handleSpinClick = useCallback(() => {
    if (mustSpin || savedPrize) return;
    setPrizeIndex(pickRandomPrizeIndex());
    setMustSpin(true);
    setShowResult(false);
  }, [mustSpin, savedPrize]);

  const handleStopSpinning = useCallback(() => {
    setMustSpin(false);
    savePrize(prizeIndex);
    setSavedPrize({
      prizeIndex,
      prizeLabel: PRIZES[prizeIndex].option,
      prizeTitle: PRIZES[prizeIndex].title,
      spunAt: new Date().toISOString(),
    });
    setShowResult(true);
  }, [prizeIndex]);

  const handleCloseResult = useCallback(() => {
    setShowResult(false);
    // Return focus to the element that triggered the modal so keyboard
    // users do not get parked on the page body.
    if (modalTriggerRef.current) {
      modalTriggerRef.current.focus();
    }
  }, []);

  // Trap focus inside the modal and close it on Escape.
  useEffect(() => {
    if (!showResult) return undefined;
    if (typeof window === 'undefined') return undefined;

    // Move focus to the primary action so screen readers + keyboard users
    // land inside the dialog as soon as it opens.
    const focusTimer = window.setTimeout(() => {
      if (modalCloseButtonRef.current) {
        modalCloseButtonRef.current.focus();
      }
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseResult();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showResult, handleCloseResult]);

  const activePrize = useMemo(() => {
    if (savedPrize) return PRIZES[savedPrize.prizeIndex];
    return null;
  }, [savedPrize]);

  return (
    <div className="spin-wheel-shell">
      <div className="spin-wheel-stage">
        <Wheel
          mustStartSpinning={mustSpin}
          prizeNumber={prizeIndex}
          data={WHEEL_DATA}
          onStopSpinning={handleStopSpinning}
          backgroundColors={[BRAND_TEAL, BRAND_AMBER]}
          textColors={['#FFFFFF']}
          outerBorderColor={BRAND_TEAL}
          outerBorderWidth={6}
          innerBorderColor="#FFFFFF"
          innerBorderWidth={2}
          radiusLineColor="#FFFFFF"
          radiusLineWidth={2}
          fontFamily="Poppins, sans-serif"
          fontSize={14}
          fontWeight={700}
          textDistance={62}
          spinDuration={0.6}
          pointerProps={{
            style: {
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
            },
          }}
        />
      </div>

      {!savedPrize && (
        <div className="text-center mt-4">
          <button
            ref={modalTriggerRef}
            type="button"
            className="btn btn-primary btn-lg spin-cta"
            onClick={handleSpinClick}
            disabled={mustSpin}
            aria-label="Spin the anniversary wheel"
          >
            {mustSpin ? 'Spinning…' : 'Spin the Wheel'}
          </button>
          <p className="text-muted small mt-3 mb-0">
            One play per customer. Prize is verified by staff at the counter.
          </p>
        </div>
      )}

      {savedPrize && (
        <div className="spin-result-card mt-4 text-center" role="status" aria-live="polite">
          <p className="spin-result-eyebrow mb-2">YOUR PRIZE</p>
          <h3 className="spin-result-title mb-2">{activePrize.title}</h3>
          <p className="text-muted mb-3">{activePrize.body}</p>
          <p className="small mb-0">
            <strong>Show this screen to staff at the counter.</strong>
          </p>
        </div>
      )}

      {showResult && activePrize && (
        <div
          className="spin-result-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spin-result-headline"
          onClick={handleCloseResult}
        >
          <div className="spin-result-modal" onClick={(e) => e.stopPropagation()}>
            <p className="spin-result-eyebrow mb-2">CONGRATULATIONS</p>
            <h3 id="spin-result-headline" className="spin-result-title mb-2">
              {activePrize.title}
            </h3>
            <p className="text-muted mb-4">{activePrize.body}</p>
            <p className="small fw-bold mb-4">
              Show this screen to staff at the counter to claim your prize.
            </p>
            <button
              ref={modalCloseButtonRef}
              type="button"
              className="btn btn-primary"
              onClick={handleCloseResult}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpinWheel;
