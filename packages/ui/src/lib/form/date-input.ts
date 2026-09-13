import { format, isValid, parse } from "date-fns";
import { z } from "zod";

/** `yyyy-MM-dd` date string used by form pickers and API date boundaries. */
export const DateInputStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type DateInputString = z.output<typeof DateInputStringSchema>;

/** Parse a `yyyy-MM-dd` string into a local calendar date. */
export function parseDateInputString(value: string): Date | undefined {
	const parsed = DateInputStringSchema.safeParse(value);
	if (!parsed.success) {
		return undefined;
	}
	const date = parse(parsed.data, "yyyy-MM-dd", new Date());
	return isValid(date) ? date : undefined;
}

/** Format a calendar date as `yyyy-MM-dd`. */
export function formatDateInputString(date: Date): DateInputString {
	return DateInputStringSchema.parse(format(date, "yyyy-MM-dd"));
}
