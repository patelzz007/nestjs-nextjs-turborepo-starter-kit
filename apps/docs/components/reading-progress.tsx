"use client";

import { useEffect, useState } from "react";

/** Reads scroll progress; returns 0 on the server / when nothing scrolls. */
function computeProgress(): number {
	if (typeof window === "undefined") {
		return 0;
	}
	const documentElement = document.documentElement;
	const max: number = documentElement.scrollHeight - documentElement.clientHeight;
	return max > 0 ? Math.min(1, window.scrollY / max) : 0;
}

/**
 * Thin reading-progress bar pinned to the top of the viewport. It measures
 * document scroll, so it works on every page that scrolls the window. The
 * initial value comes from a lazy `useState` initializer (hydration-safe), and
 * scroll/resize listeners only ever write state from event handlers — never
 * synchronously from an effect.
 */
export function ReadingProgress(): React.JSX.Element {
	const [progress, setProgress] = useState<number>(computeProgress);

	useEffect(() => {
		const onScroll = (): void => {
			setProgress(computeProgress());
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll, { passive: true });
		return (): void => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, []);

	return (
		<div aria-hidden className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
			<div className="bg-fd-primary h-full transition-[width] duration-150 ease-out" style={{ width: `${String(progress * 100)}%` }} />
		</div>
	);
}
