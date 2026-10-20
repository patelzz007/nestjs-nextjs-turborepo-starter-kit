import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantApiKeyCreated } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { ApiKeyLocationRequiredError } from "../../../domain/errors/pos.errors";
import { actingInTenant, actingMemberId } from "../../acting-member";
import type { PosScope } from "../../pos-scope";
import type { PosCredentialsPort } from "../../ports/pos-credentials.port";
import { POS_CREDENTIALS, POS_ID_GENERATOR, POS_UNIT_OF_WORK, type PosIdGenerator } from "../../ports/pos.tokens";
import { IssueApiKeyCommand } from "./issue-api-key.command";

/** Display name of a key created without one. */
const DEFAULT_API_KEY_NAME = "API key";

/**
 * Mints a key for one of the member's stores, or (only for a member with access to every store) an
 * tenant-wide key, with its audit row. The plaintext is returned once and never stored.
 */
@CommandHandler(IssueApiKeyCommand)
export class IssueApiKeyHandler implements ICommandHandler<IssueApiKeyCommand, MerchantApiKeyCreated> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(POS_CREDENTIALS) private readonly credentials: PosCredentialsPort,
		@Inject(POS_ID_GENERATOR) private readonly ids: PosIdGenerator,
	) {}

	public async execute(command: IssueApiKeyCommand): Promise<MerchantApiKeyCreated> {
		const { actor, input } = command;
		const memberId = actingMemberId(actor);
		const grant = await this.merchantAccess.assertCapability(actor, {
			tenantId: input.tenantId,
			capability: MERCHANT_CAPABILITY.manageApiKeys,
			locationId: input.locationId ?? null,
		});
		const tenant = actingInTenant(actor, input.tenantId);
		if (grant.locationScope === "SELECTED" && input.locationId === undefined) {
			throw new ApiKeyLocationRequiredError();
		}
		const key = this.credentials.newApiKey();
		const name = input.name ?? DEFAULT_API_KEY_NAME;
		const locationId = input.locationId ?? null;
		const id = this.ids.next();
		await this.uow.run(tenant, async (scope: PosScope): Promise<void> => {
			await scope.apiKeys.add({
				id,
				tenantId: input.tenantId,
				locationId,
				name,
				keyHash: key.hash,
				keyPrefix: key.prefix,
				scope: input.scope,
				createdByUserId: memberId,
			});
			await scope.rewardAudit.append({
				tenantId: input.tenantId,
				actorUserId: memberId,
				action: "merchant.api_key_created",
				metadata: { keyId: id, name, scope: input.scope, locationId },
			});
		});
		return { id, apiKey: key.plaintext, name, scope: input.scope, locationId };
	}
}
