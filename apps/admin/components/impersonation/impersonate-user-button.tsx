"use client";

import type { AdminUserDetail } from "@workspace/shared";
import { useAuth } from "@workspace/client/lib/auth";
import { useImpersonation } from "@workspace/client/lib/auth/session/use-impersonation";
import { UserDetailButton } from "@/components/users/user-detail-button";
import { useCanStartImpersonation } from "@/lib/session/super-admin";
import { useRouter } from "next/navigation";
import { UserRoundSearch } from "lucide-react";
import * as React from "react";

export interface ImpersonateUserButtonProps {
	readonly targetUser: AdminUserDetail;
}

/**
 * Super-admin action to impersonate a non-super-admin user from the detail page.
 * `POST /auth/impersonate/:userId` is `@SuperAdminOnly`, so the super-admin
 * session flag (not a capability) gates it.
 */
export function ImpersonateUserButton({ targetUser }: ImpersonateUserButtonProps): React.JSX.Element | null {
	const { user: currentUser } = useAuth();
	const router = useRouter();
	const canStartImpersonation = useCanStartImpersonation();
	const handleIdentityChanged = React.useCallback((): void => {
		router.refresh();
	}, [router]);
	const impersonation = useImpersonation({ onIdentityChanged: handleIdentityChanged });

	const canImpersonate = canStartImpersonation && !targetUser.isSuperAdmin && targetUser.isActive && targetUser.id !== currentUser?.id;

	const { requestStart } = impersonation;
	const handleImpersonate = React.useCallback((): void => {
		requestStart({ userId: targetUser.id, label: targetUser.email });
	}, [requestStart, targetUser.email, targetUser.id]);

	if (!canImpersonate) {
		return null;
	}

	return (
		<>
			<UserDetailButton disabled={impersonation.isPending} onClick={handleImpersonate}>
				<UserRoundSearch className="size-4" aria-hidden="true" />
				{impersonation.isPending ? "Starting…" : "Impersonate user"}
			</UserDetailButton>
			{impersonation.confirmDialog}
		</>
	);
}
