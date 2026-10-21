import { Injectable, Logger } from "@nestjs/common";
import type { EpochMs, RedemptionCode } from "@workspace/shared";

import type { ClaimRedemptionLookup } from "../../../claims/public-api";
import type { CheckoutPoint, PresentedClaim, RedemptionMethod } from "../../domain/aggregates/reward-sale.aggregate";
import { assertCodeRedemptionUnlocked, lockoutAfter, POS_CODE_FAILURE_WINDOW_MS } from "../../domain/policies/code-lockout.policy";
import type { RedeemableClaim } from "../../domain/policies/redemption-eligibility.policy";
import type { PosScope } from "../pos-scope";

/** One presented code, resolved to one of the calling merchant's claims. */
export interface ResolvedCode extends PresentedClaim {
	readonly lookup: ClaimRedemptionLookup;
}

/**
 * How resolving the presented codes ended. `locked` and `not_found` are answered only AFTER the
 * transaction committed, so the unknown backup codes they counted stay counted.
 */
export type CodeResolution =
	{ readonly kind: "resolved"; readonly codes: readonly ResolvedCode[] } | { readonly kind: "locked"; readonly lockedUntil: EpochMs } | { readonly kind: "not_found" };

function methodOf(code: RedemptionCode): RedemptionMethod {
	return code.backupCode !== undefined ? "MANUAL" : "SCAN";
}

/** The claim and reward facts the sale's eligibility rules read; `customerBanned` is the merchant's ban on the claim's customer. */
export function toRedeemableClaim(lookup: ClaimRedemptionLookup, customerBanned: boolean): RedeemableClaim {
	const { claim, reward } = lookup;
	return {
		customerBanned,
		claimId: claim.id,
		customerUserId: claim.userId,
		claimStatus: claim.status,
		claimExpiresAt: claim.claimExpiresAt,
		rewardId: reward.id,
		rewardTitle: reward.title,
		locationScopeType: reward.locationScopeType,
		locationIds: reward.locationIds,
		minSpendMinor: reward.minSpendMinor,
	};
}

/**
 * Resolves presented codes to the calling merchant's claims, with the backup-code brute-force
 * lockout. Unknown backup codes (another merchant's codes are indistinguishable from unknown ones)
 * are counted against the API key — all of them, before the request fails — and audited; the key is
 * locked once its window reaches the limit. Stateless; injected into the validate and checkout handlers.
 */
@Injectable()
export class RedemptionCodeResolver {
	private readonly logger: Logger = new Logger(RedemptionCodeResolver.name);

	public async resolve(scope: PosScope, point: CheckoutPoint, codes: readonly RedemptionCode[], now: EpochMs): Promise<CodeResolution> {
		assertCodeRedemptionUnlocked(await scope.lockout.lockedUntil(point.apiKeyId), now);

		const found: { readonly lookup: ClaimRedemptionLookup; readonly method: RedemptionMethod }[] = [];
		let unknownBackupCodes = 0;
		for (const code of codes) {
			const lookup = await scope.claims.findMerchantClaim(code, point.tenantId);
			if (lookup !== null) {
				found.push({ lookup, method: methodOf(code) });
			} else if (code.backupCode !== undefined) {
				unknownBackupCodes += 1;
			}
		}
		// One query for every presented customer: which of them did this merchant ban.
		const banned = await scope.customerStanding.bannedCustomers(
			point.tenantId,
			found.map(({ lookup }): string => lookup.claim.userId),
		);
		const resolved: readonly ResolvedCode[] = found.map(({ lookup, method }): ResolvedCode => ({
			lookup,
			claim: toRedeemableClaim(lookup, banned.has(lookup.claim.userId)),
			method,
		}));

		const lockedUntil = await this.recordUnknownBackupCodes(scope, point, unknownBackupCodes, now);
		if (lockedUntil !== null) {
			return { kind: "locked", lockedUntil };
		}
		return resolved.length === codes.length ? { kind: "resolved", codes: resolved } : { kind: "not_found" };
	}

	private async recordUnknownBackupCodes(scope: PosScope, point: CheckoutPoint, unknownBackupCodes: number, now: EpochMs): Promise<EpochMs | null> {
		if (unknownBackupCodes === 0) {
			return null;
		}
		const failuresInWindow = await scope.lockout.addFailures(point.apiKeyId, unknownBackupCodes, now, POS_CODE_FAILURE_WINDOW_MS);
		await scope.rewardAudit.append({
			tenantId: point.tenantId,
			actorUserId: null,
			action: "pos.backup_code_rejected",
			metadata: { apiKeyId: point.apiKeyId, terminalId: point.terminalId, locationId: point.locationId, unknownBackupCodes, failuresInWindow },
		});
		const lockedUntil = lockoutAfter(failuresInWindow, now);
		if (lockedUntil === null) {
			return null;
		}
		if (await scope.lockout.lock(point.apiKeyId, now, lockedUntil)) {
			await scope.rewardAudit.append({
				tenantId: point.tenantId,
				actorUserId: null,
				action: "pos.api_key_code_locked",
				metadata: { apiKeyId: point.apiKeyId, terminalId: point.terminalId, locationId: point.locationId, failuresInWindow, lockedUntil },
			});
			this.logger.warn({
				event: "pos.api_key_code_locked",
				tenantId: point.tenantId,
				apiKeyId: point.apiKeyId,
				terminalId: point.terminalId,
				failuresInWindow,
				lockedUntil,
			});
		}
		return lockedUntil;
	}
}
