"use client";

import type { AdminUserDetail } from "@workspace/shared";
import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";
import { useAuth } from "@workspace/client/lib/auth";
import { UserDetailButton } from "@/components/users/user-detail-button";
import { useQueryClient } from "@tanstack/react-query";
import { UserRoundSearch } from "lucide-react";
import * as React from "react";

export interface ImpersonateUserButtonProps {
	readonly targetUser: AdminUserDetail;
}

/**
 * Super-admin action to impersonate a non-super-admin user from the detail page.
 */
export function ImpersonateUserButton({ targetUser }: ImpersonateUserButtonProps): React.JSX.Element | null {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const meQuery = api.auth.me.useQuery(undefined);
	const permissionsQuery = api.auth.permissions.useQuery(undefined);

	const impersonateMutation = api.auth.impersonate.useMutation({
		onSuccess: async (): Promise<void> => {
			await invalidateSessionAuth(queryClient);
		},
	});

	const currentUser = meQuery.data?.data;
	const session = permissionsQuery.data?.data;
	const isImpersonating = session?.isImpersonating === true;

	const canImpersonate = currentUser?.isSuperAdmin === true && !targetUser.isSuperAdmin && targetUser.isActive && targetUser.id !== currentUser.id && !isImpersonating;

	const handleImpersonate = React.useCallback((): void => {
		void impersonateMutation.mutateAsync({ userId: targetUser.id });
	}, [impersonateMutation, targetUser.id]);

	if (!canImpersonate) {
		return null;
	}

	return (
		<UserDetailButton disabled={impersonateMutation.isPending} onClick={handleImpersonate}>
			<UserRoundSearch className="size-4" aria-hidden="true" />
			{impersonateMutation.isPending ? "Starting…" : "Impersonate user"}
		</UserDetailButton>
	);
}
