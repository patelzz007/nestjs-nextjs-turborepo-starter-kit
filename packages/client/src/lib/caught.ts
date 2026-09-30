// ============================================
// lib/caught.ts - Typed promise rejection handling
// ============================================
// `.catch()` hands its callback an untyped rejection reason. `catchCaught`
// awaits the promise instead and parses any rejection through the shared
// `CaughtValueSchema`, so handlers receive a typed `CaughtValue`.

import { CaughtValueSchema, type CaughtValue } from "@workspace/shared";

/**
 * Awaits `promise`; on rejection, parses the reason into a `CaughtValue`
 * (non-serializable reasons become `undefined`) and resolves with `onError`'s result.
 * Equivalent to `promise.catch(onError)` with a typed error argument.
 */
export async function catchCaught<T>(promise: Promise<T>, onError: (error: CaughtValue) => T): Promise<T> {
	try {
		return await promise;
	} catch (error) {
		const caught = CaughtValueSchema.safeParse(error);
		return onError(caught.success ? caught.data : undefined);
	}
}
