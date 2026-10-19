import type { Prisma } from "@prisma/client";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { StoreClosurePort } from "../../../../platform/application/ports/store-closure.port";
import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { LogService } from "../../../../platform/infrastructure/logging/logs.service";
import type { StoredFileAccess } from "../../../files/public-api";
import { createIdentityTransactionalPorts } from "../../../identity/public-api";
import type { NotificationsTransactionalPortsFactory } from "../../../notifications/public-api";
import type { OrganizationAuditPort } from "../../application/ports/organization-audit.port";
import type { OrganizationsScope } from "../../application/organizations-scope";
import { TransactionKybFiles } from "../adapters/kyb-files.adapter";
import { TransactionOrganizationEmails } from "../adapters/organization-emails.adapter";
import { TransactionTenantPolicyProvisioning } from "../adapters/tenant-policy.adapter";
import { TransactionOrganizationAuditWriter, type OrganizationAuditTransaction } from "../audit/organization-audit.adapter";
import { PrismaAccessRequestRepository } from "./prisma-access-request.repository";
import { PrismaInvitationRepository } from "./prisma-invitation.repository";
import { PrismaLocationRepository } from "./prisma-location.repository";
import { PrismaMembershipRepository } from "./prisma-membership.repository";
import { PrismaMerchantVerificationRepository } from "./prisma-merchant-verification.repository";
import { PrismaOrganizationRepository } from "./prisma-organization.repository";
import { newRowId } from "@workspace/shared";

/** Pos's `StoreClosurePort` bound to a transaction (pos provides it under `STORE_CLOSURE_FACTORY`). */
export interface StoreClosureFactory {
	forTransaction(db: Prisma.TransactionClient): StoreClosurePort;
}

/** The singletons a scope is assembled from (never the transaction itself). */
export interface OrganizationsScopeDependencies {
	readonly storeClosure: StoreClosureFactory;
	readonly audit: OrganizationAuditPort<OrganizationAuditTransaction>;
	readonly storedFiles: StoredFileAccess;
	readonly notifications: NotificationsTransactionalPortsFactory;
	readonly config: TypedConfigService;
	readonly logs: LogService;
}

/** Builds every organizations repository and port bound to the unit-of-work transaction. Never cached. */
export class OrganizationsScopeFactory implements ScopeFactory<OrganizationsScope, Prisma.TransactionClient> {
	public constructor(private readonly deps: OrganizationsScopeDependencies) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): OrganizationsScope {
		const { deps } = this;
		return {
			organizations: new PrismaOrganizationRepository(db),
			merchantVerifications: new PrismaMerchantVerificationRepository(db),
			locations: new PrismaLocationRepository(db),
			memberships: new PrismaMembershipRepository(db),
			invitations: new PrismaInvitationRepository(db),
			accessRequests: new PrismaAccessRequestRepository(db),
			kybFiles: new TransactionKybFiles(db, deps.storedFiles),
			accounts: createIdentityTransactionalPorts(db, { newId: newRowId }, events).accounts,
			storeClosure: deps.storeClosure.forTransaction(db),
			tenantPolicies: new TransactionTenantPolicyProvisioning(db),
			audit: new TransactionOrganizationAuditWriter(db, deps.audit),
			emails: new TransactionOrganizationEmails(db, events, deps.notifications, deps.config, deps.logs),
			events,
		};
	}
}
