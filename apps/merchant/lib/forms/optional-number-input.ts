import { z } from "zod";

/**
 * What react-hook-form hands `setValueAs`: the text of the field as typed, or
 * — on the first render — the form's default value, which for a number field
 * is already a number (an edited reward's saved minimum spend) or absent.
 */
const OptionalNumberFieldValueSchema = z.union([
	z.string().transform((text) => (text.trim().length === 0 ? undefined : Number(text))),
	z.number(),
	z.null().transform(() => undefined),
	z.undefined(),
]);

/**
 * Reads an optional `<input type="number">` for react-hook-form
 * (`register(name, { setValueAs: optionalNumberInput })`): an empty field is
 * "not given" (`undefined`), never `NaN` — `valueAsNumber` turns an empty
 * optional field into `NaN`, which then fails the schema's number rule. A
 * default value that is already a number is kept as it is.
 */
export function optionalNumberInput(value: string | number | null | undefined): number | undefined {
	const parsed = OptionalNumberFieldValueSchema.safeParse(value);
	return parsed.success ? parsed.data : Number.NaN;
}
