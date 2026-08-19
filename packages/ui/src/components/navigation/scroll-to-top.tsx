"use client";

import { ChevronUp } from "lucide-react";
import * as React from "react";

import { findPageScrollContainer } from "../../lib/scroll-container";
import { cn } from "../../lib/utils";

export interface ScrollToTopProps {
	/** Scroll threshold in pixels before the button appears (default: 300). */
	readonly threshold?: number;
	/** Smooth scroll behavior (default: "smooth"). */
	readonly behavior?: ScrollBehavior;
}

/**
 * ScrollToTop — a floating "back to top" chevron shared by every app. It does
 * NOT assume the page scrolls the window: the admin shell scrolls inside
 * `<main class="flex-1 overflow-y-auto">`, while the web app scrolls the
 * window, so the real scroller is detected by walking up from the button's own
 * DOM position (`findPageScrollContainer`). That is why the button must be
 * mounted INSIDE the scrollable area (inside `<main>` in the admin layout;
 * anywhere in the web layout where window scrolls) — mounted outside, the
 * walk-up lands on `window` and the button silently never appears.
 *
 * Framework-free (no `next/*` imports), so it lives in `packages/ui` and is
 * imported as `@workspace/ui/components/navigation/scroll-to-top`.
 */
export function ScrollToTop({ threshold = 300, behavior = "smooth" }: ScrollToTopProps): React.JSX.Element {
	// Initial state is `false` on BOTH server and first client render (reading
	// scroll position in `useState` is not only hydration-unsafe, it's racy
	// against scroll restoration). The real position resolves in the effect.
	const [visible, setVisible] = React.useState<boolean>(false);
	const buttonRef = React.useRef<HTMLButtonElement>(null);
	// The detected scroller, resolved once in the effect and reused by the
	// click handler — avoids a second DOM walk per click.
	const containerRef = React.useRef<Window | HTMLElement | null>(null);

	React.useEffect(() => {
		const container = findPageScrollContainer(buttonRef.current);
		containerRef.current = container;
		const getScrollTop = (): number => (container instanceof Window ? container.scrollY : container.scrollTop);

		const handleScroll = (): void => {
			setVisible(getScrollTop() > threshold);
		};

		handleScroll();
		container.addEventListener("scroll", handleScroll, { passive: true });
		return (): void => {
			container.removeEventListener("scroll", handleScroll);
		};
	}, [threshold]);

	const handleClick = React.useCallback((): void => {
		(containerRef.current ?? findPageScrollContainer(buttonRef.current)).scrollTo({ top: 0, behavior });
	}, [behavior]);

	return (
		<button
			ref={buttonRef}
			type="button"
			onClick={handleClick}
			aria-label="Scroll to top"
			className={cn(
				"z-overlay fixed right-6 bottom-6 flex h-10 w-10 items-center justify-center rounded-full shadow-lg",
				"bg-foreground text-background hover:opacity-90 active:scale-95",
				"transition-all duration-300 ease-out",
				"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
				visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
			)}>
			<ChevronUp className="h-5 w-5" />
		</button>
	);
}
