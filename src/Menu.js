import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MENU } from './menuData';
import './App.css';
import { useTheme } from './ThemeContext';
import Navbar from './Navbar';

// Filter options: "All" plus one per menu category, derived from the data.
const FILTERS = [{ id: 'all', label: 'All' }, ...MENU.map((c) => ({ id: c.id, label: c.title }))];

// Render a single price value, or a dash when that option is not offered.
function priceText(value) {
  return value != null ? `₹${value}` : '-';
}

// Drink photos live at /menu-photos/<slug>.webp, named by this slug rule
// (matches the conversion script that produced them from the Zomato shoot).
function photoSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function Menu() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [displayedCategory, setDisplayedCategory] = useState('all');
  const [transitioning, setTransitioning] = useState(false);
  const filterContainerRef = useRef(null);
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Animated category switching
  const filterMenu = useCallback((category) => {
    if (category === activeCategory) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveCategory(category);
      setDisplayedCategory(category);
      setTransitioning(false);
      if (window.innerWidth <= 768 && category !== 'all') {
        setTimeout(() => {
          const el = document.getElementById(category);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }, 250);
  }, [activeCategory]);

  // Helper: should this category be visible?
  const isCategoryVisible = useCallback((cat) => {
    const current = transitioning ? displayedCategory : activeCategory;
    return current === 'all' || current === cat;
  }, [activeCategory, displayedCategory, transitioning]);

  // Helper: get category classes
  const categoryClass = useCallback((cat) => {
    const visible = isCategoryVisible(cat);
    if (!visible) return 'menu-category category-hidden';
    if (transitioning) return 'menu-category category-fading-out';
    return 'menu-category';
  }, [isCategoryVisible, transitioning]);

  const scrollToFilter = (event, category) => {
    const filterContainer = filterContainerRef.current;
    if (filterContainer) {
      const button = event.currentTarget;
      const buttonLeft = button.offsetLeft;
      const containerWidth = filterContainer.offsetWidth;
      const buttonWidth = button.offsetWidth;
      const scrollPosition = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);
      filterContainer.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
    filterMenu(category);
  };

  // Per-route SEO: set page title and meta description
  useEffect(() => {
    document.title = 'Menu - BlendNBubbles | Bubble Tea, Fruit Tea, Smoothies & Coffee in Kolkata';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Explore the full BlendNBubbles menu: soda fizz, boba milk teas, fruit teas, smoothies, coffee, matcha, and chocolate. Hot and iced options from Rs 119. Customise sugar and ice levels. Order on Zomato in Kolkata.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://blendnbubbles.com/menu');
  }, []);

  // Add effect to ensure Bootstrap JS is loaded for mobile navbar
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
    <div className={`Menu ${theme === 'dark' ? 'dark-mode' : ''}`}>
      {/* Navigation */}
      <Navbar />

      <main>

      {/* Full Menu Section */}
      <section className="menu-section py-5" id="full-menu">
        <div className="container">
          <div className="section-header">
            <h2 className="text-center">Our Complete Bubble Tea Menu</h2>
            <p className="section-subtitle text-center">Explore our wide variety of authentic Taiwanese bubble teas and more</p>
          </div>

          <div className="menu-filters" ref={filterContainerRef}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`menu-filter ${activeCategory === f.id ? 'active' : ''}`}
                onClick={(e) => scrollToFilter(e, f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="menu-categories">
            {MENU.map((cat) => (
              <div className={categoryClass(cat.id)} id={cat.id} key={cat.id}>
                <div className="category-head">
                  <h3 className="category-title">{cat.title}</h3>
                  {cat.type === 'temp' && (
                    <div className="temp-legend" aria-hidden="true">
                      <span className="temp-chip temp-chip-hot">♨ Hot</span>
                      <span className="temp-chip temp-chip-cold">❄ Iced</span>
                    </div>
                  )}
                </div>
                <div className="menu-items">
                  {cat.items.map((item) => (
                    <div className="menu-item" key={item.name}>
                      {cat.type === 'temp' && (
                        <img
                          className="menu-photo"
                          src={`/menu-photos/${photoSlug(item.name)}.webp`}
                          alt={item.name}
                          width="600"
                          height="750"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div className="menu-item-content">
                        <h4>{item.name}</h4>
                        {item.desc && <p className="menu-desc">{item.desc}</p>}
                        <div className="menu-item-footer">
                          {cat.type === 'temp' ? (
                            <div className="price-pair">
                              <span className="price price-hot">
                                <span className="price-temp" aria-hidden="true">♨</span>
                                <span className="sr-only">Hot </span>
                                {priceText(item.hot)}
                              </span>
                              <span className="price price-cold">
                                <span className="price-temp" aria-hidden="true">❄</span>
                                <span className="sr-only">Iced </span>
                                {priceText(item.cold)}
                              </span>
                            </div>
                          ) : (
                            <div className="price">₹{item.price}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Customization Options */}
            <div className="customization-options">
              <h3>Customize Your Drink</h3>

              <div className="option-group">
                <h4>Sugar Level</h4>
                <div className="options-list">
                  <span className="option-item">0% (Sugar-Free)</span>
                  <span className="option-item">25% (Light Sugar)</span>
                  <span className="option-item recommended">50% (Half Sugar)</span>
                  <span className="option-item">75% (Less Sugar)</span>
                  <span className="option-item">100% (Full Sugar)</span>
                </div>
              </div>

              <div className="option-group">
                <h4>Ice Level</h4>
                <div className="options-list">
                  <span className="option-item">0% (No Ice)</span>
                  <span className="option-item">30% (Light Ice)</span>
                  <span className="option-item recommended">70% (Regular Ice)</span>
                  <span className="option-item">100% (Extra Ice)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      </main>

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

export default Menu;
