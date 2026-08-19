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
export const VerifyEmailTokenParamSchema = z
	.string()
	.min(1, "Verification token is required")
	.max(512, "Verification token too long");

export type VerifyEmailTokenParam = z.output<typeof VerifyEmailTokenParamSchema>;

// ── Telescope Entity ID Param ─────────────────────────────────────────────

/**
 * Validates a Telescope entity ID param. Telescope IDs can be UUIDs or
 * other opaque identifiers, so we accept any non-empty string with a
 * reasonable length cap.
 */
export const TelescopeIdParamSchema = z
	.string()
	.min(1, "Telescope entity ID is required")
	.max(256, "Telescope entity ID too long");

export type TelescopeIdParam = z.output<typeof TelescopeIdParamSchema>;

// ── Telescope Schedule Name Param ─────────────────────────────────────────

/** Validates a Telescope schedule name param. */
export const TelescopeScheduleNameParamSchema = z
	.string()
	.min(1, "Schedule name is required")
	.max(128, "Schedule name too long");

export type TelescopeScheduleNameParam = z.output<typeof TelescopeScheduleNameParamSchema>;

// ── Email Template Key Param ──────────────────────────────────────────────

/** Validates an email template key param — must match a registered template. */
export const EmailTemplateKeyParamSchema = EmailTemplateKeySchema;

export type EmailTemplateKeyParam = z.output<typeof EmailTemplateKeyParamSchema>;
