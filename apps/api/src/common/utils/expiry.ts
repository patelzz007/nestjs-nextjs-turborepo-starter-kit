/**
 * Parse an expiry duration string (e.g. "15m", "7d", "1h") into milliseconds.
 *
 * Supported suffixes:
 *  - `s` → seconds
 *  - `m` → minutes (default if no suffix)
 *  - `h` → hours
 *  - `d` → days
 *
 * @example parseExpiryToMilliseconds("15m") // 900000
 * @example parseExpiryToMilliseconds("7d")  // 604800000
 */
export const parseExpiryToMilliseconds = (expiry: string): number => {
	const groups: RegExpMatchArray | null = /^(\d+)([smhd])?$/.exec(expiry);
	if (groups === null) {
		throw new Error(`Invalid expiry format: "${expiry}". Expected format: <number><s|m|h|d> (e.g. "15m", "7d")`);
	}

	const valueStr: string = groups[1];
	const unit: string = typeof groups[2] === "string" ? groups[2] : "m";

	const value: number = Number.parseInt(valueStr, 10);

	switch (unit) {
		case "s":
			return value * 1_000;
		case "m":
			return value * 60_000;
		case "h":
			return value * 3_600_000;
		case "d":
			return value * 86_400_000;
		default:
			throw new Error(`Unknown expiry unit: "${unit}"`);
	}
};

/**
 * Parse an expiry duration string into seconds (for JWT `expiresIn`).
 * Delegates to parseExpiryToMilliseconds and divides by 1000.
 *
 * @example parseExpiryToSeconds("15m") // 900
 * @example parseExpiryToSeconds("7d")  // 604800
 */
export const parseExpiryToSeconds = (expiry: string): number => {
	return Math.round(parseExpiryToMilliseconds(expiry) / 1000);
};
