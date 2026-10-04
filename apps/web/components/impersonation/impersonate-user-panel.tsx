"use client";

import { useWebSession } from "@/components/auth/web-authorization-provider";
import { PERMISSION, type AdminUserDetail, type CapabilitySlug } from "@workspace/shared";
import { readPaginatedHasNext, readPaginatedNextCursor } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { useImpersonation } from "@workspace/client/lib/auth/session/use-impersonation";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { useRouter } from "next/navigation";
import { UserRoundSearch } from "lucide-react";
import * as React from "react";

/**
 * Capabilities the impersonation endpoints enforce (besides `@SuperAdminOnly`):
 * `GET /auth/admin/users` → `LIST USER`, `POST /auth/impersonate/:userId` → `CREATE USER`.
 */
export const IMPERSONATION_PERMISSIONS: readonly CapabilitySlug[] = [PERMISSION.USER.LIST, PERMISSION.USER.CREATE];

/**
 * Container gate for the impersonation panel — hidden unless the signed-in
 * user is a super-admin holding every capability the endpoints require and is
 * not already impersonating.
 */
/** Shared empty list, so "no answer yet" keeps one identity across renders. */
const NO_USERS: readonly AdminUserDetail[] = [];

export function ImpersonateUserPanel(): React.JSX.Element | null {
	const { user } = useAuth();
	const { session } = useWebSession();
	const { canAll } = useAuthorization();

	const currentUserId = user?.id;
	const isImpersonating = session?.isImpersonating === true;
	const allowed = user?.isSuperAdmin === true && !isImpersonating && canAll(IMPERSONATION_PERMISSIONS);

	if (!allowed || currentUserId === undefined) {
		return null;
	}

	return <ImpersonateUserList currentUserId={currentUserId} />;
}

/** Super-admin panel to impersonate a user from the web app (uses web session cookies). */
function ImpersonateUserList({ currentUserId }: { readonly currentUserId: string }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [search, setSearch] = React.useState<string>("");
	const [cursor, setCursor] = React.useState<string | null>(null);
	const [cursorHistory, setCursorHistory] = React.useState<readonly (string | null)[]>([null]);

	const usersQuery = api.auth.adminUsers.useQuery({
		page: 1,
		limit: 10,
		...(cursor !== null ? { cursor } : {}),
		...(search.length > 0 ? { search } : {}),
	});

	const handleIdentityChanged = React.useCallback((): void => {
		router.refresh();
	}, [router]);
	const impersonation = useImpersonation({ onIdentityChanged: handleIdentityChanged });
	const { requestStart } = impersonation;
	const listedUsers = usersQuery.data?.data;
	const users = React.useMemo((): readonly AdminUserDetail[] => listedUsers ?? NO_USERS, [listedUsers]);

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearch(event.target.value);
		setCursor(null);
		setCursorHistory([null]);
	}, []);

	const handleImpersonate = React.useCallback(
		(userId: string): void => {
			const target = users.find((candidate: AdminUserDetail): boolean => candidate.id === userId);
			if (target !== undefined) {
				requestStart({ userId: target.id, label: target.email });
			}
		},
		[requestStart, users],
	);

	const handleImpersonateClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const userId = event.currentTarget.dataset.userId;
			if (userId !== undefined) {
				handleImpersonate(userId);
			}
		},
		[handleImpersonate],
	);

	const nextCursor = readPaginatedNextCursor(usersQuery.data?.meta);
	const hasNext = readPaginatedHasNext(usersQuery.data?.meta, false);
	const hasPrevious = cursorHistory.length > 1;

	const handlePreviousPage = React.useCallback((): void => {
		if (cursorHistory.length <= 1) {
			return;
		}
		const nextHistory = cursorHistory.slice(0, -1);
		setCursorHistory(nextHistory);
		setCursor(nextHistory[nextHistory.length - 1] ?? null);
	}, [cursorHistory]);

	const handleNextPage = React.useCallback((): void => {
		if (nextCursor === null) {
			return;
		}
		setCursorHistory((history) => [...history, nextCursor]);
		setCursor(nextCursor);
	}, [nextCursor]);

	return (
		<div className="rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
			{impersonation.confirmDialog}
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
					<ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
						{users.map((user: AdminUserDetail) => {
							const canImpersonate = user.isActive && !user.isSuperAdmin && user.id !== currentUserId;
							return (
								<li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
									<div className="min-w-0">
										<p className="truncate font-medium">{user.fullName}</p>
										<p className="truncate text-xs text-muted-foreground">{user.email}</p>
									</div>
									{canImpersonate ? (
										<Button size="sm" variant="outline" disabled={impersonation.isPending} data-user-id={user.id} onClick={handleImpersonateClick}>
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

				{hasPrevious || hasNext ? (
					<div className="flex items-center justify-between text-sm">
						<Button size="sm" variant="ghost" disabled={!hasPrevious} onClick={handlePreviousPage}>
							Previous
						</Button>
						<span className="text-muted-foreground">{users.length} users</span>
						<Button size="sm" variant="ghost" disabled={!hasNext} onClick={handleNextPage}>
							Next
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}
