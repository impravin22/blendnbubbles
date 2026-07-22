import { render, screen } from '@testing-library/react';
import App from './App';

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
