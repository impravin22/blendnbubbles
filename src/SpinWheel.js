import React from 'react';
import { Wheel } from 'react-custom-roulette';

/**
 * Anniversary spin wheel — display-only.
 *
 * The wheel is rendered as a static visual so customers see what is on
 * offer; the actual spin happens in-store with staff. This avoids the
 * "spin once per browser" enforcement problem and keeps the page simple.
 */

const BRAND_TEAL = '#0F3C3C';
const BRAND_AMBER = '#C89B4A';

// Prize catalogue. `option` is the short label rendered on the wheel slice.
// `title` and `body` populate the prize list on the Offers page.
// Exported so the Offers page can render the same list under the wheel
// without duplicating copy.
export const PRIZES = [
  {
    option: '1 STAMP',
    title: '1 Free stamp on your loyalty card',
    body: 'Show this at the counter to redeem the stamp.',
  },
  {
    option: '2 STAMPS',
    title: '2 Free stamps on your loyalty card',
    body: 'Show this at the counter to redeem the stamps.',
  },
  {
    option: '3 STAMPS',
    title: '3 Free stamps on your loyalty card',
    body: 'Show this at the counter to redeem the stamps.',
  },
  {
    option: '50% OFF',
    title: '50% off your next visit',
    body: 'Plus 10% extra off when you share our story on socials.',
  },
  {
    option: '10% OFF',
    title: '10% off coupon',
    body: 'Show this at the counter on your next order to claim the discount.',
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

function SpinWheel() {
  return (
    <div className="spin-wheel-shell" aria-label="Anniversary prize wheel — spin in-store with staff">
      <div className="spin-wheel-stage" aria-hidden="true">
        <Wheel
          mustStartSpinning={false}
          prizeNumber={0}
          data={WHEEL_DATA}
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
          onStopSpinning={() => undefined}
        />
      </div>

      <div className="spin-wheel-caption text-center mt-4">
        <p className="spin-wheel-caption-eyebrow mb-2">SPIN IN-STORE</p>
        <p className="text-muted mb-0">
          Pop into BlendNBubbles during the anniversary to take your spin at the counter.
        </p>
      </div>
    </div>
  );
}

export default SpinWheel;
