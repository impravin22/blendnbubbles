import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { ZOMATO_URL } from './config';

function Navbar({ scrolled, navbarCollapseRef, scrollToSection }) {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  const handleVisitUsClick = (e) => {
    if (isHomePage) {
      scrollToSection(e, 'contact');
    }
  };

  return (
    <nav className={`navbar navbar-expand-lg fixed-top ${scrolled ? 'scrolled' : ''}`}>
      <div className="container">
        <Link className="navbar-brand" to="/">
          <img src="/logo.svg" alt="BlendNBubbles Logo" height="50" />
          <span className="ms-2">BlendNBubbles</span>
        </Link>
        <div className="d-flex align-items-center order-lg-last">
          <button 
            className="btn btn-link nav-link theme-toggle ms-2 me-2" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-moon-fill" viewBox="0 0 16 16">
                <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-sun-fill" viewBox="0 0 16 16">
                <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>
              </svg>
            )}
          </button>
          <button className="navbar-toggler ms-1" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>
        <div className="collapse navbar-collapse" id="navbarNav" ref={navbarCollapseRef}>
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} to="/">Home</Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === '/menu' ? 'active' : ''}`} to="/menu">Menu</Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === '/story' ? 'active' : ''}`} to="/story">Our Story</Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === '/offers' ? 'active' : ''}`} to="/offers">Offers</Link>
            </li>
            <li className="nav-item">
              <a className="nav-link" href={isHomePage ? "#contact" : "/#contact"} onClick={handleVisitUsClick}>Visit Us</a>
            </li>
            <li className="nav-item ms-lg-2">
              <a className="nav-link btn-order" href={ZOMATO_URL} target="_blank" rel="noopener noreferrer">Order Now</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
