// ── Experiment statistics (ADR 087) ──────────────────────────────────────────────────────────────
// Each subject contributes one number per metric (how many times it happened while the experiment ran). A variant's
// mean is compared with the control's by Welch's difference of means and its 95% confidence interval (normal
// approximation): significant when the interval excludes zero. Sequential testing and CUPED come later.

/** z for a two-sided 95% interval. */
export const Z_95 = 1.959_963_984_540_054;
/** Fewer subjects than this in either arm leave the comparison open (no variance to speak of). */
export const MIN_SUBJECTS_PER_ARM = 2;
const NO_VALUE = 0;
const ONE = 1;

/** One variant's sums for one metric: its subjects, the sum of their counts and of their squares. */
export interface VariantSums {
	readonly valueName: string;
	readonly subjects: number;
	readonly total: number;
	readonly totalSquares: number;
}

export interface VariantComparison {
	readonly valueName: string;
	readonly subjects: number;
	readonly mean: number;
	readonly delta: number | null;
	readonly ciLow: number | null;
	readonly ciHigh: number | null;
	readonly significant: boolean;
}

function meanOf(sums: VariantSums): number {
	return sums.subjects === NO_VALUE ? NO_VALUE : sums.total / sums.subjects;
}

/** The sample variance (n − 1), or null with fewer than two subjects. */
export function sampleVariance(sums: VariantSums): number | null {
	if (sums.subjects < MIN_SUBJECTS_PER_ARM) {
		return null;
	}
	const mean = meanOf(sums);
	return Math.max(NO_VALUE, (sums.totalSquares - sums.subjects * mean * mean) / (sums.subjects - ONE));
}

/** Every variant's mean, and each non-control variant's difference from the control with its 95% interval. */
export function compareVariants(controlValueName: string, variants: readonly VariantSums[]): readonly VariantComparison[] {
	const control = variants.find((variant) => variant.valueName === controlValueName) ?? null;
	const controlVariance = control === null ? null : sampleVariance(control);
	return variants.map((variant): VariantComparison => {
		const mean = meanOf(variant);
		const base = { valueName: variant.valueName, subjects: variant.subjects, mean };
		const variance = sampleVariance(variant);
		if (control === null || variant.valueName === controlValueName || variance === null || controlVariance === null) {
			return { ...base, delta: null, ciLow: null, ciHigh: null, significant: false };
		}
		const delta = mean - meanOf(control);
		const halfWidth = Z_95 * Math.sqrt(variance / variant.subjects + controlVariance / control.subjects);
		const ciLow = delta - halfWidth;
		const ciHigh = delta + halfWidth;
		return { ...base, delta, ciLow, ciHigh, significant: ciLow > NO_VALUE || ciHigh < NO_VALUE };
	});
}
