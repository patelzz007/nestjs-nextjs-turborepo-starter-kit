"use client";

import { useEffect, useState } from "react";

/**
 * Eases the displayed progress toward the polled value (the API jumps
 * 5 → ~60 → 92 → 100), so the bar glides instead of snapping.
 */
export function useEasedProgress(target: number): number {
	const [displayed, setDisplayed] = useState<number>(target);
	useEffect(() => {
		let raf: number | null = null;
		const tick = (): void => {
			setDisplayed((current) => {
				const diff: number = target - current;
				if (Math.abs(diff) < 0.75) return target;
				return current + diff * 0.15;
			});
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return (): void => {
			if (raf !== null) cancelAnimationFrame(raf);
		};
	}, [target]);
	return displayed;
}
