/**
 * How long a `pnpm ci:local` step took, as its summary prints it.
 */

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** Digits of the seconds after the minutes (`3m 05s`). */
const SECONDS_DIGITS = 2;

/**
 * `7.4s` under a minute, `3m 05s` from a minute on.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
	const totalSeconds = ms / MS_PER_SECOND;
	if (totalSeconds < SECONDS_PER_MINUTE) {
		return `${totalSeconds.toFixed(1)}s`;
	}
	const wholeSeconds = Math.round(totalSeconds);
	const minutes = Math.floor(wholeSeconds / SECONDS_PER_MINUTE);
	return `${String(minutes)}m ${String(wholeSeconds % SECONDS_PER_MINUTE).padStart(SECONDS_DIGITS, "0")}s`;
}
