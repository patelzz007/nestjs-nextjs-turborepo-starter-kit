/**
 * OpenAPI wording shared by every route whose response delivers session
 * tokens through `SetAuthCookiesInterceptor` (login, login verification, 2FA
 * completion, refresh): how the tokens reach each client type (ADR 029).
 */
export const TOKEN_DELIVERY_DESCRIPTION =
	" — browser client types: tokens set as httpOnly cookies, never in the body; client type mobile: tokens returned in the body with tokenTransport: body";
