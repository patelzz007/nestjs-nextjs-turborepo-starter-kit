import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = React.useState<boolean>(() => {
		if (typeof window === "undefined") {
			return false;
		}
		return window.innerWidth < MOBILE_BREAKPOINT;
	});

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`);
		const onChange = (): void => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};
		mql.addEventListener("change", onChange);
		return (): void => {
			mql.removeEventListener("change", onChange);
		};
	}, []);

	return isMobile;
}
