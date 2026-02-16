import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Menu from './Menu';
import Story from './Story';
import BobaCatcher from './BobaCatcher';

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    } else {
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [pathname, hash]);

  return null;
}

// Scroll reveal hook - observes elements and adds 'visible' class when in viewport
function useScrollReveal() {
  useEffect(() => {
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    if (revealElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });
}

// Button ripple effect hook
function useRippleEffect() {
  useEffect(() => {
    function handleClick(e) {
      const btn = e.currentTarget;
      const circle = document.createElement('span');
      const diameter = Math.max(btn.clientWidth, btn.clientHeight);
      const radius = diameter / 2;
      const rect = btn.getBoundingClientRect();

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.classList.add('ripple');

      const existingRipple = btn.querySelector('.ripple');
      if (existingRipple) existingRipple.remove();

      btn.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    }

    const buttons = document.querySelectorAll('.btn');
    buttons.forEach((btn) => btn.addEventListener('click', handleClick));
    return () => buttons.forEach((btn) => btn.removeEventListener('click', handleClick));
  });
}

// Animated routes with matched transition timing
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <TransitionGroup>
      <CSSTransition
        key={location.pathname}
        timeout={400}
        classNames="page-transition"
        unmountOnExit
      >
        <div className="page-wrapper">
          <Routes location={location}>
            <Route path="/" element={<Homepage />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/story" element={<Story />} />
            <Route path="/play" element={<BobaCatcher />} />
          </Routes>
        </div>
      </CSSTransition>
    </TransitionGroup>
  );
}

function Homepage() {
  const [scrolled, setScrolled] = useState(false);
  const navbarCollapseRef = useRef(null);

  // Per-route SEO
  useEffect(() => {
    document.title = 'BlendNBubbles - Authentic Taiwanese Bubble Tea in Kolkata, India';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'BlendNBubbles serves authentic Taiwanese bubble tea in Barrackpore, Kolkata. Enjoy boba milk tea, fruit teas, smoothies, and cold coffee with real Taiwanese ingredients. Order on Zomato or visit us today.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://blendnbubbles.com');
  }, []);

  // Scroll-reveal & ripple
  useScrollReveal();
  useRippleEffect();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = useCallback((event, sectionId) => {
    event.preventDefault();
    const navbarCollapse = navbarCollapseRef.current;
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      const bsCollapse = window.bootstrap && window.bootstrap.Collapse.getInstance(navbarCollapse);
      if (bsCollapse) bsCollapse.hide();
    }
    const section = document.getElementById(sectionId);
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Bootstrap JS
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
    script.integrity = 'sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p';
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  return (
    <div className="App">
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
          <div className="collapse navbar-collapse" id="navbarNav" ref={navbarCollapseRef}>
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <Link className="nav-link active" to="/">Home</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/menu">Menu</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/story">Our Story</Link>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Visit Us</a>
              </li>
              <li className="nav-item ms-lg-2">
                <a className="nav-link btn-order" href="https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order" target="_blank" rel="noopener noreferrer">Order Now</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero" id="home">
        <div className="hero-content">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-6 hero-text-container">
                <h1 className="hero-title">Premium Bubble Tea Experience</h1>
                <p className="hero-subtitle">Where every bubble tells you a story</p>
                <p className="hero-text">Authentic Taiwanese bubble tea in the heart of Kolkata</p>
                <div className="hero-buttons">
                  <Link to="/menu" className="btn btn-primary">Explore Full Menu</Link>
                  <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="btn btn-outline">Find Us</a>
                </div>
              </div>
              <div className="col-lg-6">
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

      {/* About Section */}
      <section className="py-5" id="about">
        <div className="container">
          <h2 className="text-center mb-4 reveal">About BlendNBubbles</h2>
          <div className="row">
            <div className="col-md-6 mb-4 mb-md-0 reveal-left">
              <div className="rounded about-image">
                <img src="/authentic_bubble_tea_with_logo.png" alt="BlendNBubbles Authentic Bubble Tea" className="img-fluid rounded" />
              </div>
            </div>
            <div className="col-md-6 reveal-right">
              <p>
                BlendNBubbles is Kolkata's premier bubble tea destination, bringing the authentic taste of Taiwan to India.
                Our carefully selected ingredients are imported directly from Taiwan to ensure the highest quality and authentic flavor.
              </p>
              <p>
                Founded with a passion for bubble tea and a commitment to quality, we're proud to introduce Kolkata
                to the wonderful world of bubble tea. Each cup is carefully crafted to provide a unique experience where every bubble tells a story.
              </p>
              <div className="text-end mt-4">
                <Link to="/story" className="btn btn-outline-primary">Read Our Full Story</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Menu Section */}
      <section className="py-5 bg-light" id="products">
        <div className="container">
          <h2 className="text-center mb-4 reveal">Featured Menu Items</h2>
          <p className="text-center mb-5 reveal reveal-delay-1">Our most popular bubble tea selections - <Link to="/menu" className="view-full-menu">View Full Menu</Link></p>
          <div className="row">
            <div className="col-md-4 mb-4 reveal reveal-delay-1">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Taiwan Signature Milk Tea <span className="menu-tag">Signature</span></h5>
                  <p className="card-text">Authentic Taiwanese signature milk tea.</p>
                  <p className="card-text"><small className="text-muted">₹165</small></p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4 reveal reveal-delay-2">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Passion Fruit Green Tea <span className="menu-tag">Signature</span></h5>
                  <p className="card-text">Zesty passion fruit blended with green tea.</p>
                  <p className="card-text"><small className="text-muted">₹160</small></p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4 reveal reveal-delay-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Mango Smoothie <span className="menu-tag">Popular</span></h5>
                  <p className="card-text">Creamy mango smoothie.</p>
                  <p className="card-text"><small className="text-muted">₹160</small></p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-4 reveal reveal-delay-4">
            <Link to="/menu" className="btn btn-primary">View Our Full Menu</Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-5" id="contact">
        <div className="container">
          <h2 className="text-center mb-4 reveal">Visit Us</h2>
          <div className="row">
            <div className="col-md-6 mb-4 mb-md-0 reveal-left">
              <h4>Location</h4>
              <p>Senjuti Apt. Shop No -6, 68/16, Feeder Road, Barrackpore, Kolkata</p>
              <p>PIN: 700120</p>
              <h4>Hours</h4>
              <p>Monday - Sunday: 11am - 9pm</p>
              <h4>Contact</h4>
              <p>Phone: +91 9330697501</p>
              <p>Email: blendnbubbles@yahoo.com</p>
            </div>
            <div className="col-md-6 reveal-right">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Send us a message</h5>
                  <form>
                    <div className="mb-3">
                      <input type="text" className="form-control" placeholder="Your Name" />
                    </div>
                    <div className="mb-3">
                      <input type="email" className="form-control" placeholder="Your Email" />
                    </div>
                    <div className="mb-3">
                      <textarea className="form-control" rows="3" placeholder="Your Message"></textarea>
                    </div>
                    <button type="submit" className="btn btn-primary">Send Message</button>
                  </form>
                </div>
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

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AnimatedRoutes />
    </Router>
  );
}

export default App;
