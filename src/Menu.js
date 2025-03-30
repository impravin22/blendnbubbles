import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';

function Menu() {
  const [activeCategory, setActiveCategory] = useState('all');
  const filterContainerRef = useRef(null);
  const navigate = useNavigate();
  
  const filterMenu = (category) => {
    setActiveCategory(category);
    
    // If on mobile, scroll to the selected category
    if (window.innerWidth <= 768) {
      const categoryElement = document.getElementById(category);
      if (categoryElement) {
        // Add a small delay to allow state update
        setTimeout(() => {
          categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  };
  
  // Add click listener to scroll the filters when a button is tapped
  const scrollToFilter = (event, category) => {
    const filterContainer = filterContainerRef.current;
    if (filterContainer) {
      // Get the button that was clicked
      const button = event.currentTarget;
      // Get the position of the button relative to the container
      const buttonLeft = button.offsetLeft;
      // Calculate the center position
      const containerWidth = filterContainer.offsetWidth;
      const buttonWidth = button.offsetWidth;
      const scrollPosition = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);
      
      // Scroll to the button position (centered)
      filterContainer.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
    
    // Call the original filter function
    filterMenu(category);
  };
  
  // Handle navigation to home page with contact section
  const handleVisitUsClick = (e) => {
    e.preventDefault();
    navigate('/#contact');
  };
  
  // Add effect to ensure Bootstrap JS is loaded for mobile navbar
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
    <div className="Menu">
      {/* Navigation */}
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
                <Link className="nav-link active" to="/menu">Menu</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/story">Our Story</Link>
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

      {/* Full Menu Section */}
      <section className="menu-section py-5" id="full-menu">
        <div className="container">
          <div className="section-header">
            <h2 className="text-center">Our Complete Bubble Tea Menu</h2>
            <p className="section-subtitle text-center">Explore our wide variety of authentic Taiwanese bubble teas and more</p>
          </div>
          
          <div className="menu-filters" ref={filterContainerRef}>
            <button 
              className={`menu-filter ${activeCategory === 'all' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'all')}
            >
              All
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'black-tea' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'black-tea')}
            >
              Black Tea
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'green-tea' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'green-tea')}
            >
              Green Tea
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'milk-tea' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'milk-tea')}
            >
              Milk Tea
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'fruit-tea' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'fruit-tea')}
            >
              Fruit Tea
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'juice' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'juice')}
            >
              Juice
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'smoothie' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'smoothie')}
            >
              Smoothies
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'coffee' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'coffee')}
            >
              Coffee
            </button>
            <button 
              className={`menu-filter ${activeCategory === 'fizzy' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'fizzy')}
            >
              Fizzy
            </button>
          </div>
          
          <div className="menu-categories">
            {/* Black Tea Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'black-tea' ? '' : 'd-none'}`} id="black-tea">
              <h3 className="category-title">Black Tea</h3>
              <div className="menu-items">
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/black-tea-classic.jpg" alt="Classic Black Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Classic Black Tea <span className="menu-tag">Popular</span></h4>
                    <p>Traditional black tea, served hot or cold.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹120</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/black-tea-assam.jpg" alt="Assam Black Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Assam Black Tea</h4>
                    <p>Robust and malty Assam tea, served hot or cold.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹130</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Green Tea Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'green-tea' ? '' : 'd-none'}`} id="green-tea">
              <h3 className="category-title">Green Tea</h3>
              <div className="menu-items">
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/green-tea-jasmine.jpg" alt="Jasmine Green Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Jasmine Green Tea</h4>
                    <p>Fragrant jasmine-infused green tea, served hot or cold.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹140</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/green-tea-dew.jpg" alt="With Dew Green Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>With Dew Green Tea</h4>
                    <p>Refreshing green tea with a hint of dew-like sweetness.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹150</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Milk Tea Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'milk-tea' ? '' : 'd-none'}`} id="milk-tea">
              <h3 className="category-title">Milk Tea</h3>
              <div className="menu-items">
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/milk-tea-darjeeling.jpg" alt="Darjeeling Milk Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Darjeeling Milk Tea <span className="menu-tag">Best Seller</span></h4>
                    <p>Delicate Darjeeling tea blended with milk.</p>
                    <p className="menu-options">Toppings: Coconut Jelly / Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹180</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/milk-tea-assam.jpg" alt="Assam Milk Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Assam Milk Tea</h4>
                    <p>Strong Assam tea combined with creamy milk.</p>
                    <p className="menu-options">Toppings: Coconut Jelly / Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹170</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/milk-tea-taiwan.jpg" alt="Taiwan Original Boba Milk Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Taiwan Original Boba Milk Tea <span className="menu-tag">Authentic</span></h4>
                    <p>Authentic Taiwanese milk tea made with creamer and classic boba pearls.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/milk-tea-latte.jpg" alt="Black Tea Latte" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Black Tea Latte</h4>
                    <p>A harmonious mix of coffee and black tea with creamer.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  {/* <div className="menu-item-image">
                    <img src="/images/menu/milk-tea-ginger.jpg" alt="Ginger Coconut Milk Tea" />
                  </div> */}
                  <div className="menu-item-content">
                    <h4>Ginger Coconut Milk Tea <span className="menu-tag">Winter Special</span></h4>
                    <p>Warming ginger-infused milk tea with a hint of coconut, perfect for winter.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹210</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Fruit Tea Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'fruit-tea' ? '' : 'd-none'}`} id="fruit-tea">
              <h3 className="category-title">Fruit Tea</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Passion Fruit Green Tea <span className="menu-tag">Signature</span></h4>
                    <p>Zesty passion fruit blended with green tea.</p>
                    <p className="menu-options">Toppings: Boba and Coconut Jelly with Passion Fruit Jam</p>
                    <div className="menu-item-footer">
                      <div className="price">₹220</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Honey Lemon Black/Green Tea</h4>
                    <p>Choice of black or green tea infused with honey and lemon.</p>
                    <p className="menu-options">Toppings: Honey Aloe Vera Jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹180</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Lemon Iced Tea</h4>
                    <p>Refreshing iced tea with a splash of lemon.</p>
                    <p className="menu-options">Toppings: Honey Aloe Vera Jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹160</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Hawaii Iced Tea <span className="menu-tag">Tropical</span></h4>
                    <p>Tropical blend of flavors reminiscent of Hawaiian fruits.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Lychee Rose Green Tea</h4>
                    <p>Elegant combination of lychee and rose with green tea.</p>
                    <p className="menu-options">Optional Add-on: Lychee Jelly (+₹8)</p>
                    <div className="menu-item-footer">
                      <div className="price">₹210</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Blueberry Green Tea</h4>
                    <p>Tangy blueberry infused green tea.</p>
                    <p className="menu-options">Toppings: Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Mango Green Tea <span className="menu-tag">Seasonal</span></h4>
                    <p>Sweet mango blended with green tea.</p>
                    <p className="menu-options">Optional Add-on: Mango Jelly (+₹10)</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Peach Green Tea</h4>
                    <p>Juicy peach flavor combined with green tea.</p>
                    <p className="menu-options">Toppings: Green Apple Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹195</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Red Guava Yogurt Green Tea <span className="menu-tag">New</span></h4>
                    <p>Exotic red guava mixed with yogurt and green tea.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹230</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Kiwi Green Tea</h4>
                    <p>Tangy kiwi infused green tea.</p>
                    <p className="menu-note">*Kiwi to be procured from the market.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹210</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Sugar Cane Green Tea</h4>
                    <p>Natural sweetness of sugar cane blended with green tea.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹180</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Sugar Cane Lemon Green Tea</h4>
                    <p>Refreshing mix of sugar cane, lemon, and green tea.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Grapefruit Green Tea</h4>
                    <p>Citrusy grapefruit flavor combined with green tea.</p>
                    <p className="menu-options">Toppings: Available upon request</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Pomegranate Green Tea</h4>
                    <p>Rich pomegranate infused green tea.</p>
                    <p className="menu-note">*Syrup currently unavailable; expected in next lot.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹210</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Juice Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'juice' ? '' : 'd-none'}`} id="juice">
              <h3 className="category-title">Juice & Refreshing Beverages</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Honey Lemon</h4>
                    <p>Soothing honey and lemon drink.</p>
                    <p className="menu-options">Toppings: Honey Aloe Vera Jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹170</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Ginger Tea (Mild)</h4>
                    <p>Gentle ginger-infused tea for a subtle warmth.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹160</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Grapefruit Juice</h4>
                    <p>Fresh grapefruit juice with pulp.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Smoothies Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'smoothie' ? '' : 'd-none'}`} id="smoothie">
              <h3 className="category-title">Smoothies</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Mango Smoothie <span className="menu-tag">Popular</span></h4>
                    <p>Creamy mango smoothie made with mango syrup and snow bubble powder.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹230</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Strawberry Smoothie</h4>
                    <p>Refreshing strawberry smoothie with optional yogurt.</p>
                    <p className="menu-options">Ingredients: Strawberry grain, snow bubble powder</p>
                    <div className="menu-item-footer">
                      <div className="price">₹240</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Grape Smoothie</h4>
                    <p>Sweet and tangy grape-flavored smoothie.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹220</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Cocoa Smoothie</h4>
                    <p>Rich cocoa smoothie with sea salted caramel.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹250</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Coffee Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'coffee' ? '' : 'd-none'}`} id="coffee">
              <h3 className="category-title">Coffee</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Biscoff Boba Coffee <span className="menu-tag">New</span></h4>
                    <p>Smooth coffee infused with Biscoff flavor, sea salted caramel, and boba.</p>
                    <p className="menu-options">Toppings: Coffee Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹260</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Caramel Macchiato</h4>
                    <p>Espresso with steamed milk and caramel drizzle.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹240</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Caffe Mocha</h4>
                    <p>Blend of espresso, steamed milk, and chocolate.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹230</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Cold Coffee</h4>
                    <p>Chilled coffee served over ice.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹220</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Fizzy Drinks Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'fizzy' ? '' : 'd-none'}`} id="fizzy">
              <h3 className="category-title">Fizzy Drinks</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Minty Syrup Soda <span className="menu-tag">Refreshing</span></h4>
                    <p>Refreshing mint-flavored soda.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹180</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Green Apple Soda</h4>
                    <p>Crisp green apple flavored soda.</p>
                    <p className="menu-options">Toppings: Green Apple Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
              
              <div className="option-group">
                <h4>Add-ons</h4>
                <div className="options-list">
                  <span className="option-item">Tapioca Pearls (+₹20)</span>
                  <span className="option-item">Coconut Jelly (+₹15)</span>
                  <span className="option-item">Popping Boba (+₹25)</span>
                  <span className="option-item">Aloe Vera Jelly (+₹20)</span>
                  <span className="option-item">Lychee Jelly (+₹20)</span>
                  <span className="option-item">Coffee Jelly (+₹20)</span>
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

export default Menu;