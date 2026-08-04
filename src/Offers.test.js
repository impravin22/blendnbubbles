import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Offers from './Offers';

const renderOffers = () =>
  render(
    <MemoryRouter initialEntries={['/offers']}>
      <Offers />
    </MemoryRouter>
  );

describe('Offers page after the spin-wheel retirement', () => {
  it('renders the offers hero, not the wheel', () => {
    renderOffers();
    expect(screen.getByRole('heading', { name: /offers & happenings/i })).toBeInTheDocument();
    expect(screen.queryByText(/spin the anniversary wheel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spin the wheel/i)).not.toBeInTheDocument();
  });

  it('points visitors at Instagram for current offers', () => {
    renderOffers();
    const insta = screen.getByRole('link', { name: /follow @blendnbubbles/i });
    expect(insta).toHaveAttribute('href', expect.stringContaining('instagram.com'));
    expect(insta).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('links through to the new events page', () => {
    renderOffers();
    expect(screen.getByRole('link', { name: /request an event/i })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: /^events$/i })).toHaveAttribute('href', '/events');
  });
});
