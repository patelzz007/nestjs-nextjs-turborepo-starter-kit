import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantKybProfileResponse } from "@workspace/shared";

import { merchantNotFound } from "../../kyb-errors";
import { actingInOrganization, requireUserActor } from "../../organization-actor";
import type { KybReadPort } from "../../ports/kyb-read.port";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { KYB_READ, MERCHANT_ACCESS, ORGANIZATION_DIRECTORY } from "../../ports/organizations.tokens";
import { GetKybProfileQuery } from "./get-kyb-profile.query";

/** KYB holds the business's legal and identity details: `merchant:manage_verification` only. */
@QueryHandler(GetKybProfileQuery)
export class GetKybProfileHandler implements IQueryHandler<GetKybProfileQuery, MerchantKybProfileResponse> {
	public constructor(
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
	) {}

	public async execute(query: GetKybProfileQuery): Promise<MerchantKybProfileResponse> {
		const user = requireUserActor(query.actor);
		const member = await this.directory.resolveMember(user, query.input.orgSlug);
		await this.merchantAccess.assertCapability(user, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageVerification });
		const profile = await this.kyb.getProfile(actingInOrganization(user, member.organizationId), member.organizationId);
		if (profile === null) {
			throw merchantNotFound();
		}
		return profile;
	}
}
