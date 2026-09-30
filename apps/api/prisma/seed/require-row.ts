/** Returns a seed lookup result, failing loudly when the expected row is missing. */
export function requireRow<T>(value: T | undefined, label: string): T {
	if (value === undefined) {
		throw new Error(`Seed row not found: ${label}`);
	}
	return value;
}
