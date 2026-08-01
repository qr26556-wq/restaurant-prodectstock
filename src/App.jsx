import React, { useState, useRef } from 'react';
import GoogleAuth from './components/GoogleAuth';
import ProductSelector, { PRODUCTS } from './components/ProductSelector';
import InteractiveCanvas from './components/InteractiveCanvas';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import { downloadMockup } from './utils/exportImage';
import { Paintbrush, Download, ShoppingBag, ShoppingCart, ShieldCheck, Zap, Heart, CheckCircle, Info, Flame, Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeProduct, setActiveProduct] = useState(PRODUCTS[0]);
  const [activeColor, setActiveColor] = useState(PRODUCTS[0].colors[0]);
  
  // Custom design layers placed on canvas
  const [elements, setElements] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);

  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [recentOrderCode, setRecentOrderCode] = useState('');

  const canvasRef = useRef(null);

  // Add customized design to shopping cart
  const handleAddToCart = () => {
    if (elements.length === 0) {
      alert("Please add some text or graphic templates on your product canvas before adding to cart!");
      return;
    }

    const newCartItem = {
      id: 'cart_' + Date.now(),
      product: activeProduct,
      color: activeColor,
      elements: [...elements],
      elementsCount: elements.length,
      price: activeProduct.price,
      quantity: 1
    };

    setCart([...cart, newCartItem]);
    alert(`Successfully added ${activeProduct.name} (${activeColor.name}) to your print-queue cart!`);
  };

  const handleRemoveFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id, quantity) => {
    setCart(cart.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      downloadMockup(canvasRef.current, `printcraft-${activeProduct.id}-${activeColor.name.toLowerCase().replace(' ', '-')}.png`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b12] text-slate-100 flex flex-col bg-grid relative selection:bg-brand-500 selection:text-white">
      {/* Background radial spotlights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] radial-glow pointer-events-none no-print" />
      <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] radial-glow-cyan pointer-events-none no-print" />

      {/* Header Navigation Section */}
      <header className="border-b border-white/10 glass-panel sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-white tracking-tight text-base sm:text-lg block">PrintCraft <span className="text-brand-400">Pro</span></span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold -mt-1 block">2026 Studio</span>
            </div>
          </div>

          {/* Core Trust Indicators & Stats for high-end look */}
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>12,410 Prints Active Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>ISO-2026 Secure</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Google Authentication Component (Step 2 required!) */}
            <GoogleAuth user={user} setUser={setUser} />
          </div>
        </div>
      </header>

      {/* Main Studio Body Workspace */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {recentOrderCode && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between animate-fade-in no-print">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div className="text-xs">
                <span className="font-bold text-white block">Active Order: {recentOrderCode}</span>
                <span className="text-slate-400">Print queue starts in 15 mins. Track in your linked Google Account.</span>
              </div>
            </div>
            <button
              onClick={() => setRecentOrderCode('')}
              className="text-slate-400 hover:text-slate-200 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar Area: Product Selector (3 cols) */}
          <section className="md:col-span-3 no-print">
            <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-6">
              <ProductSelector
                activeProduct={activeProduct}
                setActiveProduct={setActiveProduct}
                activeColor={activeColor}
                setActiveColor={setActiveColor}
              />
            </div>
          </section>

          {/* Central Workspace Canvas Area: Editor (6 cols) */}
          <section className="md:col-span-6 space-y-6">
            <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6 relative">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 no-print">
                <div>
                  <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <Paintbrush className="w-5 h-5 text-brand-400" />
                    Designer Engine
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Place designs, customize photos, tweak text elements</p>
                </div>

                {/* Top Quick Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all"
                    title="Export High-Res Mockup"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleAddToCart}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Queue Design
                  </button>
                </div>
              </div>

              {/* Central Interactive Customizer Engine */}
              <InteractiveCanvas
                activeProduct={activeProduct}
                activeColor={activeColor}
                elements={elements}
                setElements={setElements}
                selectedElementId={selectedElementId}
                setSelectedElementId={setSelectedElementId}
                canvasRef={canvasRef}
              />
            </div>
          </section>

          {/* Right Sidebar: Checkout, Cart & Invoicing (3 cols) */}
          <section className="md:col-span-3 no-print">
            <div className="glass-panel rounded-3xl p-5 border border-white/10">
              {!showCheckout ? (
                <Cart
                  cartItems={cart}
                  removeFromCart={handleRemoveFromCart}
                  updateQuantity={handleUpdateQuantity}
                  onCheckoutClick={() => setShowCheckout(true)}
                />
              ) : (
                <Checkout
                  cartItems={cart}
                  onBackToCart={() => setShowCheckout(false)}
                  onOrderSuccess={(orderId) => {
                    setRecentOrderCode(orderId);
                    setCart([]); // Clear cart upon successful simulation
                    setShowCheckout(false);
                  }}
                />
              )}
            </div>
          </section>

        </div>
      </main>

      {/* Modern Studio Footer */}
      <footer className="border-t border-white/10 py-6 mt-12 bg-[#08080d] no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 PrintCraft Pro Inc. All Rights Reserved. Powered by High-Resolution Custom DTG & Sublimation printing.</p>
          <div className="flex gap-4">
            <a href="#terms" className="hover:text-slate-300">Terms of Print</a>
            <a href="#privacy" className="hover:text-slate-300">Google Privacy Policy</a>
            <a href="#support" className="hover:text-slate-300">Custom Help Desk</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
