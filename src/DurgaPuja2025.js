import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './App.css';

function DurgaPuja2025() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
    script.integrity = 'sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p';
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="App">
      <nav className="navbar navbar-expand-lg fixed-top">
        <div className="container">
          <Link className="navbar-brand" to="/">
            <img src="/logo.svg" alt="BlendNBubbles Logo" height="50" />
            <span className="ms-2">BlendNBubbles</span>
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
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
            </ul>
          </div>
        </div>
      </nav>

      <section className="py-5 promo-top-pad">
        <div className="container">
          <div className="text-center mb-4" style={{
            background: 'var(--teal-gradient)',
            borderRadius: '16px',
            padding: '30px 20px'
          }}>
            <h2 className="mb-0" style={{ color: 'white' }}>Durga Puja 2025 Special</h2>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <img src="/pujo-menu.png" alt="Pujo Special Menu" className="img-fluid rounded shadow" />
            </div>
          </div>
          <div className="text-center mt-4">
            <a className="btn btn-primary" href="/">Back to Home</a>
          </div>
        </div>
      </section>

      <footer className="bg-dark text-white py-4">
        <div className="container text-center">
          <p>© 2025 BlendNBubbles. All rights reserved.</p>
          <p>Premium Bubble Tea in Kolkata, India</p>
        </div>
      </footer>
    </div>
  );
}

export default DurgaPuja2025;


