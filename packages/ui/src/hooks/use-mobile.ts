import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns whether the viewport is below the mobile breakpoint (768px).
 *
 * Hydration-safe: the initial state is `false` on both server and first client
 * render (reading `window.innerWidth` in `useState` would mismatch once the
 * shell is server-rendered). The real value resolves in an effect right after
 * hydration, so consumers never see a React hydration error — just one frame
 * at the desktop default.
 */
export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = React.useState<boolean>(false);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`);
		const onChange = (): void => {
			setIsMobile(mql.matches);
		};
		onChange();
		mql.addEventListener("change", onChange);
		return (): void => {
			mql.removeEventListener("change", onChange);
		};
	}, []);

	return isMobile;
}
