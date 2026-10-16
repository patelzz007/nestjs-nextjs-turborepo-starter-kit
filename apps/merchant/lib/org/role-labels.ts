import type { OrganizationMembershipRole } from "@workspace/shared";

/** How each organization role reads on screen — one map for the dashboard, the team page and the store switcher. */
export const ORGANIZATION_ROLE_LABELS: Readonly<Record<OrganizationMembershipRole, string>> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};
