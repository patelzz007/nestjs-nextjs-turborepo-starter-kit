import { z } from "zod";

/** Why a session is restricted to enrollment routes. */
export const EnrollmentReasonSchema = z.enum(["email_verification", "mfa_enrollment"]);

export type EnrollmentReason = z.output<typeof EnrollmentReasonSchema>;

/** Whether the current access token grants full app access or enrollment-only routes. */
export const SessionScopeSchema = z.enum(["full", "restricted"]);

export type SessionScope = z.output<typeof SessionScopeSchema>;
