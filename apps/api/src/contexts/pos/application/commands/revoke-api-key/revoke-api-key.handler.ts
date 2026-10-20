import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type OkResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { ApiKeyNotFoundError } from "../../../domain/errors/pos.errors";
import { actingInTenant, actingMemberId } from "../../acting-member";
import type { PosScope } from "../../pos-scope";
import { POS_UNIT_OF_WORK } from "../../ports/pos.tokens";
import { isWithinGrant } from "../../services/store-scope";
import { RevokeApiKeyCommand } from "./revoke-api-key.command";

/**
 * Revokes a key as a compare-and-set on `revoked_at IS NULL` (D34). Revoking a key that is already
 * revoked succeeds and changes nothing (its original revocation time and audit row stand). Another
 * store's key, or a tenant-wide key, is outside a store-limited member's reach (uniform 404).
 */
@CommandHandler(RevokeApiKeyCommand)
export class RevokeApiKeyHandler implements ICommandHandler<RevokeApiKeyCommand, OkResponse> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RevokeApiKeyCommand): Promise<OkResponse> {
		const { actor, input } = command;
		const memberId = actingMemberId(actor);
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageApiKeys });
		const tenant = actingInTenant(actor, input.tenantId);
		await this.uow.run(tenant, async (scope: PosScope): Promise<void> => {
			const key = await scope.apiKeys.findInTenant(input.keyId, input.tenantId);
			if (key === null || !isWithinGrant(grant, key.locationId)) {
				throw new ApiKeyNotFoundError();
			}
			if (!key.revoke(this.clock.now()) || !(await scope.apiKeys.save(key))) {
				return;
			}
			await scope.rewardAudit.append({ tenantId: input.tenantId, actorUserId: memberId, action: "merchant.api_key_revoked", metadata: { keyId: key.id } });
		});
		return { ok: true };
	}
}
