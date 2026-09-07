import { z } from "zod";

/** Parses optional boolean list-filter query params (`true` / `false` strings or booleans). */
export const BooleanQueryParamSchema = z.union([z.boolean(), z.enum(["true", "false"])]).optional();

export type BooleanQueryParam = z.output<typeof BooleanQueryParamSchema>;
