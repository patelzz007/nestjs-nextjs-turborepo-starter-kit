"use client";

import { PERMISSION, type AdminUserDetail, type CapabilitySlug } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { useRouter } from "next/navigation";
import { UserRoundSearch } from "lucide-react";
import * as React from "react";

import { readPaginatedHasNext, readPaginatedNextCursor } from "../../../api/envelope";
import { useAuthorization } from "../../authorization/index";
import { useAuth } from "../index";
import { useImpersonation } from "../session/use-impersonation";
import { IMPERSONATE_USER_PANEL_LABELS, type ImpersonateUserPanelLabels } from "./impersonate-user-panel-labels";
import { ImpersonationUsersSkeleton } from "./impersonation-users-skeleton";

/** Users one page of the panel lists. */
const USERS_PAGE_SIZE = 10;

/**
 * Capabilities the impersonation endpoints enforce (besides `@SuperAdminOnly`):
 * `GET /auth/admin/users` → `LIST USER`, `POST /auth/impersonate/:userId` → `CREATE USER`.
 */
export const IMPERSONATION_PERMISSIONS: readonly CapabilitySlug[] = [PERMISSION.USER.LIST, PERMISSION.USER.CREATE];

/** Shared empty list, so "no answer yet" keeps one identity across renders. */
const NO_USERS: readonly AdminUserDetail[] = [];

export interface ImpersonateUserPanelProps {
	/** Whether the current session already impersonates someone (each app reads it from its own session). */
	readonly isImpersonating: boolean;
	readonly labels?: ImpersonateUserPanelLabels;
}

/**
 * Super-admin impersonation for any app: hidden unless the signed-in user is a super-admin holding every
 * capability the endpoints require and is not already impersonating. Lists users page by page with a
 * search; impersonating switches this app's session and refreshes the route.
 */
export function ImpersonateUserPanel({ isImpersonating, labels = IMPERSONATE_USER_PANEL_LABELS }: ImpersonateUserPanelProps): React.JSX.Element | null {
	const { user } = useAuth();
	const { canAll } = useAuthorization();

	const currentUserId = user?.id;
	const allowed = user?.isSuperAdmin === true && !isImpersonating && canAll(IMPERSONATION_PERMISSIONS);

	if (!allowed || currentUserId === undefined) {
		return null;
	}

	return <ImpersonateUserList currentUserId={currentUserId} labels={labels} />;
}

/** The user list itself, rendered only once the gate passed (so it never queries the users for anyone else). */
function ImpersonateUserList({ currentUserId, labels }: { readonly currentUserId: string; readonly labels: ImpersonateUserPanelLabels }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [search, setSearch] = React.useState<string>("");
	const [cursor, setCursor] = React.useState<string | null>(null);
	const [cursorHistory, setCursorHistory] = React.useState<readonly (string | null)[]>([null]);

	const usersQuery = api.auth.adminUsers.useQuery({
		page: 1,
		limit: USERS_PAGE_SIZE,
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
		setCursor(nextHistory.at(-1) ?? null);
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
				{labels.title}
			</div>
			<p className="mt-1 text-xs text-muted-foreground">{labels.description}</p>

			<div className="mt-4 space-y-4">
				<Input placeholder={labels.searchPlaceholder} value={search} onChange={handleSearchChange} aria-label={labels.searchLabel} />

				{usersQuery.isLoading ? (
					<ImpersonationUsersSkeleton loadingLabel={labels.loading} />
				) : users.length === 0 ? (
					<p className="text-sm text-muted-foreground">{labels.empty}</p>
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
											{labels.impersonate}
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
							{labels.previous}
						</Button>
						<span className="text-muted-foreground">{labels.pageCount(users.length)}</span>
						<Button size="sm" variant="ghost" disabled={!hasNext} onClick={handleNextPage}>
							{labels.next}
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}
