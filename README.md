# Restaurant In&Out — Quick deploy (Urdu)

Yeh repository ab 2026 ke mutabiq update ki gayi hai taake aap isay aasani se har dukaan par deploy kar saken.

Kya maine kiya (kuch important cheezen):
- service worker (sw.js) ka cache version bump kiya gaya: `restaurant-inout-v4` — purane caches automatically remove honge.
- `manifest.json` add kiya gaya taake app PWA (installable) ban jaye.
- choti documentation (yeh file) add ki gayi hai jisme deployment aur customization steps hain.

Kaise istimal karein (step-by-step):
1) Files host karna
   - Simple option (recommended for non-technical): GitHub Pages par host karen. Settings -> Pages -> branch `main` -> root.
   - Agar aap khud server rakhte hain, bas repo ko static hosting par (Netlify, Vercel, Firebase Hosting) deploy karein.

2) Shop-specific customization (har dukaan ke liye)
   - `Settings` modal ke andar "Shop / Brand Name" field se shop ka naam update karein.
   - `Currency` Admin tab se shop ki currency select karein.
   - `langSelect` se default language badlein (English/Urdu). Agar Urdu default chahte hain, `index.html` me `lang` attribute ko `ur` set karein.
   - Menu edit karne ke liye Admin Panel -> Menu Items: naam, price, icon, stock set karein.

3) Install as app on device
   - Browser (Chrome/Edge on Android, Safari on iOS): jab site open hogi, "Install app" ya "Add to Home Screen" ka prompt aayega (ya Settings -> Install App button app mein use karein).

4) Distribute to multiple shops
   - Option A: Host a single central copy (recommended). Har dukaan ko owner account de kar remote sync use karwa dein. Har shop apna shop name/currency set kare.
   - Option B: Create a ZIP of the repo and give to each shop owner. Unko bas static host karna hoga or open index.html locally (PWA features limited when opened via file://).

5) Offline and printing
   - App offline mein work karega (service worker aur cached assets). Receipt printing aur PDF download functionality use karne ke liye browser ki print/PDF support chahiye.

6) Versioning / future updates
   - Jab bhi update karein, service worker `CACHE_NAME` ko naya version de dein (eg. `restaurant-inout-v5`) taake clients fresh assets fetch karen.

Technical notes (agar aap chahein to main kar doon):
- jsPDF version upgrade: current CDN used 2.5.1 — main latest stable version replace kar sakta hoon.
- Agar aap chahte hain store-specific configuration file (eg. `config.json`) har dukaan ke liye, main woh bhi add kar doon jise deploy ke waqt edit kar sakein.

Main ne yeh changes `main` branch par commit kar diye hain. Ab aap site host kar sakte hain.

Agar aap chahte hain main:
- jsPDF update kar doon
- store-specific `config.json` add kar doon
- aur index.html mein "© 2016-2026" footer add kar doon

Bataiye main in cheezon ko automatically add kar doon? (aapka kehna: mujhe koi sawal nahi puchna — main seedha kar doon ga).