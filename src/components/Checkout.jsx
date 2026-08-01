import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { CreditCard, ShieldCheck, Mail, MapPin, Truck, Award, RefreshCw, Printer, CheckCircle, ArrowLeft } from 'lucide-react';

export default function Checkout({ cartItems, onBackToCart, onOrderSuccess }) {
  const [shipping, setShipping] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    zip: '',
    country: 'United States'
  });
  const [card, setCard] = useState({
    number: '4111 2222 3333 4444',
    expiry: '09/28',
    cvc: '382'
  });

  const [isPaying, setIsPaying] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = subtotal * 0.08;
  const shippingCost = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + tax + shippingCost;

  const handlePlaceOrder = (e) => {
    e.preventDefault();
    if (!shipping.name || !shipping.email || !shipping.address) {
      alert("Please fill in shipping Name, Email, and Address details.");
      return;
    }

    setIsPaying(true);

    setTimeout(() => {
      setIsPaying(false);
      setOrderComplete(true);
      const generatedId = 'PRT-' + Math.floor(100000 + Math.random() * 900000);
      setOrderId(generatedId);
      
      // Gorgeous celebratory canvas-confetti burst
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B']
      });

      if (onOrderSuccess) {
        onOrderSuccess(generatedId);
      }
    }, 2000);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  if (orderComplete) {
    return (
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-6 print-container">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2 no-print">
          <CheckCircle className="w-10 h-10 animate-bounce" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-white print-text-dark">Order Placed Successfully!</h3>
          <p className="text-xs text-slate-400 no-print">Thank you for ordering your customized apparel creations.</p>
          <div className="p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-xl max-w-xs mx-auto text-xs font-mono font-bold text-brand-300 print-bg-light print-text-dark">
            Receipt ID: {orderId}
          </div>
        </div>

        {/* Detailed Invoice Breakdown for Print Out slip (Step 5 required!) */}
        <div className="text-left rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3 text-xs print-bg-light print-text-dark print-border-thick">
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-slate-300 print-text-dark">Shipping To:</span>
            <span className="text-slate-100 font-medium print-text-dark">{shipping.name} ({shipping.email})</span>
          </div>
          <div className="flex justify-between pb-1 text-slate-400">
            <span>Delivery Address:</span>
            <span className="text-slate-200 print-text-dark">{shipping.address}, {shipping.city}, {shipping.zip}</span>
          </div>

          <div className="border-t border-dashed border-white/10 pt-2 space-y-1.5">
            <span className="font-bold text-slate-300 block mb-1 print-text-dark">Ordered Items:</span>
            {cartItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px] text-slate-400">
                <span className="print-text-dark">{item.quantity}x {item.product.name} ({item.color.name})</span>
                <span className="font-bold text-slate-200 print-text-dark">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-2 space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="print-text-dark">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tax (8%):</span>
              <span className="print-text-dark">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Delivery Cost:</span>
              <span className="print-text-dark">{shippingCost === 0 ? 'FREE' : `$${shippingCost}`}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-dashed border-white/10 print-text-dark">
              <span>Total Paid:</span>
              <span className="text-brand-400 print-text-dark">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5 no-print">
          <button
            onClick={handlePrintReceipt}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 text-xs font-semibold transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Slip / Invoice
          </button>
          <button
            onClick={onBackToCart}
            className="py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all"
          >
            Create Another Design
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePlaceOrder} className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-5 animate-fade-in no-print">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-400" />
          Checkout Studio
        </h3>
        <button
          type="button"
          onClick={onBackToCart}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Cart
        </button>
      </div>

      {/* Shipping Details */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
          <Truck className="w-3.5 h-3.5 text-brand-400" />
          1. Shipping Information
        </h4>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              value={shipping.name}
              onChange={(e) => setShipping({ ...shipping, name: e.target.value })}
              placeholder="Your Full Name"
              className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs"
            />
            <input
              type="email"
              required
              value={shipping.email}
              onChange={(e) => setShipping({ ...shipping, email: e.target.value })}
              placeholder="Your Email"
              className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs"
            />
          </div>
          <input
            type="text"
            required
            value={shipping.address}
            onChange={(e) => setShipping({ ...shipping, address: e.target.value })}
            placeholder="Delivery Address"
            className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              required
              value={shipping.city}
              onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
              placeholder="City"
              className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs col-span-2"
            />
            <input
              type="text"
              required
              value={shipping.zip}
              onChange={(e) => setShipping({ ...shipping, zip: e.target.value })}
              placeholder="ZIP Code"
              className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Credit Card/Simulated Secure Payment Method */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
          2. Safe Card Payment
        </h4>

        <div className="space-y-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="relative">
            <input
              type="text"
              required
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })}
              placeholder="Card Number"
              className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs font-mono"
            />
            <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              value={card.expiry}
              onChange={(e) => setCard({ ...card, expiry: e.target.value })}
              placeholder="MM/YY"
              className="px-3.5 py-2 rounded-lg bg-zinc-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs text-center font-mono"
            />
            <input
              type="text"
              required
              value={card.cvc}
              onChange={(e) => setCard({ ...card, cvc: e.target.value })}
              placeholder="CVC"
              className="px-3.5 py-2 rounded-lg bg-zinc-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs text-center font-mono"
            />
          </div>
        </div>
      </div>

      {/* Pricing Breakdown Card */}
      <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/5 space-y-2 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Subtotal:</span>
          <span className="font-semibold text-slate-200">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Taxes (8%):</span>
          <span className="font-semibold text-slate-200">${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Shipping:</span>
          <span className="font-semibold text-slate-200">
            {shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}
          </span>
        </div>
        <div className="flex justify-between text-sm font-extrabold text-white border-t border-white/10 pt-2">
          <span>Total:</span>
          <span className="text-brand-400 text-base">${total.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPaying}
        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-all text-xs flex items-center justify-center gap-2"
      >
        {isPaying ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Validating Payment with Google Pay...
          </>
        ) : (
          <>
            Place Custom Order (${total.toFixed(2)})
          </>
        )}
      </button>

      <div className="text-[10px] text-center text-slate-500 flex items-center justify-center gap-1.5 pt-1">
        <Award className="w-3.5 h-3.5 text-brand-400" />
        <span>Secure checkout protected by Google Cloud Key</span>
      </div>
    </form>
  );
}
