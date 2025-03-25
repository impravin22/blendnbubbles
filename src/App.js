import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <div className="App">
      {/* Navigation */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <div className="container">
          <a className="navbar-brand" href="#"><img src="/logo.svg" alt="BlendNBubbles Logo" height="50" /> BlendNBubbles</a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <a className="nav-link" href="#home">Home</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#about">About Us</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#products">Products</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#contact">Contact</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="bg-dark text-white py-5" id="home">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <h1 className="display-4">BlendNBubbles</h1>
              <p className="lead">Where every bubble tells you a story</p>
              <p>Premium bubble tea imported from Taiwan to Kolkata, India</p>
              <a href="#products" className="btn btn-primary">Explore Our Menu</a>
            </div>
            <div className="col-md-6">
              {/* Hero image placeholder */}
              <div className="text-center">
                <img src="/logo.svg" alt="Bubble Tea" className="img-fluid rounded" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* About Section */}
      <section className="py-5" id="about">
        <div className="container">
          <h2 className="text-center mb-4">About BlendNBubbles</h2>
          <div className="row">
            <div className="col-md-6">
              {/* About image placeholder */}
              <div className="rounded bg-light p-4 h-100 d-flex align-items-center justify-content-center">
                <p className="text-center">Image of our Bubble Tea shop in Kolkata</p>
              </div>
            </div>
            <div className="col-md-6">
              <p>
                BlendNBubbles is Kolkata's premier bubble tea destination, bringing the authentic taste of Taiwan to India.
                Our carefully selected ingredients are imported directly from Taiwan to ensure the highest quality and authentic flavor.
              </p>
              <p>
                Founded with a passion for bubble tea and a commitment to quality, we're proud to introduce Kolkata
                to the wonderful world of bubble tea. Each cup is carefully crafted to provide a unique experience where every bubble tells a story.
              </p>
              <p>
                Our commitment to authenticity means we source our ingredients directly from Taiwan, ensuring you get the most authentic bubble tea experience in India.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-5 bg-light" id="products">
        <div className="container">
          <h2 className="text-center mb-4">Our Bubble Tea Menu</h2>
          <div className="row">
            {/* Product cards */}
            <div className="col-md-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Classic Milk Tea</h5>
                  <p className="card-text">Our signature milk tea with chewy tapioca pearls imported from Taiwan.</p>
                  <p className="card-text"><small className="text-muted">₹180</small></p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Taro Milk Tea</h5>
                  <p className="card-text">Creamy taro flavor with chewy tapioca pearls. A Taiwanese classic.</p>
                  <p className="card-text"><small className="text-muted">₹200</small></p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Matcha Bubble Tea</h5>
                  <p className="card-text">Premium Japanese matcha green tea with milk and pearls.</p>
                  <p className="card-text"><small className="text-muted">₹220</small></p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Brown Sugar Boba</h5>
                  <p className="card-text">Fresh milk with brown sugar syrup and caramelized tapioca pearls.</p>
                  <p className="card-text"><small className="text-muted">₹240</small></p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Fruit Tea Series</h5>
                  <p className="card-text">Refreshing tea with fresh fruit pieces and fruit-flavored bubbles.</p>
                  <p className="card-text"><small className="text-muted">₹190</small></p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Coconut Bubble Tea</h5>
                  <p className="card-text">Creamy coconut milk tea with tapioca pearls and coconut jelly.</p>
                  <p className="card-text"><small className="text-muted">₹210</small></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-5" id="contact">
        <div className="container">
          <h2 className="text-center mb-4">Visit Us</h2>
          <div className="row">
            <div className="col-md-6">
              <h4>Location</h4>
              <p>Senjuti Apt. Shop No -6, 68/16, Feeder Road, Barrackpore, Kolkata</p>
              <p>PIN: 700120</p>
              <h4>Hours</h4>
              <p>Monday - Sunday: 11am - 9pm</p>
              <h4>Contact</h4>
              <p>Phone: +91 7980233537</p>
              <p>Email: blendnbubbles@yahoo.com</p>
            </div>
            <div className="col-md-6">
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
          <p>© 2023 BlendNBubbles. All rights reserved.</p>
          <p>Premium Bubble Tea in Kolkata, India</p>
          <p>
            <a href="#" className="text-white me-3">Facebook</a>
            <a href="#" className="text-white me-3">Instagram</a>
            <a href="#" className="text-white">Twitter</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
