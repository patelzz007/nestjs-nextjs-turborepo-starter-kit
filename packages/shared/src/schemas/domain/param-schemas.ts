import { z } from "zod";

import { EmailTemplateKeySchema } from "../email/email";

/**
 * Shared Zod param validation schemas for route parameters.
 *
 * These schemas are used by `ZodValidationPipe` at the HTTP boundary to
 * validate `@Param()` values — ensuring that UUIDs, tokens, and IDs are
 * well-formed before they reach the controller logic.
 *
 * The single source of truth for param validation: the client router and the
 * NestJS API both import from here, so param contracts can never drift.
 */

// ── UUID Param ────────────────────────────────────────────────────────────

/** Validates a UUID v4 route param (e.g. `:userId`, `:id`). */
export const UuidParamSchema = z.string().uuid("Invalid UUID format");

export type UuidParam = z.output<typeof UuidParamSchema>;

// ── Email Verification Token Param ────────────────────────────────────────

/** Validates an email verification token param (non-empty string). */
export const VerifyEmailTokenParamSchema = z.string().min(1, "Verification token is required");

export type VerifyEmailTokenParam = z.output<typeof VerifyEmailTokenParamSchema>;

// ── Email Template Key Param ──────────────────────────────────────────────

/** Validates an email template key param — must match a registered template. */
export const EmailTemplateKeyParamSchema = EmailTemplateKeySchema;

export type EmailTemplateKeyParam = z.output<typeof EmailTemplateKeyParamSchema>;
