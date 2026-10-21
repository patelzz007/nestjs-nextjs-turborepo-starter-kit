import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import { SERVED_TENANT_POLICY, type ServedTenantPolicy } from "../../../../platform/application/tenancy/served-tenant.port";
import type { ApiKeyVerificationPort, MerchantApiKeyAuthContext } from "../../../../platform/application/ports/api-key-verification.port";
import { sha256Hex } from "../../../../platform/infrastructure/crypto/sha256";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { createTenantsTransactionalPorts } from "../../../tenancy/public-api";
import { TenantNotActiveError } from "../../domain/errors/pos.errors";
import { API_KEY_SCOPE_CAPABILITIES } from "../../domain/policies/api-key-scope.policy";
import { AUTH_API_KEY_LOOKUP_OPERATION } from "../../application/ports/pos.tokens";

/** API-key authentication runs before the request has a principal. */
interface ApiKeyLookupTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * {@link ApiKeyVerificationPort} for merchant keys. Runs in the guards' pre-handler phase under
 * `auth.api_key.lookup`, before the request has a principal. A key paired to a terminal dies
 * with it; a valid key of a suspended / deactivated merchant authenticates but may do nothing. A key
 * of a tenant this deployment does not serve (single mode: any tenant but the configured one) does
 * not authenticate at all.
 *
 * `lastUsedAt` is written before the request proceeds (awaited), not fire-and-forget as plan §7.3
 * sketched: the write commits with the lookup, so a detached write would run with no principal and be refused.
 */
@Injectable()
export class PrismaApiKeyVerifier implements ApiKeyVerificationPort {
	public constructor(
		@Inject(TenantTransactionService) private readonly transactions: ApiKeyLookupTransactions,
		@Inject(CLOCK) private readonly clock: Clock,
		@Inject(SERVED_TENANT_POLICY) private readonly servedTenants: ServedTenantPolicy,
	) {}

	public async verify(plaintext: string): Promise<MerchantApiKeyAuthContext | null> {
		return this.transactions.withSystemOperation(
			{ operation: AUTH_API_KEY_LOOKUP_OPERATION, reason: "Authenticate a merchant API key", actorUserId: null },
			async (tx): Promise<MerchantApiKeyAuthContext | null> => {
				const key = await tx.tenantApiKey.findFirst({
					where: { keyHash: sha256Hex(plaintext), isDeleted: false, revokedAt: null },
					select: { id: true, tenantId: true, locationId: true, scope: true, terminal: { select: { id: true, terminalId: true, locationId: true, isDeleted: true } } },
				});
				if (key === null || key.terminal?.isDeleted === true || !this.servedTenants.servesTenant(key.tenantId)) {
					return null;
				}
				const tenant = await createTenantsTransactionalPorts(tx).merchantPosSettings.tillTenant(key.tenantId);
				if (tenant?.operating !== true) {
					throw new TenantNotActiveError();
				}
				await tx.tenantApiKey.update({ where: { id: key.id }, data: { lastUsedAt: this.clock.now() }, select: { id: true } });
				return {
					provider: "merchant",
					apiKeyId: key.id,
					tenantId: key.tenantId,
					locationId: key.locationId,
					terminal: key.terminal === null ? null : { id: key.terminal.id, terminalId: key.terminal.terminalId, locationId: key.terminal.locationId },
					requireRegisteredTerminals: tenant.requireRegisteredTerminals,
					scope: key.scope,
					capabilities: API_KEY_SCOPE_CAPABILITIES[key.scope],
				};
			},
		);
	}
}
