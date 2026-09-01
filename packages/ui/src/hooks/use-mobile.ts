import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";

export const MOBILE_BREAKPOINT_PX = 1024;

/** Matches Tailwind `lg` — viewports below this are treated as mobile/tablet. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${String(MOBILE_BREAKPOINT_PX - 1)}px)`;

export const DESKTOP_MEDIA_QUERY = `(min-width: ${String(MOBILE_BREAKPOINT_PX)}px)`;

/**
 * Returns whether the viewport is below the mobile breakpoint (1024px).
 *
 * Pair with CSS `lg:` visibility on the desktop sidebar shell so layout
 * responds on resize before/alongside this hook. SSR defaults to desktop
 * (`serverSnapshot: false`) to match the desktop-first sidebar markup.
 */
export function useIsMobile(): boolean {
	return useMediaQuery(MOBILE_MEDIA_QUERY, false);
}

/** Inverse of {@link useIsMobile} — desktop/tablet landscape and up. */
export function useIsDesktop(): boolean {
	return useMediaQuery(DESKTOP_MEDIA_QUERY, false);
}

/** Synchronous viewport check for event handlers (no hook subscription). */
export function isMobileViewport(): boolean {
	if (typeof window === "undefined") {
		return true;
	}
	return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}
