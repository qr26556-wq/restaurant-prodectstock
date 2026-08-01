MODERNIZE (2026) — changes applied on branch modernize-2026

What I updated in this commit:

- sw.js
  - Bumped cache name to v4.
  - Added offline.html to CORE_ASSETS and implemented navigation fallback: when a navigation fails, the service worker will serve offline.html.
  - Kept jsPDF CDN caching-first behavior so PDF export continues to work offline after the script is first loaded.
  - Same-origin assets use a cache-first with background update (stale-while-revalidate) pattern.

- offline.html
  - Small friendly offline page cached by the service worker.

Why I focused on sw.js/offline.html first:

- Updating the service worker gives immediate offline resilience and is a low-risk, high-impact 2026 PWA improvement.
- This change is backward-compatible: if you want, you can keep the branch and I can iterate further (head/meta changes, fonts preconnect, CSP meta, accessibility improvements) in follow-up commits.

Recommended follow-ups (I can apply these next):

1) Head & performance
   - Replace @import Google Fonts with preconnect + link rel=stylesheet (font-display=swap).
   - Preload manifest and icons, add crossorigin and SRI for CDN scripts.

2) Accessibility
   - Add role="main" to the app container, ARIA attributes for modal open/close, trap focus inside modals.
   - Ensure html[lang] and dir are updated when user selects Urdu.

3) Security
   - Add Content-Security-Policy in report-only mode on the page to test before enforcing.

If you'd like, I will continue and apply the head + accessibility changes now on this same branch. Reply "continue" and I'll make the next set of changes.
