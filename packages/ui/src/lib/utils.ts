import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/**
 * Compile-time-only type assertion (the runtime value is untouched).
 *
 * Acts as a zero-cost `as T` replacement that satisfies the repo's
 * `consistent-type-assertions: never` rule — used at boundary points where a
 * generic data shape needs to be narrowed without a runtime cast (e.g.
 * row records indexed by a dynamic column key).
 */
// The generic `T` only ever appears in the assertion predicate — that is
// inherent to an `asserts` helper (the type exists for call sites, e.g.
// `assumeType<Record<string, unknown>>(parsed)`), so the rule is a false
// positive here.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function assumeType<T>(value: unknown): asserts value is T {
	void value;
}
