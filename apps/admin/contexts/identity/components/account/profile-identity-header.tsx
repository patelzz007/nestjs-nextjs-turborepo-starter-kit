import type { OwnProfile, SlimRoleResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { UserAvatar } from "@workspace/ui/components/user-avatar";
import * as React from "react";

import { formatCount } from "@/lib/format/numbers";
import { formatDate, formatDateTime } from "@/lib/format/dates";

/** The avatar's drawn width (CSS px) — `size-22` — so the sharpest small rendition is picked. */
const AVATAR_DRAWN_SIZE = 88;

export interface ProfileIdentityHeaderProps {
	readonly profile: Pick<OwnProfile, "fullName" | "email" | "avatar" | "createdAt" | "updatedAt">;
	readonly roles: readonly SlimRoleResponse[];
	readonly permissionCount: number;
	readonly isImpersonating: boolean;
}

interface Fact {
	readonly label: string;
	readonly value: string;
}

/**
 * The top of `/account/profile`: who the signed-in admin is to the platform —
 * picture, name, email and roles — then the facts about the account (member
 * since, last edited, how much access). Presentational: the view passes the
 * profile and the session's roles.
 */
export function ProfileIdentityHeader({ profile, roles, permissionCount, isImpersonating }: ProfileIdentityHeaderProps): React.JSX.Element {
	const facts: readonly Fact[] = [
		{ label: "Member since", value: formatDate(profile.createdAt) },
		{ label: "Last edited", value: formatDateTime(profile.updatedAt) },
		{ label: "Permissions", value: formatCount(permissionCount) },
	];
	return (
		<header className="flex flex-col gap-6" aria-label="Your account">
			<div className="flex flex-col gap-5 sm:flex-row sm:items-center">
				<UserAvatar
					name={profile.fullName}
					image={profile.avatar}
					drawnSize={AVATAR_DRAWN_SIZE}
					className="size-22 shrink-0 shadow-sm ring-4 ring-card"
					fallbackClassName="bg-primary text-2xl font-semibold text-primary-foreground"
				/>
				<div className="flex min-w-0 flex-col gap-2">
					<h2 className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">{profile.fullName}</h2>
					<p className="truncate text-sm text-muted-foreground">{profile.email}</p>
					<ul className="flex flex-wrap gap-1.5" aria-label="Your roles">
						{roles.map((role: SlimRoleResponse): React.JSX.Element => (
							<li key={role.id}>
								<Badge variant="primary-light">{role.name}</Badge>
							</li>
						))}
						{isImpersonating ? (
							<li>
								<StatusBadge tone="warning">Impersonating</StatusBadge>
							</li>
						) : null}
					</ul>
				</div>
			</div>
			<dl className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
				{facts.map((fact: Fact): React.JSX.Element => (
					<div key={fact.label} className="flex flex-col gap-1 px-5 py-4">
						<dt className="text-xs text-muted-foreground">{fact.label}</dt>
						<dd className="text-sm font-medium tabular-nums">{fact.value}</dd>
					</div>
				))}
			</dl>
		</header>
	);
}
