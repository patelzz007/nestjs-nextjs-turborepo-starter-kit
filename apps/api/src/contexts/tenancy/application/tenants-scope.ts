import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { TransactionalAccountProvisioningPort } from "../../../platform/application/ports/account-provisioning.port";
import type { LocationClosurePort } from "../../../platform/application/ports/location-closure.port";
import type { RedemptionCustomerPort } from "../../../platform/application/ports/redemption-customer.port";
import type { CustomerBanRepository } from "../domain/repositories/customer-ban.repository";
import type { AccessRequestRepository } from "../domain/repositories/access-request.repository";
import type { InvitationRepository } from "../domain/repositories/invitation.repository";
import type { LocationRepository } from "../domain/repositories/location.repository";
import type { MembershipRepository } from "../domain/repositories/membership.repository";
import type { MerchantVerificationRepository } from "../domain/repositories/merchant-verification.repository";
import type { SuspensionAppealRepository } from "../domain/repositories/suspension-appeal.repository";
import type { TenantRepository } from "../domain/repositories/tenant.repository";
import type { KybFilesInTransaction } from "./ports/kyb-files.port";
import type { TenantAuditWriter } from "./ports/tenant-audit.port";
import type { TenantEmailPort } from "./ports/tenant-emails.port";
import type { TenantPolicyProvisioningPort } from "./ports/tenant-policy.port";

/** Everything one tenants unit of work can touch. Every member is bound to that transaction. */
export interface TenantsScope {
	readonly tenants: TenantRepository;
	readonly merchantVerifications: MerchantVerificationRepository;
	readonly locations: LocationRepository;
	readonly memberships: MembershipRepository;
	readonly invitations: InvitationRepository;
	readonly accessRequests: AccessRequestRepository;
	readonly appeals: SuspensionAppealRepository;
	readonly kybFiles: KybFilesInTransaction;
	readonly accounts: TransactionalAccountProvisioningPort;
	readonly locationClosure: LocationClosurePort;
	/** Pos's redemption lookup: the customer a ban is made from. */
	readonly redemptionCustomers: RedemptionCustomerPort;
	readonly customerBans: CustomerBanRepository;
	readonly tenantPolicies: TenantPolicyProvisioningPort;
	readonly audit: TenantAuditWriter;
	readonly emails: TenantEmailPort;
	readonly events: TransactionalEventCollector;
}
