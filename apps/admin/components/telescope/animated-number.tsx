"use client";

// ============================================
// components/telescope/animated-number.tsx
// Improvement v2 — count-up stat values. Animates toward the target number
// whenever it changes (framer-motion spring), so the overview's live numbers
// tick instead of snapping. Dumb: target + optional format arrive via props.
// ============================================

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

export interface AnimatedNumberProps {
	readonly value: number;
	/** Optional formatter (e.g. thousands separators); defaults to the integer. */
	readonly format?: (value: number) => string;
}

/** Springs toward `value` and renders the eased, formatted result. */
export function AnimatedNumber({ value, format = (v: number): string => String(Math.round(v)) }: AnimatedNumberProps): React.JSX.Element {
	const spring = useSpring(value, { stiffness: 120, damping: 24, mass: 0.6 });
	const display = useTransform(spring, (current: number): string => format(current));

	useEffect((): void => {
		spring.set(value);
	}, [value, spring]);

	return <motion.span className="tabular-nums">{display}</motion.span>;
}
