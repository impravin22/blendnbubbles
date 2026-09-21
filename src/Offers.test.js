import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Offers from './Offers';
import {
  PLATFORM_OFFERS, IN_STORE_OFFER, BOGO_FRUIT_TEAS, PASSIONFRUIT_DRINKS,
  SWIGGY_BANK_OFFERS, countOffers,
} from './offersData';

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

describe('Offers page, line-up as of 16 September 2026', () => {
  it('names the qualifying drinks on each card: passionfruit on Zomato, Fruit Teas on Swiggy', () => {
    renderOffers();
    // The two platforms now run different offers, so each card lists its own
    // drinks: Zomato's Buy 1 Get 1 was stopped on 16 September.
    const lists = document.querySelectorAll('.platform-offer-items');
    expect(lists).toHaveLength(2);
    const [zomatoList, swiggyList] = lists;
    PASSIONFRUIT_DRINKS.forEach((drink) => expect(zomatoList.textContent).toContain(drink));
    BOGO_FRUIT_TEAS.forEach((tea) => expect(swiggyList.textContent).toContain(tea));
  });

  it('shows the counter-only offer apart from the app cards', () => {
    renderOffers();
    expect(screen.getByText(/at the counter$/i)).toBeInTheDocument();
    expect(screen.getByText(IN_STORE_OFFER.who)).toBeInTheDocument();
    expect(screen.getByText(IN_STORE_OFFER.condition)).toBeInTheDocument();
  });

  it('badges the one offer that launched on 16 September, and only that', () => {
    renderOffers();
    const badged = PLATFORM_OFFERS.flatMap((p) => p.offers).filter((o) => o.isNew);
    expect(badged).toHaveLength(1);
    // The page also carries an unrelated "New" card tag in the bottom grid,
    // so assert the count of offer badges rather than of every "New" on the page.
    expect(document.querySelectorAll('.platform-offer-new')).toHaveLength(badged.length);
  });

  it('no longer advertises the retired Buy 2 Get 1', () => {
    renderOffers();
    expect(screen.queryByText(/buy 2 get 1/i)).not.toBeInTheDocument();
  });
});

describe('Offers page, bank-funded offers', () => {
  it('lists each card offer the bank pays for', () => {
    renderOffers();
    SWIGGY_BANK_OFFERS.forEach((bank) => {
      expect(screen.getByText(bank.label)).toBeInTheDocument();
      expect(screen.getByText(bank.detail)).toBeInTheDocument();
    });
  });

  it('renders them only on the card that has them', () => {
    renderOffers();
    expect(document.querySelectorAll('.bank-offer'))
      .toHaveLength(SWIGGY_BANK_OFFERS.length);
  });

  it('marks them as the bank\'s, so nobody reads them as our discount', () => {
    renderOffers();
    expect(screen.getByText(/funded by the card issuer, not by us/i)).toBeInTheDocument();
  });
});
