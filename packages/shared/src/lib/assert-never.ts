/**
 * Exhaustiveness check for discriminated unions / enums (rules/00 → "The one
 * sanctioned use of `never`"). Call it in the `default` branch of a `switch`
 * over every case: adding a variant without handling it fails to COMPILE,
 * and a value that slips past the types at runtime fails loudly here.
 *
 * @param subject What was being switched over — named in the error message.
 */
export function assertNever(value: never, subject: string): never {
	throw new Error(`Unhandled ${subject}: ${JSON.stringify(value)}`);
}
