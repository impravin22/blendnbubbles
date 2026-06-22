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
