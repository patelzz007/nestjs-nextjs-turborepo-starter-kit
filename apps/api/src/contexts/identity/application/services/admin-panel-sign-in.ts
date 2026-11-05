import type { UserPermissions } from "@workspace/shared";

import type { UserGrantsReadPort } from "../../../../platform/application/ports/authorization.port";
import type { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { InvalidCredentialsError } from "../../domain/errors/identity.errors";
import { hasAdminAccess } from "./user-response.assembler";

/** The client type of the admin panel's sign-ins (`X-Client-Type: admin`). */
const ADMIN_CLIENT_TYPE = "admin";

/**
 * The admin panel's sign-in gate, shared by every sign-in method (password, passkey): an account without
 * dashboard access gets the uniform `INVALID_CREDENTIALS` — the same answer as a wrong credential, so the
 * admin login reveals nothing about which accounts exist or what they may do (no capability probing).
 */
export async function assertAdminPanelSignIn(clientType: string | null | undefined, account: UserAccount, grants: UserGrantsReadPort): Promise<void> {
	if (clientType !== ADMIN_CLIENT_TYPE || account.isSuperAdmin) {
		return;
	}
	const permissions: UserPermissions = await grants.getUserPermissionDetails(account.id);
	if (!hasAdminAccess(account, permissions)) {
		throw new InvalidCredentialsError();
	}
}
