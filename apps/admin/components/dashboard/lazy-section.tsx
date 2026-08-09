"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

export interface LazySectionProps {
	/** Reserved height while hidden (prevents layout shift, e.g. `h-40`). */
	readonly height: string;
	/** The section content — only mounted once the section nears the viewport. */
	readonly children: React.ReactNode;
	/**
	 * How far (px) past the viewport edge to pre-load. A positive value means
	 * the section starts loading *before* it's actually visible, so by the time
	 * the user scrolls there it's usually already rendered.
	 */
	readonly rootMargin?: string;
}

/**
 * Viewport-triggered mounting for below-the-fold sections.
 *
 * Renders a fixed-height skeleton until an `IntersectionObserver` reports the
 * wrapper is near the viewport (default: within 300px), then mounts `children`
 * with a fade + slide-up reveal animation. Once revealed it stays mounted (no
 * unmount-on-scroll-away), so scrolling back up never re-triggers a load.
 *
 * This sits OUTSIDE the `next/dynamic` boundary: the heavy chunk for the
 * section still only downloads/parses when the dynamic component is first
 * rendered — i.e. when this section actually scrolls into view — instead of
 * during hydration.
 *
 * SSR/hydration: `visible` starts false on both server and client, so the
 * skeleton output never mismatches.
 *
 * ⚠️ Constraint: IntersectionObserver only reports elements that are *visible*
 * in the scroll path. Do NOT wrap a `LazySection` inside a `display: none`
 * container (closed tab/accordion) — it would never trigger until shown.
 */
export function LazySection({ height, children, rootMargin = "300px 0px" }: LazySectionProps): React.JSX.Element {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [visible, setVisible] = React.useState(false);

	React.useEffect(() => {
		const node = containerRef.current;
		if (node === null || visible) {
			return undefined;
		}

		// Ancient-browser fallback — load immediately (async via rAF so the
		// state update never runs synchronously inside the effect).
		if (typeof IntersectionObserver === "undefined") {
			const frame = window.requestAnimationFrame(() => {
				setVisible(true);
			});
			return (): void => {
				window.cancelAnimationFrame(frame);
			};
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setVisible(true);
						observer.disconnect();
						break;
					}
				}
			},
			{ rootMargin },
		);
		observer.observe(node);
		return (): void => {
			observer.disconnect();
		};
	}, [visible, rootMargin]);

	return (
		<div ref={containerRef} className={visible ? undefined : cn(height, "animate-pulse rounded-lg border bg-card")}>
			{visible ? <div className="animate-in duration-300 fill-mode-both fade-in slide-in-from-bottom-2">{children}</div> : null}
		</div>
	);
}
