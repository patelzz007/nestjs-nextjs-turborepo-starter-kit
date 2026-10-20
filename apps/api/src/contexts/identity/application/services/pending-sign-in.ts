import { SessionSignInMethodSchema, type SessionSignInMethod } from "@workspace/shared";
import type { z } from "zod";

import type { SessionDeviceContext } from "../../domain/value-objects/session-device.value-object";

/** `LOGIN_VERIFICATION_MODE`: never, always, or only for an unrecognized device. */
export type LoginVerificationMode = "disabled" | "always" | "new-device";

/**
 * The proofs a login flow collected BEFORE login verification: the sign-in method of a session
 * issued right away. The emailed new-device code, when asked for, upgrades it.
 */
export const PendingSignInMethodSchema = SessionSignInMethodSchema.extract(["PASSWORD", "PASSWORD_TOTP", "PASSWORD_BACKUP_CODE", "TEAM_INVITE_REGISTRATION"]);

export type PendingSignInMethod = z.output<typeof PendingSignInMethodSchema>;

/** The sign-in method of a session issued after the emailed new-device code. */
export const SIGN_IN_METHOD_WITH_NEW_DEVICE_CODE: Readonly<Record<PendingSignInMethod, SessionSignInMethod>> = {
	PASSWORD: "PASSWORD_NEW_DEVICE_CODE",
	PASSWORD_TOTP: "PASSWORD_TOTP_NEW_DEVICE_CODE",
	PASSWORD_BACKUP_CODE: "PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE",
	TEAM_INVITE_REGISTRATION: "TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE",
};

/** A login that passed every credential step and may now receive a session (after login verification, if required). */
export interface PendingLoginContext {
	readonly userId: string;
	readonly clientType: string | null;
	/** The User-Agent of the request that started the login (new-device recognition, the verification email). */
	readonly deviceInfo: string | null;
	/** The IP of the request that started the login (the verification email). */
	readonly ipAddress: string | null;
	readonly signInMethod: PendingSignInMethod;
	/** The request continuing the login: the device a session issued now is stored for. */
	readonly device: SessionDeviceContext;
	readonly mfaAssured?: boolean;
}
