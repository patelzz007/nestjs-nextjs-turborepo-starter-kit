"use client";

import { m, useReducedMotion } from "framer-motion";
import * as React from "react";

import { SIDEBAR_NO_MOTION, SIDEBAR_PROGRESS_COLLAPSED, SIDEBAR_PROGRESS_OPEN, SIDEBAR_PROGRESS_PROPERTY, SIDEBAR_SPRING } from "@workspace/ui/lib/sidebar/motion";

import { LazyMotionProvider } from "@workspace/ui/components/lazy-motion";

import { useReportLayoutTransition } from "./layout-transition";

/** framer-motion's lazy `div` (its features come from the LazyMotionProvider around it). */
const MotionDiv = m.div;

export interface SidebarProgressProps {
	/** Whether the desktop sidebar is open: the spring's target. */
	readonly isOpen: boolean;
	readonly children: React.ReactNode;
}

/**
 * The shell's motion (`SidebarProvider` renders it around everything in the
 * shell): animates `--sidebar-progress` — 0 collapsed, 1 open — on one
 * critically damped spring (lib/sidebar/motion.ts). Everything that moves with
 * the sidebar is a CSS expression of that one value (styles/components.css):
 * the gap the sidebar reserves, its slide, and the page column's width — so
 * they can never drift apart.
 *
 * `display: contents`: it adds no box, so the shell's flex row and its
 * `peer` / `group` selectors are unaffected, yet everything inside inherits
 * the value. It reports a layout transition from the moment the target
 * changes (before the first frame is painted) until the spring settles, so
 * size-dependent content (charts) holds still while it runs. No animation on
 * first paint; under "reduce motion" it jumps.
 */
export function SidebarProgress({ isOpen, children }: SidebarProgressProps): React.JSX.Element {
	const prefersReducedMotion = useReducedMotion() === true;
	const reportLayoutTransition = useReportLayoutTransition();
	// Compared with the last target, not a first-render flag, so StrictMode's effect re-run never reports one.
	const lastTarget = React.useRef(isOpen);
	React.useLayoutEffect((): void => {
		if (lastTarget.current !== isOpen) {
			lastTarget.current = isOpen;
			reportLayoutTransition(true);
		}
	}, [isOpen, reportLayoutTransition]);
	const handleAnimationComplete = React.useCallback((): void => {
		reportLayoutTransition(false);
	}, [reportLayoutTransition]);
	const target = React.useMemo(() => ({ [SIDEBAR_PROGRESS_PROPERTY]: isOpen ? SIDEBAR_PROGRESS_OPEN : SIDEBAR_PROGRESS_COLLAPSED }), [isOpen]);
	return (
		<LazyMotionProvider>
			<MotionDiv
				data-slot="sidebar-progress"
				className="contents"
				initial={false}
				animate={target}
				transition={prefersReducedMotion ? SIDEBAR_NO_MOTION : SIDEBAR_SPRING}
				onAnimationComplete={handleAnimationComplete}>
				{children}
			</MotionDiv>
		</LazyMotionProvider>
	);
}
