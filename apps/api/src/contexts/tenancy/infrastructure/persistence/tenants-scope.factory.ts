import type { Prisma } from "@prisma/client";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { StoreClosurePort } from "../../../../platform/application/ports/store-closure.port";
import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { LogService } from "../../../../platform/infrastructure/logging/logs.service";
import type { StoredFileAccess } from "../../../files/public-api";
import { createIdentityTransactionalPorts } from "../../../identity/public-api";
import type { NotificationsTransactionalPortsFactory } from "../../../notifications/public-api";
import type { TenantAuditPort } from "../../application/ports/tenant-audit.port";
import type { TenantsScope } from "../../application/tenants-scope";
import { TransactionKybFiles } from "../adapters/kyb-files.adapter";
import { TransactionTenantEmails } from "../adapters/tenant-emails.adapter";
import { TransactionTenantPolicyProvisioning } from "../adapters/tenant-policy.adapter";
import { TransactionTenantAuditWriter, type TenantAuditTransaction } from "../audit/tenant-audit.adapter";
import { PrismaAccessRequestRepository } from "./prisma-access-request.repository";
import { PrismaInvitationRepository } from "./prisma-invitation.repository";
import { PrismaLocationRepository } from "./prisma-location.repository";
import { PrismaMembershipRepository } from "./prisma-membership.repository";
import { PrismaMerchantVerificationRepository } from "./prisma-merchant-verification.repository";
import { PrismaTenantRepository } from "./prisma-tenant.repository";
import { newRowId } from "@workspace/shared";

/** Pos's `StoreClosurePort` bound to a transaction (pos provides it under `STORE_CLOSURE_FACTORY`). */
export interface StoreClosureFactory {
	forTransaction(db: Prisma.TransactionClient): StoreClosurePort;
}

/** The singletons a scope is assembled from (never the transaction itself). */
export interface TenantsScopeDependencies {
	readonly storeClosure: StoreClosureFactory;
	readonly audit: TenantAuditPort<TenantAuditTransaction>;
	readonly storedFiles: StoredFileAccess;
	readonly notifications: NotificationsTransactionalPortsFactory;
	readonly config: TypedConfigService;
	readonly logs: LogService;
}

/** Builds every tenants repository and port bound to the unit-of-work transaction. Never cached. */
export class TenantsScopeFactory implements ScopeFactory<TenantsScope, Prisma.TransactionClient> {
	public constructor(private readonly deps: TenantsScopeDependencies) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): TenantsScope {
		const { deps } = this;
		return {
			tenants: new PrismaTenantRepository(db),
			merchantVerifications: new PrismaMerchantVerificationRepository(db),
			locations: new PrismaLocationRepository(db),
			memberships: new PrismaMembershipRepository(db),
			invitations: new PrismaInvitationRepository(db),
			accessRequests: new PrismaAccessRequestRepository(db),
			kybFiles: new TransactionKybFiles(db, deps.storedFiles),
			accounts: createIdentityTransactionalPorts(db, { newId: newRowId }, events).accounts,
			storeClosure: deps.storeClosure.forTransaction(db),
			tenantPolicies: new TransactionTenantPolicyProvisioning(db),
			audit: new TransactionTenantAuditWriter(db, deps.audit),
			emails: new TransactionTenantEmails(db, events, deps.notifications, deps.config, deps.logs),
			events,
		};
	}
}
