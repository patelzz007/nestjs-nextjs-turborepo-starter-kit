import { z } from "zod";

/**
 * Result of a cookie set/clear operation in the API `CookieService`.
 * `error` carries an `Error` instance (not JSON-serializable) — validated
 * with `instanceof` because it is never parsed from external input.
 */
export const CookieResultSchema = z.object({
	success: z.boolean(),
	error: z.custom<Error>((value): value is Error => value instanceof Error).optional(),
});

export type CookieResult = z.output<typeof CookieResultSchema>;

/** Supported httpOnly auth cookie names. */
export const CookieNamesSchema = z.enum(["accessToken", "refreshToken", "adminAccessToken", "adminRefreshToken"]);

export type CookieNames = z.output<typeof CookieNamesSchema>;

/** Login response fields stripped into httpOnly cookies by the API interceptor.
 *  Not `.strict()` — login/refresh bodies include `user` / `message` alongside tokens. */
export const LoginTokenFieldsSchema = z.object({
	accessToken: z.string().min(1).optional(),
	refreshToken: z.string().min(1).optional(),
});

export type LoginTokenFields = z.output<typeof LoginTokenFieldsSchema>;
