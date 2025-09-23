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
                <a className="nav-link btn-order" href="https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order" target="_blank" rel="noopener noreferrer">Order Now</a>
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
              className={`menu-filter ${activeCategory === 'iced-tea' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'iced-tea')}
            >
              Iced Tea
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
              className={`menu-filter ${activeCategory === 'add-ons' ? 'active' : ''}`} 
              onClick={(e) => scrollToFilter(e, 'add-ons')}
            >
              Add-Ons
            </button>
          </div>
          
          <div className="menu-categories">
            {/* Iced Tea Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'iced-tea' ? '' : 'd-none'}`} id="iced-tea">
              <h3 className="category-title">Iced Tea</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Jasmine Iced Tea</h4>
                    <p>Refreshing jasmine-infused iced tea.</p>
                    <p className="menu-options">Suggested Toppings: Tapioca</p>
                    <div className="menu-item-footer">
                      <div className="price">₹85</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Taiwan Black Iced Tea</h4>
                    <p>Authentic Taiwanese black iced tea.</p>
                    <p className="menu-options">Suggested Toppings: Chia Seeds, Orange Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹125</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Lemon Iced Tea</h4>
                    <p>Classic refreshing lemon iced tea.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹95</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Honey Lemon Tea</h4>
                    <p>Sweet and tangy honey lemon iced tea.</p>
                    <p className="menu-options">Suggested Toppings: Lemon slice (round) + Aloe vera Jelly (1/2) + Chia seed (1/2)</p>
                    <div className="menu-item-footer">
                      <div className="price">₹160</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Ginger Iced Tea</h4>
                    <p>Warming ginger-infused iced tea.</p>
                    <p className="menu-options">Suggested Toppings: Ginger Slice, Passion fruit popping boba / Orange popping boba</p>
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
                  <div className="menu-item-content">
                    <h4>Assam Boba Tea</h4>
                    <p>Rich Assam tea blended with creamy milk.</p>
                    <p className="menu-options">Suggested Toppings: 1/2 Tapioca + 1/2 Coconut jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Taiwan Classic Boba <span className="menu-tag">Signature</span></h4>
                    <p>Authentic Taiwanese signature milk tea.</p>
                    <p className="menu-options">Suggested Toppings: Tapioca</p>
                    <div className="menu-item-footer">
                      <div className="price">₹215</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Black Tea Latte</h4>
                    <p>Smooth black tea with creamy milk in latte style.</p>
                    <p className="menu-options">Suggested Toppings: Coconut Jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹135</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Fruit Tea Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'fruit-tea' ? '' : 'd-none'}`} id="fruit-tea">
              <h3 className="category-title">Fruit Iced Tea</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Sweet Peach Bubble Tea</h4>
                    <p>Refreshing iced tea with sweet peach flavor.</p>
                    <p className="menu-options">Suggested Toppings: Peach flavor coconut jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹180</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Raw Mango Mist Pop</h4>
                    <p>Tangy green mango infused iced tea.</p>
                    <p className="menu-options">Suggested Toppings: Kachha Mango slices, Green Apple popping boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹175</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Jasmine Mango Bubble Tea</h4>
                    <p>Sweet mango flavor combined with jasmine iced tea.</p>
                    <p className="menu-options">Suggested Toppings: Mango flavor coconut jelly / Amsotto cubes / Mango popping boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Passion Fruit Blast <span className="menu-tag">Signature</span></h4>
                    <p>Zesty passion fruit blended with green tea.</p>
                    <p className="menu-options">Suggested Toppings: Tapioca + Coconut jelly + Passion fruit popping boba (5~6 pieces)</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Hawaiian Sunset Bubble <span className="menu-tag">Tropical</span></h4>
                    <p>Tropical blend of flavors reminiscent of Hawaiian fruits.</p>
                    <p className="menu-options">Suggested Toppings: Pineapple popping Boba, Orange Popping Boba, Tapioca + Coconut jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹190</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Lychee Rose Green Tea</h4>
                    <p>Elegant combination of lychee and rose with green tea.</p>
                    <p className="menu-options">Suggested Toppings: Cherry Popping boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹145</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Blueberry Green Tea</h4>
                    <p>Tangy blueberry infused green tea.</p>
                    <p className="menu-options">Suggested Toppings: Blueberry popping boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹155</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Red Guava Yogurt Tea</h4>
                    <p>Exotic red guava mixed with yogurt and green tea.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Sugarcane Mint Green Tea</h4>
                    <p>Refreshing combination of sugarcane and mint with green tea.</p>
                    <p className="menu-options">Suggested Toppings: Honey Aloe vera Jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹135</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Sugarcane Lemon Green Tea</h4>
                    <p>Sweet sugarcane with tangy lemon and green tea.</p>
                    <p className="menu-options">Suggested Toppings: Lemon Slice, Honey Aloe vera jelly</p>
                    <div className="menu-item-footer">
                      <div className="price">₹145</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Red Grapefruit Tea Pop</h4>
                    <p>Citrusy grapefruit flavor combined with green tea.</p>
                    <p className="menu-options">Suggested Toppings: Grapefruit (pulp/slice), Orange Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
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
                    <p>Creamy mango smoothie.</p>
                    <p className="menu-options">Suggested Toppings: Mango slice / Amsotto cubes</p>
                    <div className="menu-item-footer">
                      <div className="price">₹160</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Cheesey Mango Melt</h4>
                    <p>Creamy mango smoothie with cheese flavor.</p>
                    <p className="menu-options">Suggested Toppings: Mango slice</p>
                    <div className="menu-item-footer">
                      <div className="price">₹230</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Strawberry Smoothie</h4>
                    <p>Sweet and creamy strawberry smoothie.</p>
                    <p className="menu-options">Suggested Toppings: Cherry popping boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹165</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Strawberry Yogurt</h4>
                    <p>Refreshing strawberry smoothie with yogurt.</p>
                    <p className="menu-options">Suggested Toppings: Orange Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹215</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Blueberry Blend</h4>
                    <p>Tangy and sweet blueberry smoothie.</p>
                    <p className="menu-options">Suggested Toppings: Blueberry popping boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹220</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Choco Ice Swirl</h4>
                    <p>Rich chocolate flavored smoothie.</p>
                    <p className="menu-options">Suggested Toppings: KitKat/Perk, Chocolate Popping Boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹180</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Black Currant Cheese</h4>
                    <p>Tangy blackcurrant flavored smoothie.</p>
                    <p className="menu-options">Suggested Toppings: Blueberry popping boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹210</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Coffee Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'coffee' ? '' : 'd-none'}`} id="coffee">
              <h3 className="category-title">Cold Coffee</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Cafe Mocha</h4>
                    <p>Blend of espresso, steamed milk, and chocolate.</p>
                    <p className="menu-options">Suggested Toppings: Chocolate boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹200</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Caramel Boba Coffee</h4>
                    <p>Smooth coffee with caramel flavor and boba.</p>
                    <p className="menu-options">Suggested Toppings: Coffee boba</p>
                    <div className="menu-item-footer">
                      <div className="price">₹215</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Add-Ons Category */}
            <div className={`menu-category ${activeCategory === 'all' || activeCategory === 'add-ons' ? '' : 'd-none'}`} id="add-ons">
              <h3 className="category-title">Add-Ons & Toppings</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Tapioca (Boba)</h4>
                    <p>Chewy tapioca pearls.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹50</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Coconut Jelly</h4>
                    <p>Soft coconut flavored jelly.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹50</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Chocolate Popping Boba</h4>
                    <p>Bursting boba with chocolate flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Coffee Popping Boba</h4>
                    <p>Bursting boba with coffee flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Orange Popping Boba</h4>
                    <p>Bursting boba with orange flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Blueberry Popping Boba</h4>
                    <p>Bursting boba with blueberry flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Cherry Popping Boba</h4>
                    <p>Bursting boba with cherry flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Green Apple Popping Boba</h4>
                    <p>Bursting boba with green apple flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Passion Fruit Popping Boba</h4>
                    <p>Bursting boba with passion fruit flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Mango Popping Boba</h4>
                    <p>Bursting boba with mango flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Peach Popping Boba</h4>
                    <p>Bursting boba with peach flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Honey Aloevera Jelly</h4>
                    <p>Sweet aloe vera jelly with honey flavor.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹40</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Chia Seeds</h4>
                    <p>Nutritious chia seeds.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹25</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Packing</h4>
                    <p>Take-away packaging.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹10</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Special Items Category */}
            <div className={`menu-category ${activeCategory === 'all' ? '' : 'd-none'}`} id="special">
              <h3 className="category-title">Special Items</h3>
              <div className="menu-items">
                <div className="menu-item">
                  <div className="menu-item-content">
                    <h4>Goodies</h4>
                    <p>Special treats and goodies.</p>
                    <div className="menu-item-footer">
                      <div className="price">₹100</div>
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

export default Menu;