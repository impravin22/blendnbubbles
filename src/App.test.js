import { render, screen } from '@testing-library/react';
import App from './App';
import { PARTNERS } from './partnerOrderData';

// Smoke test: mounting <App /> exercises the react-router-dom imports
// (BrowserRouter, Routes, Route, Link, useLocation) and the homepage render.
test('renders the homepage hero heading', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /premium bubble tea in kolkata/i })
  ).toBeInTheDocument();
});

// The headline behaviour of the season close: /play/football serves the Hall of
// Fame, not the shootout. Asserted through <App /> so a reverted route in the
// router fails here rather than on the live site.
describe('/play/football', () => {
  const visit = (path) => {
    window.history.pushState({}, '', path);
    return render(<App />);
  };

  afterEach(() => {
    window.history.pushState({}, '', '/');
    window.localStorage.clear();
  });

  test('serves the closed-season gate instead of the penalty shootout', () => {
    visit('/play/football');

    expect(
      screen.getByRole('heading', { name: /the shootout is closed/i })
    ).toBeInTheDocument();
    // The game's own start screen would offer these; the route must not.
    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start|play|shoot/i })).not.toBeInTheDocument();
  });

  test('reveals the Hall of Fame once the code has been accepted', () => {
    window.localStorage.setItem('bnbHallOfFameUnlocked', 'true');

    visit('/play/football');

    expect(screen.getByRole('tablist', { name: /ranking/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hall of fame/i })).toBeInTheDocument();
  });
});

describe('/events', () => {
  const visit = (path) => {
    window.history.pushState({}, '', path);
    return render(<App />);
  };

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  test('serves the event request page', () => {
    visit('/events');

    expect(
      screen.getByRole('heading', { name: /bubble tea for your big day/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send event request/i })).toBeInTheDocument();
  });
});

// Partner URLs are printed on physical coupon QRs. A dropped or renamed route
// cannot be recalled once the coupons are out, so every partner page and the
// legacy /nail QR are asserted through <App />: mounting <PartnerOrder />
// directly would still pass with the route deleted.
describe('partner order routes', () => {
  const visit = (path) => {
    window.history.pushState({}, '', path);
    return render(<App />);
  };

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  test.each(PARTNERS.map((partner) => [partner.slug, partner]))('/p/%s serves that partner\'s order page', (slug, partner) => {
    visit(`/p/${slug}`);

    expect(screen.getByText(`For ${partner.name} clients`)).toBeInTheDocument();
    expect(screen.getByText(`Code ${partner.code}`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pick your drinks/i })).toBeInTheDocument();
  });

  test('the first nail-studio QR, /nail, lands on the Oh Nails page', () => {
    visit('/nail');

    expect(screen.getByText('For Oh Nails clients')).toBeInTheDocument();
    expect(screen.getByText('Code BNB-OH-NAIL')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/p/oh-nails');
  });

  test('an unknown partner link points people to the menu instead of a blank page', () => {
    visit('/p/not-a-partner');

    expect(screen.getByRole('heading', { name: /this offer link isn't active/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /full menu/i })).toHaveAttribute('href', '/menu');
  });
});

test('renders router Links that resolve to the menu route', () => {
  render(<App />);
  // Verify react-router-dom's Link rendered a working anchor to /menu.
  // Assert by href rather than label so the test is not brittle to multiple
  // "... menu" CTAs sharing the same destination.
  const menuLinks = screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href') === '/menu');
  expect(menuLinks.length).toBeGreaterThan(0);
});
