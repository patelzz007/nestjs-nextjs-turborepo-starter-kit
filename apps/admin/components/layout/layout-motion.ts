/**
 * Single source of truth for the admin shell's framer-motion transitions
 * (sidebar audit, improvement 11). The desktop sidebar (`dashboard-layout.tsx`)
 * and the mobile drawer (`mobile-menu-overlay.tsx`) both import from here, so
 * the two can never drift apart — tune the curve once.
 */

export const DESKTOP_SIDEBAR_WIDTH = 280;

/**
 * Buttery open/close curve (the same ease used by Vercel/shadcn shells):
 * fast start, long soft landing — reads as deliberate rather than twitchy.
 */
export const SIDEBAR_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

/** Content fade/slide config — the reveal is never a hard clip edge. The tiny
    open delay lets the width get going before the menu fades in, but is kept
    short (0.06s) so it never reads as "empty panel lag". */
export const SIDEBAR_CONTENT_OPEN_TRANSITION: { readonly duration: number; readonly ease: "easeOut"; readonly delay: number } = {
	duration: 0.22,
	ease: "easeOut",
	delay: 0.06,
};

export const SIDEBAR_CONTENT_CLOSE_TRANSITION: { readonly duration: number; readonly ease: "easeOut"; readonly delay: number } = { duration: 0.22, ease: "easeOut", delay: 0 };

export const SIDEBAR_ASIDE_TRANSITION: { readonly duration: number; readonly ease: [number, number, number, number] } = { duration: 0.3, ease: SIDEBAR_EASE };

/** The inner content keeps its full width while the aside clips it during the tween. */
export const SIDEBAR_INNER_CLASS = "h-full";

/** Mobile drawer slide — same curve as the desktop sidebar, same duration. */
export const DRAWER_TRANSITION: { readonly duration: number; readonly ease: [number, number, number, number] } = { duration: 0.3, ease: SIDEBAR_EASE };

/** Backdrop cross-fade. */
export const BACKDROP_TRANSITION: { readonly duration: number; readonly ease: "easeOut" } = { duration: 0.25, ease: "easeOut" };
