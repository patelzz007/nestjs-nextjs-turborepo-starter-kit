import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";

import { EpochMsSchema } from "@workspace/shared";

import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import type { MerchantPosContext } from "../types/merchant-pos-context";

const MINUTE_MS = 60_000;

/** Unknown backup codes are counted per API key over this window. */
export const POS_CODE_FAILURE_WINDOW_MS = 15 * MINUTE_MS;

/**
 * Unknown backup codes one key may present per window before it is locked.
 * A cashier mistyping a code a few times stays well below; a script guessing
 * 8-character codes is stopped after this many guesses.
 */
export const POS_CODE_MAX_FAILURES = 10;

/** How long a key that hit {@link POS_CODE_MAX_FAILURES} stays locked for code redemption. */
export const POS_CODE_LOCKOUT_MS = 60 * MINUTE_MS;

/** The API key is locked for code redemption (too many unknown backup codes). */
export function posCodeLockedException(lockedUntil: number): HttpException {
	return new HttpException(
		{
			message: "Too many invalid backup codes from this API key. Redemption with this key is paused.",
			error: "POS_CODE_LOCKED",
			lockedUntil: EpochMsSchema.parse(lockedUntil),
		},
		HttpStatus.TOO_MANY_REQUESTS,
	);
}

/**
 * Brute-force protection for 8-character backup codes.
 *
 * A wrong backup code matches no claim, so failures cannot be counted on a
 * claim — they are counted on the API key that presented them (one key = one
 * till for paired keys). Lookups are scoped to the calling merchant, so a
 * guess can only ever hit that merchant's own codes, and every unknown code in
 * a checkout counts (a 10-code checkout is 10 guesses). Successful lookups
 * never reset the counter: interleaving one valid code must not buy more guesses.
 */
@Injectable()
export class PosCodeLockoutService {
	private readonly logger: Logger = new Logger(PosCodeLockoutService.name);

	public constructor(
		private readonly apiKeyRepository: MerchantApiKeyRepository,
		private readonly auditLogRepository: RewardAuditLogRepository,
	) {}

	/** @throws HttpException 429 `POS_CODE_LOCKED` while the key is locked. */
	public async assertNotLocked(pos: MerchantPosContext, now: number): Promise<void> {
		const lockedUntil = await this.apiKeyRepository.findCodeLockedUntil(pos.apiKeyId);
		if (lockedUntil !== null && Number(lockedUntil) > now) {
			throw posCodeLockedException(Number(lockedUntil));
		}
	}

	/**
	 * Records `unknownBackupCodes` failed guesses for the key (audited), and
	 * locks the key once the window's total reaches {@link POS_CODE_MAX_FAILURES}.
	 * Returns the lock expiry when the key is now locked, else `null`.
	 */
	public async recordUnknownBackupCodes(pos: MerchantPosContext, unknownBackupCodes: number, now: number): Promise<number | null> {
		if (unknownBackupCodes === 0) {
			return null;
		}
		const failuresInWindow = await this.apiKeyRepository.addCodeFailures(pos.apiKeyId, unknownBackupCodes, now, POS_CODE_FAILURE_WINDOW_MS);
		await this.auditLogRepository.create({
			organizationId: pos.organizationId,
			action: "pos.backup_code_rejected",
			metadata: { apiKeyId: pos.apiKeyId, terminalId: pos.terminalId, locationId: pos.locationId, unknownBackupCodes, failuresInWindow },
		});
		if (failuresInWindow < POS_CODE_MAX_FAILURES) {
			return null;
		}

		const lockedUntil = now + POS_CODE_LOCKOUT_MS;
		if (await this.apiKeyRepository.lockCodeRedemption(pos.apiKeyId, now, lockedUntil)) {
			await this.auditLogRepository.create({
				organizationId: pos.organizationId,
				action: "pos.api_key_code_locked",
				metadata: { apiKeyId: pos.apiKeyId, terminalId: pos.terminalId, locationId: pos.locationId, failuresInWindow, lockedUntil },
			});
			this.logger.warn({
				event: "pos.api_key_code_locked",
				organizationId: pos.organizationId,
				apiKeyId: pos.apiKeyId,
				terminalId: pos.terminalId,
				failuresInWindow,
				lockedUntil,
			});
		}
		return lockedUntil;
	}
}
