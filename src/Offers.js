import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';

function Offers() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleVisitUsClick = (e) => {
    e.preventDefault();
    navigate('/#contact');
  };

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });

  // Per-route SEO
  useEffect(() => {
    document.title = 'Exclusive Offers - BlendNBubbles | Tap. Sip. Win.';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Exclusive BlendNBubbles offers, anniversary surprises and weekly perks. Tap your fridge magnet to unlock fresh announcements.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://blendnbubbles.com/offers');
  }, []);

  // Bootstrap JS for mobile navbar
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
    script.integrity = 'sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p';
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  return (
    <div className="Offers">
      {/* Navigation */}
      <nav className={`navbar navbar-expand-lg fixed-top ${scrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <Link className="navbar-brand" to="/">
            <img src="/logo.svg" alt="BlendNBubbles Logo" height="50" />
            <span className="ms-2">BlendNBubbles</span>
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/">Home</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/menu">Menu</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/story">Our Story</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link active" to="/offers">Offers</Link>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/#contact" onClick={handleVisitUsClick}>Visit Us</a>
              </li>
              <li className="nav-item ms-lg-2">
                <a className="nav-link btn-order" href="https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order" target="_blank" rel="noopener noreferrer">Order Now</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero" id="offers-hero">
        <div className="hero-content">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-7 hero-text-container">
                <p className="hero-subtitle">Tap. Sip. Win.</p>
                <h1 className="hero-title">Exclusive Offers</h1>
                <p className="hero-text">
                  Something special is brewing for our anniversary. Tap your fridge magnet again soon to unlock weekly offers, winner reveals and surprises made just for our community.
                </p>
                <div className="hero-buttons">
                  <Link to="/menu" className="btn btn-primary">Browse the Menu</Link>
                  <a href="/#contact" onClick={handleVisitUsClick} className="btn btn-outline">Visit Us</a>
                </div>
              </div>
              <div className="col-lg-5">
                <div className="hero-image">
                  <img src="/logo.svg" alt="BlendNBubbles Logo" className="floating logo-hero" />
                  <div className="hero-bubbles">
                    <span className="bubble"></span>
                    <span className="bubble"></span>
                    <span className="bubble"></span>
                    <span className="bubble"></span>
                    <span className="bubble"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stay tuned section */}
      <section className="py-5" id="stay-tuned">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8 text-center reveal">
              <h2 className="mb-4">Stay tuned</h2>
              <p className="lead">
                This page is your direct line to fresh BlendNBubbles offers. Winners, weekly deals and anniversary specials will land here first.
              </p>
              <p>
                Tap your magnet whenever you want a sip-worthy update. Cheers, mate.
              </p>
              <div className="text-center mt-4">
                <Link to="/" className="btn btn-primary">Back to Home</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark text-white py-4">
        <div className="container text-center">
          <p>© 2025-2026 BlendNBubbles. All rights reserved.</p>
          <p>Premium Bubble Tea in Kolkata, India</p>
          <div className="social-links mt-3">
            <a href="https://www.facebook.com/share/168pyB8Bbb/?mibextid=wwXIfr" className="text-white me-3" target="_blank" rel="noopener noreferrer">
              <i className="bi bi-facebook"></i> Facebook
            </a>
            <a href="https://www.instagram.com/blendnbubbles?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" className="text-white me-3" target="_blank" rel="noopener noreferrer">
              <i className="bi bi-instagram"></i> Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Offers;
