"use client";

import type { AdminUserDetail } from "@workspace/shared";
import { ApiPaginatedMetaSchema } from "@workspace/shared";
import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";
import { useAuth } from "@workspace/client/lib/auth";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { useQueryClient } from "@tanstack/react-query";
import { UserRoundSearch } from "lucide-react";
import * as React from "react";

/**
 * Super-admin panel to impersonate a user from the web app (uses web session cookies).
 */
export function ImpersonateUserPanel({ sessionActive }: { readonly sessionActive: boolean }): React.JSX.Element | null {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const meQuery = api.auth.me.useQuery(undefined, { enabled: sessionActive });
	const permissionsQuery = api.auth.permissions.useQuery(undefined, { enabled: sessionActive });

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

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearch(event.target.value);
		setPage(1);
	}, []);

	const handleImpersonate = React.useCallback(
		(userId: string): void => {
			void impersonateMutation.mutateAsync({ userId });
		},
		[impersonateMutation],
	);

	if (currentUser?.isSuperAdmin !== true || isImpersonating) {
		return null;
	}

	const users: readonly AdminUserDetail[] = usersQuery.data?.data ?? [];
	const metaParsed = ApiPaginatedMetaSchema.safeParse(usersQuery.data?.meta);
	const totalPages: number = metaParsed.success && metaParsed.data.totalPages !== null ? metaParsed.data.totalPages : 1;

	return (
		<div className="rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
			<div className="flex items-center gap-2 text-sm font-semibold">
				<UserRoundSearch className="size-4" aria-hidden="true" />
				Impersonate user
			</div>
			<p className="mt-1 text-xs text-muted-foreground">Super-admin only. Switches your web session to the selected user.</p>

			<div className="mt-4 space-y-4">
				<Input placeholder="Search by name or email…" value={search} onChange={handleSearchChange} aria-label="Search users" />

				{usersQuery.isLoading ? (
					<p className="text-sm text-muted-foreground">Loading users…</p>
				) : users.length === 0 ? (
					<p className="text-sm text-muted-foreground">No users found.</p>
				) : (
					<ul className="divide-y rounded-md border">
						{users.map((user: AdminUserDetail) => {
							const canImpersonate = user.isActive && !user.isSuperAdmin && user.id !== currentUser.id;
							return (
								<li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
									<div className="min-w-0">
										<p className="truncate font-medium">{user.fullName}</p>
										<p className="truncate text-xs text-muted-foreground">{user.email}</p>
									</div>
									{canImpersonate ? (
										<Button size="sm" variant="outline" disabled={impersonateMutation.isPending} onClick={(): void => handleImpersonate(user.id)}>
											Impersonate
										</Button>
									) : (
										<span className="text-xs text-muted-foreground">—</span>
									)}
								</li>
							);
						})}
					</ul>
				)}

				{totalPages > 1 ? (
					<div className="flex items-center justify-between text-sm">
						<Button size="sm" variant="ghost" disabled={page <= 1} onClick={(): void => setPage((prev: number) => Math.max(1, prev - 1))}>
							Previous
						</Button>
						<span className="text-muted-foreground">
							Page {page} of {totalPages}
						</span>
						<Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={(): void => setPage((prev: number) => prev + 1)}>
							Next
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}
