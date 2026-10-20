"use client";

import { LazyMotion, type domAnimation } from "framer-motion";
import * as React from "react";

/** framer-motion's DOM animation features (animate, exit, gestures — no layout animations), fetched on first use. */
export function loadDomAnimation(): Promise<typeof domAnimation> {
	return import("framer-motion").then((module) => module.domAnimation);
}

/**
 * The animation features for the `m.*` components inside, loaded lazily so they stay out of the first
 * bundle (plan §19.4). `strict`: a leftover `motion.*` component throws in development, so the full
 * bundle cannot slip back in. Same props, same timing, same visuals as `motion.*`.
 */
export function LazyMotionProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<LazyMotion features={loadDomAnimation} strict>
			{children}
		</LazyMotion>
	);
}
