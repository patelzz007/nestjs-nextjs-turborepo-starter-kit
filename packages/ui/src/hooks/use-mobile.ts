import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns whether the viewport is below the mobile breakpoint (768px).
 *
 * Thin convenience wrapper over the generic {@link useMediaQuery} hook — the
 * mobile breakpoint is expressed as `max-width: 767px` so it stays consistent
 * with the admin shell's `md` variant (md = 768px and up).
 *
 * Hydration-safe by construction: `useMediaQuery` starts at `false` on both
 * server and first client render and resolves the real value in an effect, so
 * consumers never see a React hydration mismatch — just one frame at the
 * desktop default.
 */
export function useIsMobile(): boolean {
	return useMediaQuery(`(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`);
}
