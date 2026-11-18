import type { MerchantCapability } from "@workspace/shared";

import type { TableName } from "./table-types";

/**
 * What each merchant capability's routes do to which tables AS THE MEMBER (inside the member's own transaction, under
 * row-level security) — never what they do through a system operation, which RLS admits by the operation's scope.
 *
 * capability-access.spec.ts holds this against table-policies.ts both ways (ADR 090):
 * - every access listed here has a policy that admits the capability's permission for that command, so the database
 *   never refuses what the route allowed;
 * - every permission-based policy on a tenant table is used by some capability listed here, so a route that moves to
 *   another verb cannot leave a stale policy behind.
 *
 * A `Record` over every capability: a new capability does not compile until it says which tables it touches (an empty
 * list when every write and read runs as a system operation, with a comment saying so).
 */

/** One statement kind against one table. */
export type TableCommand = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

/** A table and the commands a capability's routes run on it as the member. */
export interface CapabilityTableAccess {
	readonly table: TableName;
	readonly commands: readonly TableCommand[];
}

const READ: readonly TableCommand[] = ["SELECT"];
const READ_INSERT: readonly TableCommand[] = ["SELECT", "INSERT"];
const READ_UPDATE: readonly TableCommand[] = ["SELECT", "UPDATE"];
const READ_WRITE: readonly TableCommand[] = ["SELECT", "INSERT", "UPDATE"];
const INSERT: readonly TableCommand[] = ["INSERT"];

export const CAPABILITY_TABLE_ACCESS: Readonly<Record<MerchantCapability, readonly CapabilityTableAccess[]>> = {
	// The dashboard and the store list come from the member-wide tenant context (system operation and member reads).
	"merchant:view_dashboard": [],
	"merchant:view_locations": [{ table: "Location", commands: READ }],
	"merchant:manage_locations": [
		{ table: "Location", commands: ["INSERT", "UPDATE"] },
		{ table: "TenantAsset", commands: ["UPDATE"] },
		{ table: "StoredFile", commands: READ_WRITE },
	],
	"merchant:view_rewards": [
		{ table: "Reward", commands: READ },
		{ table: "RewardLocationScope", commands: READ },
		{ table: "RewardImage", commands: READ },
		{ table: "RewardAudienceMember", commands: READ },
		{ table: "StoredFile", commands: READ },
	],
	"merchant:create_rewards": [
		{ table: "Reward", commands: READ_INSERT },
		{ table: "RewardLocationScope", commands: READ_INSERT },
		{ table: "RewardImage", commands: READ_INSERT },
		{ table: "RewardAudienceMember", commands: READ_INSERT },
		{ table: "TenantCustomer", commands: READ },
		{ table: "StoredFile", commands: READ_WRITE },
	],
	"merchant:manage_rewards": [
		{ table: "Reward", commands: READ_UPDATE },
		{ table: "RewardLocationScope", commands: READ_INSERT },
		{ table: "RewardImage", commands: READ_WRITE },
		{ table: "RewardAudienceMember", commands: READ_WRITE },
		{ table: "TenantCustomer", commands: READ },
		{ table: "StoredFile", commands: READ_WRITE },
	],
	"merchant:publish_rewards": [{ table: "Reward", commands: READ_UPDATE }],
	"merchant:view_redemptions": [
		{ table: "RewardRedemption", commands: READ },
		{ table: "TenantCustomerBan", commands: READ },
	],
	"merchant:view_analytics": [
		{ table: "RewardSale", commands: READ },
		{ table: "RewardLocationScope", commands: READ },
	],
	"merchant:view_api_keys": [{ table: "TenantApiKey", commands: READ }],
	"merchant:manage_api_keys": [
		{ table: "TenantApiKey", commands: READ_INSERT },
		{ table: "RewardAuditLog", commands: INSERT },
		{ table: "TenantMerchantProfile", commands: ["UPDATE"] },
	],
	"merchant:revoke_api_keys": [
		{ table: "TenantApiKey", commands: READ_UPDATE },
		{ table: "RewardAuditLog", commands: INSERT },
	],
	"merchant:view_terminals": [
		{ table: "TenantTerminal", commands: READ },
		{ table: "TenantApiKey", commands: READ },
	],
	"merchant:manage_terminals": [
		{ table: "TenantTerminal", commands: READ_WRITE },
		{ table: "TenantApiKey", commands: READ },
		{ table: "Location", commands: ["UPDATE"] },
		{ table: "RewardAuditLog", commands: INSERT },
	],
	"merchant:remove_terminals": [
		{ table: "TenantTerminal", commands: READ_UPDATE },
		{ table: "TenantApiKey", commands: READ_UPDATE },
		{ table: "RewardAuditLog", commands: INSERT },
	],
	"merchant:view_team": [
		{ table: "Membership", commands: READ },
		{ table: "MembershipLocationScope", commands: READ },
		{ table: "TenantInvitation", commands: READ },
		{ table: "TenantInvitationLocationScope", commands: READ },
	],
	// Every team write (roles, store access, removal) is a system operation; the routes read the rows they change.
	"merchant:manage_team": [
		{ table: "Membership", commands: READ },
		{ table: "MembershipLocationScope", commands: READ },
	],
	"merchant:invite_members": [
		{ table: "TenantInvitation", commands: READ },
		{ table: "TenantInvitationLocationScope", commands: READ },
	],
	"merchant:revoke_invites": [
		{ table: "TenantInvitation", commands: READ },
		{ table: "TenantInvitationLocationScope", commands: READ },
	],
	// Reviewing a join request runs as `tenant.access_request.review`.
	"merchant:approve_access_requests": [],
	"merchant:reject_access_requests": [],
	"merchant:view_verification": [
		{ table: "TenantKybFile", commands: READ },
		{ table: "StoredFile", commands: READ },
	],
	"merchant:manage_verification": [
		{ table: "TenantKybFile", commands: READ_WRITE },
		{ table: "TenantMerchantProfile", commands: ["UPDATE"] },
		{ table: "StoredFile", commands: READ_WRITE },
	],
	// The delivery log reads through the notifications system operations.
	"merchant:view_notifications": [],
	// Broadcasts are read and written as `broadcasts.*` system operations; only their images are the member's own.
	"merchant:view_broadcasts": [{ table: "StoredFile", commands: READ }],
	"merchant:create_broadcasts": [],
	"merchant:manage_broadcasts": [{ table: "StoredFile", commands: READ_WRITE }],
	"merchant:publish_broadcasts": [],
	"merchant:view_payments": [{ table: "PaymentIntent", commands: READ }],
	// Asking for and refunding a payment run as `payments.*` system operations.
	"merchant:manage_payments": [],
	"merchant:refund_payments": [],
	"merchant:view_webhooks": [
		{ table: "WebhookEndpoint", commands: READ },
		{ table: "WebhookDelivery", commands: READ },
	],
	"merchant:create_webhooks": [{ table: "WebhookEndpoint", commands: READ_INSERT }],
	"merchant:manage_webhooks": [
		{ table: "WebhookEndpoint", commands: READ_UPDATE },
		{ table: "WebhookDelivery", commands: READ_WRITE },
	],
	"merchant:delete_webhooks": [{ table: "WebhookEndpoint", commands: READ_UPDATE }],
	"merchant:view_customer_bans": [{ table: "TenantCustomerBan", commands: READ }],
	// Banning and lifting run as `tenant.customer_ban.*` system operations.
	"merchant:ban_customers": [],
	"merchant:lift_customer_bans": [],
};
