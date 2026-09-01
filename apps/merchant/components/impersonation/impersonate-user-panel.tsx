"use client";

import type { AdminUserDetail } from "@workspace/shared";
import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";
import { useAuth } from "@workspace/client/lib/auth";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { useQueryClient } from "@tanstack/react-query";
import { UserRoundSearch } from "lucide-react";
import * as React from "react";

/** Super-admin panel to impersonate users from the merchant portal. */
export function ImpersonateUserPanel(): React.JSX.Element | null {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const meQuery = api.auth.me.useQuery(undefined);
	const permissionsQuery = api.auth.permissions.useQuery(undefined);

	const [search, setSearch] = React.useState<string>("");
	const [page, setPage] = React.useState<number>(1);

	const currentUser = meQuery.data?.data;
	const session = permissionsQuery.data?.data;
	const isImpersonating = session?.isImpersonating === true;
	const canLoadUsers = meQuery.isSuccess && permissionsQuery.isSuccess && currentUser?.isSuperAdmin === true && !isImpersonating;

	const usersQuery = api.auth.adminUsers.useQuery({ page, limit: 10, search: search.length > 0 ? search : undefined }, { enabled: canLoadUsers });

	const impersonateMutation = api.auth.impersonate.useMutation({
		onSuccess: async (): Promise<void> => {
			await invalidateSessionAuth(queryClient);
		},
	});

	if (currentUser?.isSuperAdmin !== true || isImpersonating) {
		return null;
	}

	const users: readonly AdminUserDetail[] = usersQuery.data?.data ?? [];

	return (
		<div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
			<div className="flex items-center gap-2 text-sm font-semibold">
				<UserRoundSearch className="size-4" aria-hidden="true" />
				Impersonate merchant user
			</div>
			<div className="mt-4 space-y-3">
				<Input placeholder="Search users…" value={search} onChange={(e): void => setSearch(e.target.value)} aria-label="Search users" />
				<ul className="divide-y rounded-md border">
					{users.map((user) => (
						<li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
							<div className="min-w-0">
								<p className="truncate font-medium">{user.fullName}</p>
								<p className="truncate text-xs text-muted-foreground">{user.email}</p>
							</div>
							{user.isActive && !user.isSuperAdmin && user.id !== currentUser?.id ? (
								<Button size="sm" variant="outline" disabled={impersonateMutation.isPending} onClick={(): void => void impersonateMutation.mutateAsync({ userId: user.id })}>
									Impersonate
								</Button>
							) : null}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
