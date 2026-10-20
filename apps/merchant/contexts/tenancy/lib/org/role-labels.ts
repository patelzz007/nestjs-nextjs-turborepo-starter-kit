import type { MembershipRole } from "@workspace/shared";

/** How each tenant role reads on screen — one map for the dashboard, the team page and the store switcher. */
export const TENANT_ROLE_LABELS: Readonly<Record<MembershipRole, string>> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};
