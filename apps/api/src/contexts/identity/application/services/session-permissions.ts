import type { CapabilitySlug, SessionPermissionsResponse, UserPermissions } from "@workspace/shared";

import type { AccountView } from "../ports/identity-read.port";
import { hasAdminAccess } from "./user-response.assembler";

/** The cached `/auth/permissions` base payload of a full session. */
export function buildSessionPermissions(account: AccountView, permissions: UserPermissions, capabilities: readonly CapabilitySlug[]): SessionPermissionsResponse {
	return {
		roles: permissions.roles,
		permissions: permissions.permissions,
		capabilities: [...capabilities],
		tokenVersion: account.tokenVersion,
		hasAdminAccess: hasAdminAccess(account, permissions),
		sessionScope: "full",
	};
}
