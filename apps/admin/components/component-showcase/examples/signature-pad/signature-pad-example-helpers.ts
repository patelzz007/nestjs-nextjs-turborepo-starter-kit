// Small helpers shared by the Signature Pad examples.

/** Bytes in a kilobyte, for the "12.3 KB" size readouts. */
const BYTES_PER_KILOBYTE = 1024;
/** Decimal places shown in a kilobyte readout. */
const KILOBYTE_DECIMALS = 1;

/** A byte count as kilobytes with one decimal ("12.3 KB"). */
export function formatKilobytes(bytes: number): string {
	return `${(bytes / BYTES_PER_KILOBYTE).toFixed(KILOBYTE_DECIMALS)} KB`;
}

/** The size, in bytes, of a string once encoded (a data URL, an SVG, JSON). */
export function encodedSize(value: string): number {
	return new Blob([value]).size;
}

/**
 * A ref callback that focuses the element as it mounts — used for the status
 * line that replaces the button a person just pressed, so focus is not lost.
 */
export function focusOnMount(node: HTMLElement | null): void {
	node?.focus();
}
