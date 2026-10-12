/**
 * Reads an optional `<input type="number">` for react-hook-form
 * (`register(name, { setValueAs: optionalNumberInput })`): an empty field is
 * "not given" (`undefined`), never `NaN` — `valueAsNumber` turns an empty
 * optional field into `NaN`, which then fails the schema's number rule.
 */
export function optionalNumberInput(value: string): number | undefined {
	return value.trim().length === 0 ? undefined : Number(value);
}
