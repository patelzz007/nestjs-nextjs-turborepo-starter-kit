import * as crypto from "crypto";

import { Injectable } from "@nestjs/common";
import { BACKUP_CODE_CHARSET, BACKUP_CODE_COUNT, BACKUP_CODE_LENGTH } from "@workspace/shared";
import { generateSecret, generateURI, verifySync } from "otplib";

import type { AuthenticatorPort } from "../../application/ports/authenticator.port";
import type { TotpVerification } from "../../domain/aggregates/two-factor-enrollment.aggregate";

/** Allow ±1 TOTP period for clock skew between server and authenticator app. */
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

/** RFC 6238 period. */
const TOTP_PERIOD_SECONDS = 30;

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/** TOTP over `otplib` and the shared backup-code alphabet. */
@Injectable()
export class OtpAuthenticator implements AuthenticatorPort {
	public generateSecret(): string {
		return generateSecret();
	}

	public keyUri(input: { readonly issuer: string; readonly label: string; readonly secret: string }): string {
		return generateURI({ issuer: input.issuer, label: input.label, secret: input.secret });
	}

	public verify(token: string, secret: string, afterTimeStep: number | null): TotpVerification {
		const verification = verifySync({
			token,
			secret,
			epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
			// Replay protection only applies once a step has been consumed.
			...(afterTimeStep === null ? {} : { afterTimeStep }),
		});
		if (!verification.valid) {
			return { valid: false };
		}
		const currentTimeStep: number = Math.floor(Math.floor(Date.now() / MS_PER_SECOND) / TOTP_PERIOD_SECONDS);
		return { valid: true, timeStep: currentTimeStep + verification.delta };
	}

	public generateBackupCodes(): string[] {
		const codes: string[] = [];
		for (let index = 0; index < BACKUP_CODE_COUNT; index += 1) {
			const chars: string[] = [];
			for (let position = 0; position < BACKUP_CODE_LENGTH; position += 1) {
				chars.push(BACKUP_CODE_CHARSET.charAt(crypto.randomInt(0, BACKUP_CODE_CHARSET.length)));
			}
			codes.push(chars.join(""));
		}
		return codes;
	}
}
