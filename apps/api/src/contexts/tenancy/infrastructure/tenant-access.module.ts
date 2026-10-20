import { Module } from "@nestjs/common";

import { PublicUrlResolver } from "../../../config/public-url.resolver";
import { MERCHANT_TENANT_RESOLVER, type MerchantTenantResolverPort } from "../../../platform/application/ports/merchant-tenant-resolver.port";
import { PrismaModule } from "../../../prisma/prisma.module";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CEDAR_POLICY_EVALUATOR, type CedarPolicyEvaluatorPort } from "../../authorization/public-api";
import { MERCHANT_PORTAL_ACCESS } from "../../identity/public-api";
import type { ApiKeyCapabilitiesPort } from "../application/ports/api-key-capabilities.port";
import type { MerchantAccessPort } from "../application/ports/merchant-access.port";
import type { TenantReadPort } from "../application/ports/tenant-read.port";
import type { TenantFileAccessPort } from "../application/ports/tenant-file-access.port";
import {
	API_KEY_CAPABILITIES,
	MERCHANT_ACCESS,
	TENANT_CONTEXT_READ,
	TENANT_DIRECTORY,
	TENANT_FILE_ACCESS,
	TENANT_READ,
	TENANT_POLICY,
} from "../application/ports/tenants.tokens";
import type { TenantPolicyPort } from "../application/ports/tenant-policy.port";
import { MerchantAccessAdapter } from "./adapters/merchant-access.adapter";
import { MerchantPortalAccessAdapter } from "./adapters/merchant-portal-access.adapter";
import { TenantContextService } from "./adapters/tenant-context.service";
import { TenantDirectoryAdapter } from "./adapters/tenant-directory.adapter";
import { TenantFileAccessAdapter } from "./adapters/tenant-file-access.adapter";
import { TenantRewardAuthService } from "./adapters/tenant-reward-auth.service";
import { CedarTenantPolicyAdapter } from "./adapters/tenant-policy.adapter";
import { TenantAuditModule } from "./audit/tenant-audit.module";
import { PrismaTenantReadRepository } from "./persistence/prisma-tenant-read.repository";
import { PrismaOwnMembershipsReadRepository } from "./persistence/prisma-own-memberships.read-repository";

/**
 * The tenant access surface other contexts consume: the merchant
 * capability gate (`MERCHANT_ACCESS`; an API key's capabilities come from pos's
 * global `API_KEY_CAPABILITIES`), the member tenant resolver behind the
 * merchant-actor interceptor (`MERCHANT_TENANT_RESOLVER`), batched display reads
 * (`TENANT_READ`), the tenant-file access rule
 * (`TENANT_FILE_ACCESS`) and the audit trail (`TENANT_AUDIT`). It does
 * not import the files context, so files (and anything files imports) can
 * depend on it without a module cycle.
 */
@Module({
	imports: [PrismaModule, TenantAuditModule],
	providers: [
		TenantContextService,
		TenantRewardAuthService,
		{
			provide: TENANT_POLICY,
			inject: [CEDAR_POLICY_EVALUATOR],
			useFactory: (cedar: CedarPolicyEvaluatorPort): TenantPolicyPort => new CedarTenantPolicyAdapter(cedar),
		},
		{
			provide: MERCHANT_ACCESS,
			inject: [TenantRewardAuthService, TenantContextService, API_KEY_CAPABILITIES],
			useFactory: (auth: TenantRewardAuthService, context: TenantContextService, apiKeys: ApiKeyCapabilitiesPort): MerchantAccessPort =>
				new MerchantAccessAdapter(auth, context, apiKeys),
		},
		{
			provide: MERCHANT_TENANT_RESOLVER,
			inject: [TenantRewardAuthService],
			useFactory: (auth: TenantRewardAuthService): MerchantTenantResolverPort => ({
				async tenantIdForMember(userId: string, tenantSlug: string): Promise<string> {
					return (await auth.resolveTenantFromSlug(userId, tenantSlug)).tenantId;
				},
			}),
		},
		{
			provide: TENANT_DIRECTORY,
			inject: [TenantContextService, TenantTransactionService],
			useFactory: (context: TenantContextService, transactions: TenantTransactionService): TenantDirectoryAdapter =>
				new TenantDirectoryAdapter(context, new PrismaOwnMembershipsReadRepository(transactions)),
		},
		{ provide: TENANT_CONTEXT_READ, useExisting: TENANT_DIRECTORY },
		MerchantPortalAccessAdapter,
		{ provide: MERCHANT_PORTAL_ACCESS, useExisting: MerchantPortalAccessAdapter },
		{
			provide: TENANT_FILE_ACCESS,
			inject: [TenantTransactionService, TenantRewardAuthService],
			useFactory: (transactions: TenantTransactionService, auth: TenantRewardAuthService): TenantFileAccessPort => new TenantFileAccessAdapter(transactions, auth),
		},
		{
			provide: TENANT_READ,
			inject: [TenantTransactionService, PublicUrlResolver],
			useFactory: (transactions: TenantTransactionService, publicUrls: PublicUrlResolver): TenantReadPort => new PrismaTenantReadRepository(transactions, publicUrls),
		},
	],
	exports: [
		MERCHANT_ACCESS,
		MERCHANT_TENANT_RESOLVER,
		TENANT_READ,
		TENANT_FILE_ACCESS,
		MERCHANT_PORTAL_ACCESS,
		TENANT_DIRECTORY,
		TENANT_CONTEXT_READ,
		TENANT_POLICY,
		TenantAuditModule,
		TenantContextService,
		TenantRewardAuthService,
	],
})
export class TenantAccessModule {}
