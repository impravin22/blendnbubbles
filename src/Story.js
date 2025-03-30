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
                  <p>Alright, gather 'round and let us spin you a proper yarn about how Blend N Bubbles came to be.</p>
                  
                  <p>Picture this: three blokes from India, bright-eyed and bushy-tailed, land in Taiwan for their master's studies. Between hitting the books and grafting as AI developers, they stumble upon the local delight—bubble tea. One sip, and blimey, they're hooked! This stuff's the dog's bollocks, they reckon.</p>
                  
                  <div className="story-quote">
                    <blockquote>
                      "One sip, and blimey, they're hooked! This stuff's the dog's bollocks, they reckon."
                    </blockquote>
                  </div>
                  
                  <p>Now, these lads aren't the type to faff about. They clock that India's missing out on this top-notch bevvy. So, they hatch a plan to bring the authentic Taiwanese bubble tea experience back home.</p>
                  
                  {/* <div className="story-image my-5">
                    <img src="/images/story/bubble-tea-preparation.jpg" alt="Authentic Taiwanese bubble tea preparation" className="img-fluid rounded" />
                  </div> */}
                  
                  <p>Enter another mate from Kolkata, a proper diamond geezer. With his local savvy and their shared passion, they set the wheels in motion. They sort out importing the finest teas and bubbles straight from Taiwan—no dodgy imitations here.</p>
                  
                  <p>And just like that, Blend N Bubbles was born—a cracking spot where Indian tea lovers can get a taste of Taiwan's finest, right in their own backyard. So, pop in, have a natter, and enjoy a cuppa that's truly top-notch. Cheers!</p>
                  
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
          <p>© 2023 BlendNBubbles. All rights reserved.</p>
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