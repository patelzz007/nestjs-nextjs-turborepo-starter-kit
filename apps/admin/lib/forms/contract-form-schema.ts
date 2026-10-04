// ============================================
// lib/forms/contract-form-schema.ts - form inputs → shared API contracts
// ============================================
// HTML inputs hold strings; the API contracts hold numbers, nulls and
// optional fields. A form schema CONVERTS the raw input (the converters
// below), then validates the converted value with the shared contract via
// `contractFormSchema`, so the browser and the API validate with the same
// rules and the contract's issues land on the same field paths.

import { z } from "zod";

/** Text input → trimmed text, or `null` when left blank (nullable optional columns). */
export const NullableTextInputSchema = z.string().transform((value: string): string | null => {
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
});

/** Text input → trimmed text, or absent (`undefined`) when left blank (optional fields). */
export const OptionalTextInputSchema = z.string().transform((value: string): string | undefined => {
	const trimmed = value.trim();
	return trimmed.length === 0 ? undefined : trimmed;
});

/** Text input → number; blank is reported as missing, not read as `0`. */
export const RequiredNumberInputSchema = z.string().trim().min(1, "Enter a number").transform(Number).pipe(z.number("Enter a number"));

/** Text input → number, or `null` when left blank. */
export const NullableNumberInputSchema = z
	.string()
	.trim()
	.transform((value: string): number | null => (value.length === 0 ? null : Number(value)))
	.pipe(z.number("Enter a number").nullable());

/** Text input → number, or absent (`undefined`) when left blank. */
export const OptionalNumberInputSchema = z
	.string()
	.trim()
	.transform((value: string): number | undefined => (value.length === 0 ? undefined : Number(value)))
	.pipe(z.number("Enter a number").optional());

/**
 * `converter` (raw form values → contract-shaped values), validated by the
 * shared `contract` and output as the contract's parse. Use it as the form's
 * TanStack Form validator and parse the submitted values with it.
 */
export function contractFormSchema<TRaw extends z.ZodType<object>, TOutput>(converter: TRaw, contract: z.ZodType<TOutput>): z.ZodType<TOutput, z.input<TRaw>> {
	return converter
		.superRefine((converted: object, context: z.RefinementCtx): void => {
			const result = contract.safeParse(converted);
			if (!result.success) {
				for (const issue of result.error.issues) {
					context.addIssue({ code: "custom", message: issue.message, path: issue.path });
				}
			}
		})
		.transform((converted: object): TOutput => contract.parse(converted));
}
