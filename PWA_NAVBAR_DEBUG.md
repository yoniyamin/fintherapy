# iOS PWA Navbar Debug Log

## Problem
The bottom TabBar renders correctly in the browser but is misplaced (pushed off-screen or floating above the bottom edge) when running as an installed PWA on iOS.

## Environment
- iOS standalone PWA (`display: standalone` in manifest)
- `viewport-fit=cover` in meta tag
- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: black-translucent`
- VitePWA with workbox service worker (`registerType: autoUpdate`)

## Original Code (before any fixes)
- `#root`: `position: fixed; inset: 0; padding-top: env(safe-area-inset-top); padding-left/right: env(safe-area-inset-left/right)`
- `#root > div` (CSS rule): `flex: 1; overflow: hidden`
- AppShell div: `flex min-h-0 flex-1 flex-col overflow-hidden`
- TabBar: normal flex child with `shrink-0`, `pb-[env(safe-area-inset-bottom,0px)]`
- In standalone mode, TabBar was replaced with a debug `PwaBottomBar` (white 1px line)

## Attempt 1: Replace `position: fixed` with `height: 100dvh`
**Hypothesis:** `position: fixed; inset: 0` has a known iOS standalone quirk where `bottom: 0` resolves above the actual screen bottom.

**Changes:**
- `#root`: changed from `position: fixed; inset: 0` to `height: 100dvh` (kept padding-top/left/right env vars)
- Added `height: 100%` to `html, body`
- Removed `PwaBottomBar` debug component
- TabBar now renders in both browser and PWA modes

**Result:** FAILED -- navbar visible but still misplaced in PWA.

## Attempt 2: Make TabBar `position: fixed; bottom: 0`
**Hypothesis:** Bypass the flex layout entirely by pinning the TabBar to the viewport bottom.

**Changes (on top of attempt 1):**
- TabBar: changed from `relative z-10 flex shrink-0` to `fixed inset-x-0 bottom-0 z-40`
- Main content: added `pb-[var(--shell-tab-clearance)]` to account for the fixed TabBar

**Result:** FAILED -- navbar still misplaced in PWA.

## Attempt 3: Move all `env()` safe-area handling out of `#root`
**Hypothesis:** `env(safe-area-inset-*)` on `#root`'s padding causes iOS standalone to miscalculate available content height.

**Changes:**
- `#root`: back to `position: fixed; inset: 0` with **zero padding** (no env() calls)
- AppShell div: added `pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`
- TabBar: reverted to normal flex child (`relative z-10 shrink-0`)
- Main content: reverted to `pb-4`

**Result:** FAILED -- navbar still misplaced in PWA.

## Attempt 4: Remove `#root > div` rule + add debug overlay
**Hypothesis:** The `#root > div` CSS rule might be interfering, and we need actual device measurements to stop guessing.

**Changes:**
- `#root` CSS: `position: fixed; inset: 0` with zero padding (same as attempt 3)
- **Removed** the `#root > div` CSS catch-all rule entirely
- AppShell div: changed from `flex-1 min-h-0` to `h-full` (explicit height instead of flex grow)
- Added `DebugOverlay` component showing: standalone flag, screen/viewport/root/shell/nav dimensions, safe area inset measurements, device pixel ratio
- TabBar: normal flex child

**Result:** PENDING

## Attempt 5: Separate safe-area filler below TabBar
**Root cause found via debug overlay:** The layout WAS correct all along (nav bottom = viewport bottom = screen bottom). The visual issue was `pb-[env(safe-area-inset-bottom)]` = 34px of padding INSIDE the nav, pushing icons 34px above the screen edge. In the browser, this value is 0 (Safari's toolbar covers the home indicator), so no gap appears.

**Changes:**
- Removed `pb-[env(safe-area-inset-bottom,0px)]` from TabBar nav element
- Added a separate `<div>` below TabBar: `h-[env(safe-area-inset-bottom,0px)] bg-surface-900` to fill the home indicator zone
- This makes the nav icons sit at the same position as in the browser, with the home indicator area handled separately below

**Result:** PENDING

## Attempt 6: Remove safe-area filler entirely
**Insight from debug data:** navRect bottom = 763, but viewport bottom = 797. The 34px filler div was consuming space in the flex column and pushing the nav 34px above the screen bottom. Same visual result as having the padding inside the nav.

**Changes:**
- Removed the safe-area filler `<div>` below TabBar entirely
- Nav has no safe-area bottom padding and no filler below it
- The nav will sit at the viewport bottom; the iOS home indicator overlays the bottom ~34px of the nav, but icons/labels are above it

**Result:** PENDING

## Attempt 7: Extend #root past viewport bottom to reach screen edge
**Root cause identified from debug data:** `innerHeight` (797) = `screen.height` (844) - `saTop` (47). The viewport is 47px shorter than the screen. `position: fixed; bottom: 0` stops at viewport y=797, but the actual screen bottom is at y=844. The bottom 47px of the screen is outside the web viewport.

**Changes:**
- `#root` CSS: changed `bottom: 0` to `bottom: calc(-1 * env(safe-area-inset-top, 0px))` — extends #root 47px past the viewport bottom to reach the actual screen bottom
- Restored `pb-[env(safe-area-inset-bottom,0px)]` on TabBar nav so icons sit above the home indicator
- Total #root height = viewport (797) + saTop (47) = 844 = full screen

**Result:** SUCCESS ✓ — rootRect now 844 (full screen), navRect bottom at 844 (screen edge).

## How to Re-enable Debug Overlay
In `src/components/layout/AppShell.tsx`, change `SHOW_DEBUG_OVERLAY` to `true`.

## Ideas Not Yet Tried
- [ ] `-webkit-fill-available` height on html/body (Apple-specific, known to work for iOS full-height)
- [ ] Remove `overflow: hidden` from `#root > div` CSS rule (could be clipping TabBar)
- [ ] Remove `#root > div` CSS rule entirely (might conflict with Tailwind classes)
- [ ] Change `apple-mobile-web-app-status-bar-style` from `black-translucent` to `default`
- [ ] Use CSS `@media (display-mode: standalone)` to conditionally remove `pb-[env(safe-area-inset-bottom)]` from TabBar (iOS standalone may already handle bottom safe area via OS)
- [ ] Test with service worker disabled / clear PWA cache / reinstall PWA to rule out stale cached assets
- [ ] Add visible debug output (e.g. display `window.innerHeight`, `visualViewport.height`, `env()` values) to understand what iOS standalone reports
- [ ] Try `position: absolute; inset: 0` on `#root` instead of `position: fixed`
- [ ] Try `height: 100%` chain (`html, body, #root` all `height: 100%`) with no fixed/dvh
- [ ] Try `min-height: -webkit-fill-available` on body (Apple-recommended pattern)
