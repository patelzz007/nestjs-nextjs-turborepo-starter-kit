import type { SystemOperationName } from "../../application/system-operation-names";

/** Allowlisted, read-only operation the tenant-integrity check runs under (multi-tenancy plan MT-60). */
export const TENANT_INTEGRITY_CHECK_OPERATION: SystemOperationName = "tenancy.data_check";

/**
 * One child → parent relation that must stay inside one tenant: the child's `tenantId` equals its
 * parent's. These are the composite foreign keys of the multi-tenancy plan §7 (D10, D31), which the
 * database enforces once they exist; the check proves no existing row violates one before they land.
 */
export interface TenantIntegrityRelation {
	readonly child: string;
	readonly foreignKey: string;
	readonly parent: string;
}

/** The §7 relations, in the plan's order. */
export const TENANT_INTEGRITY_RELATIONS: readonly TenantIntegrityRelation[] = [
	{ child: "MembershipLocationScope", foreignKey: "locationId", parent: "Location" },
	{ child: "MembershipLocationScope", foreignKey: "membershipId", parent: "Membership" },
	{ child: "Reward", foreignKey: "parentConsumerRewardId", parent: "Reward" },
	{ child: "Reward", foreignKey: "referrerRewardId", parent: "Reward" },
	{ child: "RewardImage", foreignKey: "rewardId", parent: "Reward" },
	{ child: "RewardLocationScope", foreignKey: "locationId", parent: "Location" },
	{ child: "RewardLocationScope", foreignKey: "rewardId", parent: "Reward" },
	{ child: "RewardRedemption", foreignKey: "locationId", parent: "Location" },
	{ child: "RewardSale", foreignKey: "apiKeyId", parent: "TenantApiKey" },
	{ child: "RewardSale", foreignKey: "locationId", parent: "Location" },
	{ child: "TenantApiKey", foreignKey: "locationId", parent: "Location" },
	{ child: "TenantInvitationLocationScope", foreignKey: "locationId", parent: "Location" },
	{ child: "TenantTerminal", foreignKey: "apiKeyId", parent: "TenantApiKey" },
	{ child: "TenantTerminal", foreignKey: "locationId", parent: "Location" },
];
