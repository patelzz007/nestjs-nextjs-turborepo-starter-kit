import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { TransactionalAccountProvisioningPort } from "../../../platform/application/ports/account-provisioning.port";
import type { StoreClosurePort } from "../../../platform/application/ports/store-closure.port";
import type { AccessRequestRepository } from "../domain/repositories/access-request.repository";
import type { InvitationRepository } from "../domain/repositories/invitation.repository";
import type { LocationRepository } from "../domain/repositories/location.repository";
import type { MembershipRepository } from "../domain/repositories/membership.repository";
import type { MerchantVerificationRepository } from "../domain/repositories/merchant-verification.repository";
import type { OrganizationRepository } from "../domain/repositories/organization.repository";
import type { KybFilesInTransaction } from "./ports/kyb-files.port";
import type { OrganizationAuditWriter } from "./ports/organization-audit.port";
import type { OrganizationEmailPort } from "./ports/organization-emails.port";
import type { TenantPolicyProvisioningPort } from "./ports/tenant-policy.port";

/** Everything one organizations unit of work can touch. Every member is bound to that transaction. */
export interface OrganizationsScope {
	readonly organizations: OrganizationRepository;
	readonly merchantVerifications: MerchantVerificationRepository;
	readonly locations: LocationRepository;
	readonly memberships: MembershipRepository;
	readonly invitations: InvitationRepository;
	readonly accessRequests: AccessRequestRepository;
	readonly kybFiles: KybFilesInTransaction;
	readonly accounts: TransactionalAccountProvisioningPort;
	readonly storeClosure: StoreClosurePort;
	readonly tenantPolicies: TenantPolicyProvisioningPort;
	readonly audit: OrganizationAuditWriter;
	readonly emails: OrganizationEmailPort;
	readonly events: TransactionalEventCollector;
}
