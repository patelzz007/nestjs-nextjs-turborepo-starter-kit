// Route params are untrusted input (a deep link can carry anything): every
// screen reads them through a zod schema (rules/04, §9.6).

import { useLocalSearchParams } from "expo-router";
import type { z } from "zod";

/** The screen's params parsed with `schema`, or `null` when they do not match it. */
export function useRouteParams<TParams>(schema: z.ZodType<TParams>): TParams | null {
	return schema.safeParse(useLocalSearchParams()).data ?? null;
}
