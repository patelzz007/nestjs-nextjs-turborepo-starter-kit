"use client";

import type { AdminUserDetail } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { formatDateTimeWithSeconds } from "@/lib/dates";
import * as React from "react";

export interface UserProfileFieldProps {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
}

export const UserProfileField = React.forwardRef<HTMLDivElement, UserProfileFieldProps>(function UserProfileField({ label, value, mono = false }, ref): React.JSX.Element {
	return (
		<div ref={ref} className="space-y-1">
			<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
			<dd className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
		</div>
	);
});

export interface UserProfileSectionProps {
	readonly title: string;
	readonly description?: string;
	readonly children: React.ReactNode;
}

export const UserProfileSection = React.forwardRef<HTMLDivElement, UserProfileSectionProps>(function UserProfileSection(
	{ title, description, children },
	ref,
): React.JSX.Element {
	return (
		<section ref={ref} className="space-y-3">
			<div>
				<h3 className="text-sm font-semibold text-foreground">{title}</h3>
				{description !== undefined ? <p className="text-xs text-muted-foreground">{description}</p> : null}
			</div>
			<dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
		</section>
	);
});

export interface UserProfileOverviewProps {
	readonly user: AdminUserDetail;
}

function formatLockedUntil(lockedUntil: AdminUserDetail["lockedUntil"]): string {
	if (lockedUntil === null) {
		return "Not locked";
	}
	return formatDateTimeWithSeconds(lockedUntil);
}

function formatOptionalTimestamp(value: AdminUserDetail["deletedAt"]): string {
	if (value === null) {
		return "—";
	}
	return formatDateTimeWithSeconds(value);
}

/**
 * Read-only overview of all admin user detail fields (identity, status, security, audit).
 */
export const UserProfileOverview = React.forwardRef<HTMLDivElement, UserProfileOverviewProps>(function UserProfileOverview({ user }, ref): React.JSX.Element {
	return (
		<div ref={ref}>
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">User profile</CardTitle>
					<CardDescription>Identity, account status, security, and audit metadata for this user.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-8">
					<UserProfileSection title="Identity">
						<UserProfileField label="Full name" value={user.fullName} />
						<UserProfileField label="Email" value={user.email} />
						<UserProfileField label="User ID" value={user.id} mono />
					</UserProfileSection>

					<UserProfileSection title="Account status" description="How the account behaves in the product and admin panel.">
						<UserProfileField label="Active" value={user.isActive ? "Yes" : "No"} />
						<UserProfileField label="Email verified" value={user.isEmailVerified ? "Yes" : "No"} />
						<UserProfileField label="Super admin" value={user.isSuperAdmin ? "Yes" : "No"} />
						<UserProfileField label="Admin panel access" value={user.hasAdminAccess ? "Yes" : "No"} />
						<UserProfileField label="Soft deleted" value={user.isDeleted ? "Yes" : "No"} />
						<UserProfileField label="Deleted at" value={formatOptionalTimestamp(user.deletedAt)} />
					</UserProfileSection>

					<UserProfileSection title="Security" description="Lockout state and session invalidation version.">
						<UserProfileField label="Failed login attempts" value={String(user.failedLoginAttempts)} />
						<UserProfileField label="Locked until" value={formatLockedUntil(user.lockedUntil)} />
						<UserProfileField label="Token version" value={String(user.tokenVersion)} mono />
					</UserProfileSection>

					<UserProfileSection title="Audit">
						<UserProfileField label="Created" value={formatDateTimeWithSeconds(user.createdAt)} />
						<UserProfileField label="Last updated" value={formatDateTimeWithSeconds(user.updatedAt)} />
					</UserProfileSection>
				</CardContent>
			</Card>
		</div>
	);
});
