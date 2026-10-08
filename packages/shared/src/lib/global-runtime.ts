import { z } from "zod";

/**
 * Runtime / feature detection without the `typeof` operator (rules/28-runtime-validation.md).
 * Reads the global through `Reflect.get`, so accessor globals (`window`, `navigator`) and
 * test stubs (`vi.stubGlobal("BroadcastChannel", undefined)`) are both seen as they are.
 */

// Structural, not `instanceof`: jsdom / iframe globals come from another realm, whose
// `Object` / `Function` are different constructors, so `instanceof` would miss them.
const FUNCTION_SCHEMA = z.function();
const OBJECT_SCHEMA = z.union([z.object({}), FUNCTION_SCHEMA]);

/** `true` when `globalThis[name]` holds an object or function (e.g. `window`, `document`, `navigator`). */
export function hasGlobalValue(name: string): boolean {
	return OBJECT_SCHEMA.safeParse(Reflect.get(globalThis, name)).success;
}

/** `true` when `globalThis[name]` is a callable constructor (e.g. `BroadcastChannel`, `IntersectionObserver`). */
export function hasGlobalConstructor(name: string): boolean {
	return FUNCTION_SCHEMA.safeParse(Reflect.get(globalThis, name)).success;
}

/** `true` in a browser-like runtime (a DOM `window` and `document` exist); `false` during SSR / in Node. */
export function isBrowserRuntime(): boolean {
	return hasGlobalValue("window") && hasGlobalValue("document");
}
