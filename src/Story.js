import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';

function Story() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Handle navigation to home page with contact section
  const handleVisitUsClick = (e) => {
    e.preventDefault();
    navigate('/#contact');
  };

  // Add Bootstrap JS for mobile navbar
  useEffect(() => {
    // Add Bootstrap JS for mobile navbar toggle
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
    <div className="Story">
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
                <Link className="nav-link active" to="/story">Our Story</Link>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/#contact" onClick={handleVisitUsClick}>Visit Us</a>
              </li>
              <li className="nav-item ms-lg-2">
                <a className="nav-link btn-order" href="#order">Order Now</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Story Content */}
      <section className="story-section" id="story-content">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="section-header text-center">
                <h1 className="section-title">Our Story</h1>
                <p className="section-subtitle">How Blend N Bubbles Came To Be</p>
              </div>
              
              <div className="story-content">
                {/* <div className="story-image mb-5">
                  <img src="/images/story/founders-taiwan.jpg" alt="BlendNBubbles founders in Taiwan" className="img-fluid rounded" />
                </div> */}
                
                <div className="story-text">
                  <h2 className="mb-4">The Journey of Three Dreams and One Cup</h2>
                  
                  <p>Far from the familiar sounds of home—no morning calls of <em>chai wallahs</em>, no evening conversations over steaming cups—three young men from India found themselves in Taiwan, thousands of miles away from everything they knew and loved.</p>
                  
                  <p>Like countless Indian students before them, they had left behind family gatherings, mother's cooking, and the comfort of home for the promise of education and a better future. Days blended into nights as they juggled their master's studies with work as AI developers, sending money home and building dreams one day at a time.</p>
                  
                  <p>Then came that first sip of bubble tea.</p>
                  
                  <p>In that moment, something magical happened. It wasn't just the sweet, creamy texture or the playful pearls—it was the warmth of finding something that felt like <em>home</em> in a foreign land. Just as a perfectly brewed cup of chai can transport you back to your mother's kitchen, this bubble tea became their bridge between two worlds.</p>
                  
                  <div className="story-quote">
                    <blockquote>
                      "<em>Yaar</em>, India needs to taste this," they whispered to each other, their eyes lighting up with the kind of excitement that only comes when you discover something truly special.
                    </blockquote>
                  </div>
                  
                  <p>They imagined their friends back home, their families, their entire country experiencing this same joy.</p>
                  
                  <p>But this wasn't just about business—it was about <em>seva</em>, about sharing something beautiful with the people they loved most. They reached out to a friend in Kolkata, someone who understood the pulse of Indian hearts and the dreams that bind us all together.</p>
                  
                  <p>Together, they made a promise: to bring not just any bubble tea, but the <em>real</em> Taiwan experience home. Every ingredient sourced with love, every recipe perfected with passion, every cup served with the same warmth that welcomed them as strangers in a strange land.</p>
                  
                  <p>Today, when you step into Blend N Bubbles, you're not just buying a drink. You're becoming part of a story that began with homesickness and ended with homecoming. You're tasting the dreams of three young Indians who refused to let distance dim their love for their motherland.</p>
                  
                  <p>Because sometimes, the most beautiful journeys begin with missing home and end with bringing the world back to share with everyone you love.</p>
                  
                  <p className="text-center"><em>Come, be part of our story. Let every sip remind you that no dream is too far, no distance too great, when it's flavored with love for home.</em></p>
                  
                  <div className="story-cta text-center mt-5">
                    <Link to="/menu" className="btn btn-primary">Explore Our Menu</Link>
                    <a href="/#contact" onClick={handleVisitUsClick} className="btn btn-outline-secondary ms-3">Visit Us</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark text-white py-4">
        <div className="container text-center">
          <p>© 2025 BlendNBubbles. All rights reserved.</p>
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

export default Story;