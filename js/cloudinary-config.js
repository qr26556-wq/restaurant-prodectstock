/* Cloudinary config for browser-side image uploads.
   Only the cloud name + an UNSIGNED upload preset are used here — never put
   your API key or API secret in this file or anywhere in frontend code.
   An unsigned preset lets the browser upload directly to Cloudinary without
   needing a backend or exposing secret credentials. */
const CLOUDINARY_CONFIG = {
  cloudName: 'hvna6ugq',
  uploadPreset: 'alhadi_unsigned' // create this preset in Cloudinary dashboard (Settings > Upload > Upload presets > Add upload preset > Signing Mode: Unsigned)
};
