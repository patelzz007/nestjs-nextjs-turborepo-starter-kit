import { z, type ZodObject, type ZodType } from "zod";

/**
 * Pull a single path-param validator out of a contract leaf's input object.
 * Keeps `@Param()` pipes aligned with `apiContract.*.input` without duplicating
 * the field schema in the controller.
 */
export function contractPathParam<Shape extends Record<string, ZodType>, K extends keyof Shape & string>(input: ZodObject<Shape>, key: K): Shape[K] {
	return input.shape[key];
}
