import { z } from "zod";

/**
 * Longest email address the platform stores — matches the `VARCHAR(100)`
 * email columns (`users.email`, `organization_invitations.email`), so an
 * over-long address is a 400 at the boundary, never a database error.
 */
export const EMAIL_ADDRESS_MAX_LENGTH = 100;

/**
 * THE email rule for every input that identifies an account or an invitee
 * (sign-up, login, password reset, verification resend, team and merchant
 * invites, staff creation): a valid address, bounded, then canonicalised to
 * lower case. Addresses are treated as case-insensitive everywhere, and the
 * database stores (and uniquely indexes) only this canonical form — so
 * `Alice@Example.com` and `alice@example.com` are the same account and the
 * same pending invite.
 *
 * Surrounding whitespace is rejected rather than silently trimmed (the format
 * check runs on the raw value).
 */
export function canonicalEmailSchema(message?: string): z.ZodEmail {
	return z.email(message).max(EMAIL_ADDRESS_MAX_LENGTH).toLowerCase();
}

/** {@link canonicalEmailSchema} with the default message. */
export const CanonicalEmailSchema: z.ZodEmail = canonicalEmailSchema();

export type CanonicalEmail = z.output<typeof CanonicalEmailSchema>;
