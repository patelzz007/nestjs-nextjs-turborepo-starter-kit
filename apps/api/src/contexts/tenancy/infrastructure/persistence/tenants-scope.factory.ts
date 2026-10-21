import type { Prisma } from "@prisma/client";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { LocationClosurePort } from "../../../../platform/application/ports/location-closure.port";
import type { RedemptionCustomerPort } from "../../../../platform/application/ports/redemption-customer.port";
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
import { PrismaSuspensionAppealRepository } from "./prisma-suspension-appeal.repository";
import { PrismaCustomerBanRepository } from "./prisma-customer-ban.repository";
import { PrismaInvitationRepository } from "./prisma-invitation.repository";
import { PrismaLocationRepository } from "./prisma-location.repository";
import { PrismaMembershipRepository } from "./prisma-membership.repository";
import { PrismaMerchantVerificationRepository } from "./prisma-merchant-verification.repository";
import { PrismaTenantRepository } from "./prisma-tenant.repository";
import { newRowId } from "@workspace/shared";

/** Pos's `LocationClosurePort` bound to a transaction (pos provides it under `LOCATION_CLOSURE_FACTORY`). */
export interface LocationClosureFactory {
	forTransaction(db: Prisma.TransactionClient): LocationClosurePort;
}

/** Pos's `RedemptionCustomerPort` bound to a transaction (pos provides it under `REDEMPTION_CUSTOMER_FACTORY`). */
export interface RedemptionCustomerFactory {
	forTransaction(db: Prisma.TransactionClient): RedemptionCustomerPort;
}

/** The singletons a scope is assembled from (never the transaction itself). */
export interface TenantsScopeDependencies {
	readonly locationClosure: LocationClosureFactory;
	readonly redemptionCustomers: RedemptionCustomerFactory;
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
			appeals: new PrismaSuspensionAppealRepository(db),
			kybFiles: new TransactionKybFiles(db, deps.storedFiles),
			accounts: createIdentityTransactionalPorts(db, { newId: newRowId }, events).accounts,
			locationClosure: deps.locationClosure.forTransaction(db),
			redemptionCustomers: deps.redemptionCustomers.forTransaction(db),
			customerBans: new PrismaCustomerBanRepository(db),
			tenantPolicies: new TransactionTenantPolicyProvisioning(db),
			audit: new TransactionTenantAuditWriter(db, deps.audit),
			emails: new TransactionTenantEmails(db, events, deps.notifications, deps.config, deps.logs),
			events,
		};
	}
}
