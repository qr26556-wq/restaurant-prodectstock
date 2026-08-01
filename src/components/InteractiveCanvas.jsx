import React, { useState, useRef, useEffect } from 'react';
import { Upload, Type, Trash2, Move, RotateCw, ZoomIn, Plus, Heart, HelpCircle, Image as ImageIcon } from 'lucide-react';

const FONTS = [
  { name: 'Sans Serif (Inter)', value: 'Inter, sans-serif' },
  { name: 'Modern Sans (Jakarta)', value: 'Plus Jakarta Sans, sans-serif' },
  { name: 'Retro Bangers', value: 'Bangers, cursive' },
  { name: 'Classy Serif (Cinzel)', value: 'Cinzel, serif' },
  { name: 'Futuristic (Grotesk)', value: 'Space Grotesk, sans-serif' },
  { name: 'Elegant (Playfair)', value: 'Playfair Display, serif' }
];

const PRESET_GRAPHICS = [
  {
    name: 'Retro 80s Sun',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=200&q=80'
  },
  {
    name: 'Cyber Skull Neon',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=200&q=80'
  },
  {
    name: 'Aesthetic Floral',
    url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=200&q=80'
  },
  {
    name: 'Streetwear Emblem',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=200&q=80'
  }
];

export default function InteractiveCanvas({
  activeProduct,
  activeColor,
  elements,
  setElements,
  selectedElementId,
  setSelectedElementId,
  canvasRef
}) {
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#8B5CF6');
  const [textFont, setTextFont] = useState('Plus Jakarta Sans, sans-serif');

  const fileInputRef = useRef(null);

  // Add loaded image/photo or preset layer
  const addImageLayer = (url) => {
    const newElement = {
      id: 'img_' + Date.now(),
      type: 'image',
      url: url,
      x: 30,
      y: 40,
      scale: 0.6,
      rotation: 0,
      name: 'Custom Graphic'
    };
    setElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          addImageLayer(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Add custom typography text layer
  const addTextLayer = () => {
    if (!textInput.trim()) return;
    const newElement = {
      id: 'text_' + Date.now(),
      type: 'text',
      text: textInput,
      color: textColor,
      font: textFont,
      x: 40,
      y: 80,
      scale: 1.0,
      rotation: 0
    };
    setElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
    setTextInput('');
  };

  // Layer transformation handlers
  const updateSelectedElement = (key, value) => {
    setElements(elements.map(el => {
      if (el.id === selectedElementId) {
        return { ...el, [key]: value };
      }
      return el;
    }));
  };

  const deleteElement = (id) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  const activeElement = elements.find(el => el.id === selectedElementId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Workspace Interactive Designer Area (7 cols) */}
      <div className="lg:col-span-7 flex flex-col items-center">
        {/* Canvas Visual Mockup Frame */}
        <div className="relative w-full max-w-[460px] aspect-[10/11] rounded-3xl bg-gradient-to-b from-[#161624] to-[#0e0e17] border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center p-6">
          
          {/* Subtle Dynamic Laser Glows */}
          <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full text-[10px] text-brand-300 font-bold uppercase tracking-wider animate-pulse-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            Live 2026 Engine
          </div>

          {/* Interactive Core Product Canvas Container */}
          <div
            ref={canvasRef}
            className="relative w-[340px] h-[400px] transition-all duration-300"
            style={{
              // Colorized dynamic backdrop mask
              backgroundColor: activeColor.hex,
              borderRadius: activeProduct.id === 'mug' ? '24px 40px 40px 24px' : activeProduct.id === 'phonecase' ? '40px' : '0px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Base Product Mockup SVG/Image Overlays to create realistic contours/shadows */}
            {activeProduct.id === 'tshirt' && (
              <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-80 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80')`,
                  mixBlendMode: 'multiply'
                }}
              />
            )}
            {activeProduct.id === 'hoodie' && (
              <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-85 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=400&q=80')`,
                  mixBlendMode: 'multiply'
                }}
              />
            )}
            {activeProduct.id === 'mug' && (
              <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-75 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80')`,
                  mixBlendMode: 'multiply'
                }}
              />
            )}
            {activeProduct.id === 'cap' && (
              <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-80 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=400&q=80')`,
                  mixBlendMode: 'multiply'
                }}
              />
            )}
            {activeProduct.id === 'phonecase' && (
              <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-80 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=400&q=80')`,
                  mixBlendMode: 'multiply'
                }}
              />
            )}

            {/* Print Area Boundary Overlay */}
            <div
              className="absolute border border-dashed border-white/30 bg-black/5 pointer-events-none flex items-start justify-center"
              style={{
                left: activeProduct.dimensions.printableX,
                top: activeProduct.dimensions.printableY,
                width: activeProduct.dimensions.printableW,
                height: activeProduct.dimensions.printableH,
              }}
            >
              <span className="text-[9px] text-white/50 bg-black/40 px-1 rounded uppercase tracking-widest mt-1">Print Safe Area</span>
            </div>

            {/* Render Editable Layers/Elements */}
            <div className="absolute inset-0 overflow-hidden">
              {elements.map((el) => {
                const isSelected = selectedElementId === el.id;
                return (
                  <div
                    key={el.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementId(el.id);
                    }}
                    className={`absolute cursor-pointer select-none ${isSelected ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-black/50 p-1' : 'hover:ring-1 hover:ring-white/30'}`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: `rotate(${el.rotation}deg) scale(${el.scale})`,
                      transformOrigin: 'center center',
                      transition: 'border-color 0.15s',
                      maxWidth: '80%'
                    }}
                  >
                    {el.type === 'image' ? (
                      <img src={el.url} alt={el.name} className="max-w-[130px] h-auto object-contain rounded" pointerEvents="none" />
                    ) : (
                      <span
                        style={{
                          color: el.color,
                          fontFamily: el.font,
                          whiteSpace: 'nowrap',
                          fontSize: '18px',
                          fontWeight: 'bold',
                        }}
                      >
                        {el.text}
                      </span>
                    )}

                    {/* Quick Delete Overlay Button */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElement(el.id);
                        }}
                        className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Controls Info */}
        <div className="w-full mt-3 flex items-center justify-between text-xs text-slate-400 max-w-[460px] bg-white/5 p-3 rounded-2xl border border-white/10">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-brand-400" />
            <span>Click elements inside product to select & transform</span>
          </div>
          {elements.length > 0 && (
            <button
              onClick={() => { setElements([]); setSelectedElementId(null); }}
              className="text-rose-400 hover:text-rose-300 font-semibold"
            >
              Clear Canvas
            </button>
          )}
        </div>
      </div>

      {/* Control Tools Panel (5 cols) */}
      <div className="lg:col-span-5 space-y-5">
        
        {/* Tool: Upload Custom Photo */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3.5">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Upload Custom Image</h4>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2.5 p-4 rounded-xl border-2 border-dashed border-white/15 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all text-sm font-semibold group"
            >
              <Upload className="w-5 h-5 text-slate-400 group-hover:text-brand-400 transition-colors" />
              <span className="text-slate-300">Choose PNG / JPG Photo</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        {/* Tool: Add Dynamic Typography */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3.5">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-brand-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Add Custom Text</h4>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter slogan / name..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
              />
              <button
                onClick={addTextLayer}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {/* Typography Properties */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Font Picker */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Font Style</span>
                <select
                  value={textFont}
                  onChange={(e) => setTextFont(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs"
                >
                  {FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Color Picker */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Text Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono uppercase text-slate-300">{textColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tool: Selected Element Slider Transformations */}
        {activeElement ? (
          <div className="p-5 rounded-2xl bg-brand-600/5 border border-brand-500/20 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-brand-400">Element Controls</span>
              <button
                onClick={() => deleteElement(activeElement.id)}
                className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Scale Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                  Scale
                </span>
                <span className="font-mono text-slate-400">{(activeElement.scale * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.5"
                step="0.05"
                value={activeElement.scale}
                onChange={(e) => updateSelectedElement('scale', parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-brand-500 bg-white/10"
              />
            </div>

            {/* Rotation Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                  Rotation
                </span>
                <span className="font-mono text-slate-400">{activeElement.rotation}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={activeElement.rotation}
                onChange={(e) => updateSelectedElement('rotation', parseInt(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-brand-500 bg-white/10"
              />
            </div>

            {/* Position Controls */}
            <div className="grid grid-cols-2 gap-3.5 pt-1.5">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">X Position</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={activeElement.x}
                  onChange={(e) => updateSelectedElement('x', parseInt(e.target.value))}
                  className="w-full h-1.5 appearance-none cursor-pointer accent-brand-500 bg-white/10"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Y Position</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={activeElement.y}
                  onChange={(e) => updateSelectedElement('y', parseInt(e.target.value))}
                  className="w-full h-1.5 appearance-none cursor-pointer accent-brand-500 bg-white/10"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 text-center py-8">
            <p className="text-xs text-slate-400">Add text or upload a custom photo image to start customizing your print design.</p>
          </div>
        )}

        {/* Tool: Preloaded Preset Graphics Template Library */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Graphic Presets Library</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Place gorgeous ready-made 2026 elements on one click</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_GRAPHICS.map((g, idx) => (
              <button
                key={idx}
                onClick={() => addImageLayer(g.url)}
                title={g.name}
                className="relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-brand-500/50 hover:scale-105 active:scale-95 transition-all group bg-zinc-900"
              >
                <img src={g.url} alt={g.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[9px] text-white font-bold p-1 text-center leading-tight">
                  Insert
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
