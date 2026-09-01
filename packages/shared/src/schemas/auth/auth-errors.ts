import { z } from "zod";

/**
 * Canonical authentication error codes emitted by the API.
 *
 * Every `UnauthorizedException` / `ForbiddenException` in the auth surface
 * carries one of these in its `error` field (see the guards, token service,
 * and auth service). Keeping the enum here means the backend and both frontends
 * agree on the exact set of codes — the client maps each code to a friendly,
 * i18n-ready message instead of surfacing raw server strings.
 *
 * `ACCOUNT_LOCKED` and `INVALID_CREDENTIALS` are emitted by the login path
 * (auth.service) with structured lockout fields — see `ErrorResponseSchema`.
 */
export const AuthErrorCodeSchema = z.enum([
	// ── Login / signup ────────────────────────────────────────────────────
	"INVALID_CREDENTIALS",
	"ACCOUNT_LOCKED",
	"ADMIN_ACCESS_REQUIRED",
	"EMAIL_NOT_VERIFIED",
	// ── Access token ──────────────────────────────────────────────────────
	"ACCESS_TOKEN_MISSING",
	"ACCESS_TOKEN_INVALID",
	"ACCESS_TOKEN_EXPIRED",
	// ── Refresh token ─────────────────────────────────────────────────────
	"REFRESH_TOKEN_MISSING",
	"REFRESH_TOKEN_INVALID",
	"REFRESH_TOKEN_EXPIRED",
	"TOKEN_THEFT_DETECTED",
	// ── Account state ─────────────────────────────────────────────────────
	"USER_NOT_FOUND",
	"ACCOUNT_IS_INACTIVE",
	"ACCOUNT_DELETED",
	// ── Authorization ─────────────────────────────────────────────────────
	"SUPER_ADMIN_REQUIRED",
]);

export type AuthErrorCode = z.output<typeof AuthErrorCodeSchema>;

/**
 * The subset of auth error codes that carry a structured lockout payload.
 * `ACCOUNT_LOCKED` responses include `lockedUntil` and `remainingSeconds` so
 * the client can render a live "retry in MM:SS" countdown.
 */
export const LockedErrorCodeSchema = z.literal("ACCOUNT_LOCKED");
export type LockedErrorCode = z.output<typeof LockedErrorCodeSchema>;
