import React from 'react';
import { Shirt, Trophy, Smartphone, Inbox, Compass, Star } from 'lucide-react';

export const PRODUCTS = [
  {
    id: 'tshirt',
    name: 'Classic Organic Tee',
    category: 'Apparel',
    price: 29.99,
    rating: 4.9,
    reviews: 142,
    specs: '100% Organic Ring-spun Cotton, 220 GSM',
    colors: [
      { name: 'Pure White', hex: '#FFFFFF' },
      { name: 'Pitch Black', hex: '#111115' },
      { name: 'Navy Blue', hex: '#1E3A8A' },
      { name: 'Sage Green', hex: '#2F4F4F' },
      { name: 'Crimson Red', hex: '#991B1B' }
    ],
    // SVG/CSS Representation layout
    dimensions: { width: 340, height: 400, printableX: 85, printableY: 100, printableW: 170, printableH: 220 }
  },
  {
    id: 'hoodie',
    name: 'Over-sized Heavy Hoodie',
    category: 'Apparel',
    price: 59.99,
    rating: 4.8,
    reviews: 98,
    specs: '80% Cotton / 20% Polyester Premium Fleece, 400 GSM',
    colors: [
      { name: 'Heather Grey', hex: '#D1D5DB' },
      { name: 'Carbon Black', hex: '#1F2937' },
      { name: 'Warm Sand', hex: '#D7C49E' },
      { name: 'Forest Green', hex: '#064E3B' }
    ],
    dimensions: { width: 340, height: 400, printableX: 90, printableY: 120, printableW: 160, printableH: 190 }
  },
  {
    id: 'mug',
    name: 'Ceramic Minimalist Mug',
    category: 'Home & Living',
    price: 18.99,
    rating: 5.0,
    reviews: 64,
    specs: 'Premium Grade A Ceramic, Dishwasher & Microwave safe, 11oz',
    colors: [
      { name: 'Glossy White', hex: '#F9FAFB' },
      { name: 'Matte Charcoal', hex: '#374151' },
      { name: 'Dusty Rose', hex: '#FDA4AF' },
      { name: 'Teal Lagoon', hex: '#115E59' }
    ],
    dimensions: { width: 340, height: 400, printableX: 110, printableY: 100, printableW: 120, printableH: 180 }
  },
  {
    id: 'cap',
    name: 'Retro Snapback Cap',
    category: 'Accessories',
    price: 24.99,
    rating: 4.7,
    reviews: 45,
    specs: '6-Panel structured crown, flat visor, snap closure',
    colors: [
      { name: 'Midnight Black', hex: '#111827' },
      { name: 'Vintage Khaki', hex: '#F3E5AB' },
      { name: 'Royal Blue', hex: '#1D4ED8' }
    ],
    dimensions: { width: 340, height: 400, printableX: 110, printableY: 150, printableW: 120, printableH: 80 }
  },
  {
    id: 'phonecase',
    name: 'Eco-leather Sleek Case',
    category: 'Accessories',
    price: 21.99,
    rating: 4.9,
    reviews: 119,
    specs: 'Biodegradable polymer, tactile buttons, 10ft drop protection',
    colors: [
      { name: 'Obsidian Black', hex: '#111827' },
      { name: 'Sage Olive', hex: '#6B8E23' },
      { name: 'Tan Leather', hex: '#B87333' },
      { name: 'Electric Violet', hex: '#6D28D9' }
    ],
    dimensions: { width: 340, height: 400, printableX: 90, printableY: 70, printableW: 160, printableH: 260 }
  }
];

export default function ProductSelector({ activeProduct, setActiveProduct, activeColor, setActiveColor }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Compass className="w-5 h-5 text-brand-400" />
          Select Premium Product
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Choose a base canvas to create your custom masterpiece</p>
      </div>

      {/* Product List Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1">
        {PRODUCTS.map((prod) => {
          const isSelected = activeProduct.id === prod.id;
          return (
            <button
              key={prod.id}
              onClick={() => {
                setActiveProduct(prod);
                setActiveColor(prod.colors[0]);
              }}
              className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-brand-600/10 border-2 border-brand-500 shadow-lg shadow-brand-500/5'
                  : 'bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              {/* Active Glow Accent */}
              {isSelected && (
                <div className="absolute right-0 top-0 w-12 h-12 bg-brand-500/10 rounded-full blur-lg" />
              )}

              {/* Product Category Icon */}
              <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-brand-500 text-white' : 'bg-white/5 text-slate-300'}`}>
                {prod.id === 'tshirt' && <Shirt className="w-5 h-5" />}
                {prod.id === 'hoodie' && <Shirt className="w-5 h-5 stroke-[2.5]" />}
                {prod.id === 'mug' && <Inbox className="w-5 h-5" />}
                {prod.id === 'cap' && <Trophy className="w-5 h-5" />}
                {prod.id === 'phonecase' && <Smartphone className="w-5 h-5" />}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{prod.category}</span>
                  <div className="flex items-center gap-1 text-[11px] text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{prod.rating}</span>
                  </div>
                </div>
                <h4 className="font-bold text-slate-100 text-sm mt-0.5 truncate">{prod.name}</h4>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{prod.specs}</p>

                <div className="flex items-center justify-between mt-2.5">
                  <span className="font-extrabold text-white text-sm">${prod.price.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-500">{prod.reviews} orders</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Color Overlay Panel */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Product Custom Color</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Updates mockup dynamically instantly</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {activeProduct.colors.map((color) => {
            const isSelected = activeColor.name === color.name;
            return (
              <button
                key={color.name}
                onClick={() => setActiveColor(color)}
                title={color.name}
                className={`w-9 h-9 rounded-full relative flex items-center justify-center transition-all ${
                  isSelected ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-[#0b0b12] scale-105' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex }}
              >
                {/* Contrast indicator for light/dark active states */}
                {isSelected && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      color.hex === '#FFFFFF' || color.hex === '#F9FAFB' || color.hex === '#D1D5DB' || color.hex === '#F3E5AB'
                        ? 'bg-slate-900'
                        : 'bg-white'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          Active: <span className="text-slate-200">{activeColor.name}</span>
        </p>
      </div>
    </div>
  );
}
