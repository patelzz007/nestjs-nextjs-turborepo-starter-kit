import { Module } from "@nestjs/common";

import { PublicUrlResolver } from "../../../config/public-url.resolver";
import { MERCHANT_ORGANIZATION_RESOLVER, type MerchantOrganizationResolverPort } from "../../../platform/application/ports/merchant-organization-resolver.port";
import { PrismaModule } from "../../../prisma/prisma.module";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CEDAR_POLICY_EVALUATOR, type CedarPolicyEvaluatorPort } from "../../authorization/public-api";
import { MERCHANT_PORTAL_ACCESS } from "../../identity/public-api";
import type { ApiKeyCapabilitiesPort } from "../application/ports/api-key-capabilities.port";
import type { MerchantAccessPort } from "../application/ports/merchant-access.port";
import type { OrganizationReadPort } from "../application/ports/organization-read.port";
import type { OrganizationFileAccessPort } from "../application/ports/organization-file-access.port";
import {
	API_KEY_CAPABILITIES,
	MERCHANT_ACCESS,
	ORGANIZATION_CONTEXT_READ,
	ORGANIZATION_DIRECTORY,
	ORGANIZATION_FILE_ACCESS,
	ORGANIZATION_READ,
	TENANT_POLICY,
} from "../application/ports/organizations.tokens";
import type { TenantPolicyPort } from "../application/ports/tenant-policy.port";
import { MerchantAccessAdapter } from "./adapters/merchant-access.adapter";
import { MerchantPortalAccessAdapter } from "./adapters/merchant-portal-access.adapter";
import { OrganizationContextService } from "./adapters/organization-context.service";
import { OrganizationDirectoryAdapter } from "./adapters/organization-directory.adapter";
import { OrganizationFileAccessAdapter } from "./adapters/organization-file-access.adapter";
import { OrganizationRewardAuthService } from "./adapters/organization-reward-auth.service";
import { CedarTenantPolicyAdapter } from "./adapters/tenant-policy.adapter";
import { OrganizationAuditModule } from "./audit/organization-audit.module";
import { PrismaOrganizationReadRepository } from "./persistence/prisma-organization-read.repository";
import { PrismaOwnMembershipsReadRepository } from "./persistence/prisma-own-memberships.read-repository";

/**
 * The organization access surface other contexts consume: the merchant
 * capability gate (`MERCHANT_ACCESS`; an API key's capabilities come from pos's
 * global `API_KEY_CAPABILITIES`), the member organization resolver behind the
 * merchant-actor interceptor (`MERCHANT_ORGANIZATION_RESOLVER`), batched display reads
 * (`ORGANIZATION_READ`), the organization-file access rule
 * (`ORGANIZATION_FILE_ACCESS`) and the audit trail (`ORGANIZATION_AUDIT`). It does
 * not import the files context, so files (and anything files imports) can
 * depend on it without a module cycle.
 */
@Module({
	imports: [PrismaModule, OrganizationAuditModule],
	providers: [
		OrganizationContextService,
		OrganizationRewardAuthService,
		{
			provide: TENANT_POLICY,
			inject: [CEDAR_POLICY_EVALUATOR],
			useFactory: (cedar: CedarPolicyEvaluatorPort): TenantPolicyPort => new CedarTenantPolicyAdapter(cedar),
		},
		{
			provide: MERCHANT_ACCESS,
			inject: [OrganizationRewardAuthService, OrganizationContextService, API_KEY_CAPABILITIES],
			useFactory: (auth: OrganizationRewardAuthService, context: OrganizationContextService, apiKeys: ApiKeyCapabilitiesPort): MerchantAccessPort =>
				new MerchantAccessAdapter(auth, context, apiKeys),
		},
		{
			provide: MERCHANT_ORGANIZATION_RESOLVER,
			inject: [OrganizationRewardAuthService],
			useFactory: (auth: OrganizationRewardAuthService): MerchantOrganizationResolverPort => ({
				async organizationIdForMember(userId: string, orgSlug: string): Promise<string> {
					return (await auth.resolveOrganizationFromSlug(userId, orgSlug)).organizationId;
				},
			}),
		},
		{
			provide: ORGANIZATION_DIRECTORY,
			inject: [OrganizationContextService, TenantTransactionService],
			useFactory: (context: OrganizationContextService, transactions: TenantTransactionService): OrganizationDirectoryAdapter =>
				new OrganizationDirectoryAdapter(context, new PrismaOwnMembershipsReadRepository(transactions)),
		},
		{ provide: ORGANIZATION_CONTEXT_READ, useExisting: ORGANIZATION_DIRECTORY },
		MerchantPortalAccessAdapter,
		{ provide: MERCHANT_PORTAL_ACCESS, useExisting: MerchantPortalAccessAdapter },
		{
			provide: ORGANIZATION_FILE_ACCESS,
			inject: [TenantTransactionService, OrganizationRewardAuthService],
			useFactory: (transactions: TenantTransactionService, auth: OrganizationRewardAuthService): OrganizationFileAccessPort =>
				new OrganizationFileAccessAdapter(transactions, auth),
		},
		{
			provide: ORGANIZATION_READ,
			inject: [TenantTransactionService, PublicUrlResolver],
			useFactory: (transactions: TenantTransactionService, publicUrls: PublicUrlResolver): OrganizationReadPort =>
				new PrismaOrganizationReadRepository(transactions, publicUrls),
		},
	],
	exports: [
		MERCHANT_ACCESS,
		MERCHANT_ORGANIZATION_RESOLVER,
		ORGANIZATION_READ,
		ORGANIZATION_FILE_ACCESS,
		MERCHANT_PORTAL_ACCESS,
		ORGANIZATION_DIRECTORY,
		ORGANIZATION_CONTEXT_READ,
		TENANT_POLICY,
		OrganizationAuditModule,
		OrganizationContextService,
		OrganizationRewardAuthService,
	],
})
export class OrganizationAccessModule {}
