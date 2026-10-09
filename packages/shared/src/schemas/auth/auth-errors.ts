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
 * A locked account is deliberately NOT a distinct code: the login path answers
 * `INVALID_CREDENTIALS` (account-lockout.service), so a lockout cannot be used
 * to discover that an account exists. The lockout is announced by email.
 */
export const AuthErrorCodeSchema = z.enum([
	// ── Login / signup ────────────────────────────────────────────────────
	"INVALID_CREDENTIALS",
	"ADMIN_ACCESS_REQUIRED",
	"EMAIL_NOT_VERIFIED",
	// ── Access token ──────────────────────────────────────────────────────
	"ACCESS_TOKEN_MISSING",
	"ACCESS_TOKEN_INVALID",
	"ACCESS_TOKEN_EXPIRED",
	/** The access token's device session (`sid`) was revoked — signed out from the device list, logout or a revocation (ADR 034). */
	"SESSION_REVOKED",
	// ── Refresh token ─────────────────────────────────────────────────────
	"REFRESH_TOKEN_MISSING",
	"REFRESH_TOKEN_INVALID",
	"REFRESH_TOKEN_EXPIRED",
	/** The refresh token came through the wrong channel for the client type (a request body from a browser client type). */
	"REFRESH_TOKEN_TRANSPORT_MISMATCH",
	"TOKEN_THEFT_DETECTED",
	// ── Account state ─────────────────────────────────────────────────────
	"USER_NOT_FOUND",
	"ACCOUNT_IS_INACTIVE",
	"ACCOUNT_DELETED",
	// ── Authorization ─────────────────────────────────────────────────────
	"SUPER_ADMIN_REQUIRED",
]);

export type AuthErrorCode = z.output<typeof AuthErrorCodeSchema>;
