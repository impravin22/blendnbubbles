import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Offers from './Offers';
import { PLATFORM_OFFERS, countOffers } from './offersData';

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

  it('renders every live platform offer from the data module', () => {
    renderOffers();
    PLATFORM_OFFERS.forEach((platform) => {
      expect(
        screen.getByRole('heading', { name: new RegExp(`^${platform.name}$`, 'i') })
      ).toBeInTheDocument();
      platform.offers.forEach((offer) => {
        expect(screen.getAllByText(offer.headline).length).toBeGreaterThan(0);
      });
    });
  });

  it('shows the live offer count in the hero so it never drifts from the list', () => {
    renderOffers();
    expect(screen.getByText(new RegExp(`${countOffers()} live deals`, 'i'))).toBeInTheDocument();
  });

  it('surfaces Swiggy coupon codes so customers can actually redeem them', () => {
    renderOffers();
    const codes = PLATFORM_OFFERS.flatMap((p) => p.offers)
      .map((o) => o.code)
      .filter(Boolean);
    expect(codes.length).toBeGreaterThan(0);
    codes.forEach((code) => expect(screen.getByText(code)).toBeInTheDocument());
  });

  it('opens each storefront in a new tab without leaking the referrer', () => {
    renderOffers();
    PLATFORM_OFFERS.forEach((platform) => {
      const cta = screen.getByRole('link', { name: new RegExp(`order on ${platform.name}`, 'i') });
      expect(cta).toHaveAttribute('href', platform.link);
      expect(cta).toHaveAttribute('target', '_blank');
      expect(cta).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
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
