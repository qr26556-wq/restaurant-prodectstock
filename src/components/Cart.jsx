import React from 'react';
import { ShoppingBag, Trash2, ArrowRight, CreditCard, ShoppingCart } from 'lucide-react';

export default function Cart({ cartItems, removeFromCart, updateQuantity, onCheckoutClick }) {
  const total = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-brand-400" />
          Shopping Cart ({cartItems.length})
        </h3>
        {cartItems.length > 0 && (
          <span className="text-xs text-brand-300 font-bold bg-brand-500/10 px-2.5 py-1 rounded-full">
            Active Design
          </span>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-white/5 text-slate-400 space-y-2">
          <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto animate-bounce" />
          <p className="text-sm">Your cart is empty.</p>
          <p className="text-xs text-slate-500">Add your custom creation from the canvas above.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Cart Item Cards */}
          <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/15 transition-all"
              >
                {/* Simulated product thumbnail color-matched */}
                <div
                  className="w-14 h-14 rounded-lg flex items-center justify-center border border-white/10 relative overflow-hidden"
                  style={{ backgroundColor: item.color.hex }}
                >
                  <span className="text-xs uppercase font-extrabold text-black/60">{item.product.id.slice(0, 3)}</span>
                  {item.elementsCount > 0 && (
                    <span className="absolute bottom-0 right-0 bg-brand-500 text-[8px] text-white px-1 font-bold rounded-tl">
                      {item.elementsCount} layer(s)
                    </span>
                  )}
                </div>

                {/* Info details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-200 text-sm truncate">{item.product.name}</h4>
                  <p className="text-[11px] text-slate-400">
                    Color: <span className="text-slate-200">{item.color.name}</span>
                  </p>
                  <p className="font-extrabold text-brand-400 text-xs mt-1">${(item.price * item.quantity).toFixed(2)}</p>
                </div>

                {/* Actions: Quantities and Remove */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white/5 rounded-lg border border-white/10 text-xs overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="px-2.5 py-1 hover:bg-white/10 text-slate-300 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-2.5 font-bold text-slate-100">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2.5 py-1 hover:bg-white/10 text-slate-300 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing & Proceed to Secure Order Checkout */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Cart Subtotal</span>
              <span className="font-extrabold text-white text-sm">${total.toFixed(2)}</span>
            </div>
            
            <button
              onClick={onCheckoutClick}
              className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 transition-all text-xs flex items-center justify-center gap-2"
            >
              Proceed to Checkout
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
