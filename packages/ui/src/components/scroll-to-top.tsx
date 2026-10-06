"use client";

import { Button } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { ChevronUp } from "lucide-react";
import * as React from "react";

import { mergeRefs } from "../lib/core/merge-refs";
import { findPageScrollContainer } from "../lib/core/scroll-container";
import { cn } from "../lib/core/utils";

/** How far (px) the page must scroll before the button appears. */
export const DEFAULT_SCROLL_TO_TOP_THRESHOLD_PX = 300;

export interface ScrollToTopProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
	/** Scroll threshold in pixels before the button appears. @default DEFAULT_SCROLL_TO_TOP_THRESHOLD_PX */
	readonly threshold?: number;
	/** Smooth scroll behavior (default: "smooth"). */
	readonly behavior?: ScrollBehavior;
	/**
	 * Controlled visibility. When set, the parent decides when the button shows
	 * and the scroll-position tracking only reports through `onVisibleChange`.
	 * Omit it to let the button follow the scroll position (`threshold`).
	 */
	readonly visible?: boolean;
	/** Fired when the scroll position crosses `threshold` (in both modes). */
	readonly onVisibleChange?: (visible: boolean) => void;
	/** Per-usage accessible name of the button; defaults to the `scrollToTop` family's `label`. */
	readonly label?: string;
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
 * Visibility is derived from the scroll position by default (the app chrome
 * owns it); pass `visible` / `onVisibleChange` to control it from a parent.
 *
 * Framework-free (no `next/*` imports), so it lives in `packages/ui` and is
 * imported as `@workspace/ui/components/scroll-to-top`.
 */
export const ScrollToTop = React.forwardRef<HTMLElement, ScrollToTopProps>(function ScrollToTop(
	{ threshold = DEFAULT_SCROLL_TO_TOP_THRESHOLD_PX, behavior = "smooth", visible: visibleProp, onVisibleChange, label, className, onClick, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("scrollToTop");
	// Initial state is `false` on BOTH server and first client render (reading
	// scroll position in `useState` is not only hydration-unsafe, it's racy
	// against scroll restoration). The real position resolves in the effect.
	const [scrolledPast, setScrolledPast] = React.useState<boolean>(false);
	const visible = visibleProp ?? scrolledPast;
	const buttonRef = React.useRef<HTMLElement>(null);
	const setButtonRef = React.useMemo(() => mergeRefs(buttonRef, ref), [ref]);
	// The detected scroller, resolved once in the effect and reused by the
	// click handler — avoids a second DOM walk per click.
	const containerRef = React.useRef<Window | HTMLElement | null>(null);
	// Latest callback, read by the scroll listener without re-subscribing.
	const onVisibleChangeRef = React.useRef(onVisibleChange);

	React.useEffect(() => {
		onVisibleChangeRef.current = onVisibleChange;
	}, [onVisibleChange]);

	React.useEffect(() => {
		const container = findPageScrollContainer(buttonRef.current);
		containerRef.current = container;
		const getScrollTop = (): number => (container instanceof Window ? container.scrollY : container.scrollTop);
		let lastVisible: boolean | null = null;

		const handleScroll = (): void => {
			const next = getScrollTop() > threshold;
			setScrolledPast(next);
			if (next !== lastVisible) {
				lastVisible = next;
				onVisibleChangeRef.current?.(next);
			}
		};

		handleScroll();
		container.addEventListener("scroll", handleScroll, { passive: true });
		return (): void => {
			container.removeEventListener("scroll", handleScroll);
		};
	}, [threshold]);

	const handleClick = React.useCallback<NonNullable<ScrollToTopProps["onClick"]>>(
		(event): void => {
			onClick?.(event);
			(containerRef.current ?? findPageScrollContainer(buttonRef.current)).scrollTo({ top: 0, behavior });
		},
		[behavior, onClick],
	);

	return (
		<Button
			ref={setButtonRef}
			type="button"
			variant="default"
			size="icon"
			data-slot="scroll-to-top"
			data-visible={visible ? "" : undefined}
			// While hidden it stays mounted (for the fade) but out of the tab order and the accessibility tree.
			aria-hidden={visible ? undefined : true}
			tabIndex={visible ? undefined : -1}
			onClick={handleClick}
			aria-label={label ?? labels.label}
			className={cn(
				"fixed right-6 bottom-6 z-overlay rounded-full shadow-lg",
				"bg-foreground text-background hover:opacity-90 active:scale-95",
				"transition-all duration-300 ease-out motion-reduce:transition-none",
				visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
				className,
			)}
			{...props}>
			<ChevronUp className="size-5" />
		</Button>
	);
});
