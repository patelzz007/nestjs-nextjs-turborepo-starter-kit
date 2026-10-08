"use client";

import * as React from "react";
import { z } from "zod";

/** The current page's row in a panel sidebar (`PanelSidebarNavItem` marks it). */
const ACTIVE_NAV_ITEM_SELECTOR = '[aria-current="page"]';

/** An element whose DOM implements the Web Animations API (jsdom and older engines do not). */
const AnimatableElementSchema = z.object({ getAnimations: z.instanceof(Function) });

/** Every CSS transition/animation running inside `container` once pending style changes apply. */
function runningAnimations(container: HTMLElement): readonly Animation[] {
	return AnimatableElementSchema.safeParse(container).success ? container.getAnimations({ subtree: true }) : [];
}

/**
 * Settles once every given transition has finished or been cancelled (a
 * cancelled transition rejects `finished`; it still no longer moves layout).
 */
export async function transitionsSettled<TFinished>(transitions: readonly { readonly finished: Promise<TFinished> }[]): Promise<void> {
	await Promise.allSettled(transitions.map((transition) => transition.finished));
}

function scrollActiveItemIntoView(container: HTMLElement): void {
	const activeElement = container.querySelector<HTMLElement>(ACTIVE_NAV_ITEM_SELECTOR);
	if (activeElement === null || container.scrollHeight <= container.clientHeight) {
		return;
	}
	const containerRect = container.getBoundingClientRect();
	const elementRect = activeElement.getBoundingClientRect();
	if (elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom) {
		return;
	}
	const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	activeElement.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion ? "auto" : "smooth" });
}

/**
 * After every navigation (`navigationKey` changes), scrolls the sidebar so
 * the current page's row is visible. Branches open and close with a CSS
 * height transition, and measuring mid-transition scrolls to the wrong place,
 * so it waits for every transition running in the sidebar to FINISH (the Web
 * Animations API covers CSS transitions) instead of guessing their duration
 * with a timer. Without running transitions it scrolls straight away.
 */
export function useScrollActiveNavItem(containerRef: React.RefObject<HTMLElement | null>, navigationKey: string): void {
	React.useEffect((): (() => void) | undefined => {
		const container = containerRef.current;
		if (container === null) {
			return undefined;
		}
		let isCancelled = false;
		void transitionsSettled(runningAnimations(container)).then((): void => {
			if (!isCancelled) {
				scrollActiveItemIntoView(container);
			}
		});
		return (): void => {
			isCancelled = true;
		};
	}, [containerRef, navigationKey]);
}
