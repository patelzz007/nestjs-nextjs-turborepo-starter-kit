import { z } from "zod";

/**
 * Two facts an audit record keeps beyond the error code and the payloads
 * (docs/adr/025-global-http-audit-log.md, "Debugging detail"): every request
 * header as the client sent it, and the real cause of a failure. Both are
 * built by the API within these bounds, so a stored value always parses.
 */

// ── Request headers ─────────────────────────────────────────────────────────

/** Headers kept per record; a request with more keeps the first ones, by name. */
export const AUDIT_REQUEST_HEADERS_MAX_COUNT = 64;
/** Longest header name kept. */
export const AUDIT_REQUEST_HEADER_NAME_MAX_LENGTH = 128;
/** Longest header value kept; a longer one is cut and ends with {@link AUDIT_TRUNCATION_MARK}. */
export const AUDIT_REQUEST_HEADER_VALUE_MAX_LENGTH = 1_024;
/** Ends a value that was cut to its budget. */
export const AUDIT_TRUNCATION_MARK = "…";

/**
 * Every request header, lower-cased name → value (repeated headers joined
 * with `, `). Credentials are `[REDACTED]`; a cookie header keeps the cookie
 * NAMES only. What the client sent, unverified — evidence, not a decision.
 */
export const AuditRequestHeadersSchema = z.record(z.string().min(1).max(AUDIT_REQUEST_HEADER_NAME_MAX_LENGTH), z.string().max(AUDIT_REQUEST_HEADER_VALUE_MAX_LENGTH));
export type AuditRequestHeaders = z.output<typeof AuditRequestHeadersSchema>;

// ── Error detail ────────────────────────────────────────────────────────────

/** Longest error type name kept (`PrismaClientKnownRequestError`). */
export const AUDIT_ERROR_TYPE_MAX_LENGTH = 128;
/** Longest error message kept. */
export const AUDIT_ERROR_MESSAGE_MAX_LENGTH = 2_048;
/** Longest machine code kept (`P2025`, `ECONNREFUSED`). */
export const AUDIT_ERROR_DETAIL_CODE_MAX_LENGTH = 64;
/** `cause` links followed below the error itself. */
export const AUDIT_ERROR_CAUSES_MAX_COUNT = 5;
/** Stack frames kept (5xx only — a 4xx is the caller's mistake, not a code path to debug). */
export const AUDIT_ERROR_STACK_MAX_FRAMES = 12;
/** Longest stack frame kept. */
export const AUDIT_ERROR_STACK_FRAME_MAX_LENGTH = 512;

/** One error in a cause chain: what it is and what it said. */
export const AuditErrorLinkSchema = z.object({
	/** The error's class (`TypeError`, `PrismaClientKnownRequestError`, `UnauthorizedException`). */
	type: z.string().min(1).max(AUDIT_ERROR_TYPE_MAX_LENGTH),
	/** Its own message — the developer-facing reason, personal data masked. */
	message: z.string().max(AUDIT_ERROR_MESSAGE_MAX_LENGTH),
	/** A machine code the error carried (`P2025`, `ECONNREFUSED`, a domain code). */
	code: z.string().min(1).max(AUDIT_ERROR_DETAIL_CODE_MAX_LENGTH).nullable(),
});
export type AuditErrorLink = z.output<typeof AuditErrorLinkSchema>;

/**
 * Why a request or system command failed, as the server saw it — the
 * exception behind the error code the caller was shown. Never sent to the
 * caller; kept for whoever investigates.
 */
export const AuditErrorDetailSchema = AuditErrorLinkSchema.extend({
	/** The `cause` chain, outermost first. */
	causes: z.array(AuditErrorLinkSchema).max(AUDIT_ERROR_CAUSES_MAX_COUNT),
	/** Where it was thrown (`at Handler.execute (src/…/handler.ts:42:13)`), 5xx only. */
	stack: z.array(z.string().min(1).max(AUDIT_ERROR_STACK_FRAME_MAX_LENGTH)).max(AUDIT_ERROR_STACK_MAX_FRAMES),
});
export type AuditErrorDetail = z.output<typeof AuditErrorDetailSchema>;
