"use client";

import { permissionKey, actionLabel, samePermission, TENANT_PERMISSION_GROUPS, groupPermissions } from "@/contexts/tenancy/lib/access/permission-labels";
import { tenantDisplayRegion } from "@/contexts/tenancy/lib/access/grant-duration";
import { tenantRoutes } from "@/lib/routes";
import type { PermissionPair } from "@workspace/shared";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { cn } from "@workspace/ui/lib/core/utils";
import Link from "next/link";
import * as React from "react";

/**
 * The building blocks of the access screens (ADR 067). Each is controlled and data-agnostic: the page
 * views own the queries and mutations and hand these plain values.
 */

/** The role and member sub-pages' way back to Team & permissions (the roles open on their tab). */
export function TeamBackLink({ tenantSlug, tab = "members" }: { readonly tenantSlug: string; readonly tab?: "members" | "roles" }): React.JSX.Element {
	const href = `${tenantRoutes(tenantSlug).settings.team}${tab === "roles" ? "?tab=roles" : ""}`;
	return (
		<Link href={href} className="inline-flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
			← Team &amp; permissions
		</Link>
	);
}

export interface AccessExpiryProps {
	/** When it stops (epoch ms), or `null` for a permanent grant or share. */
	readonly expiresAt: number | null;
	/** The tenant's zone, for the absolute time in the tooltip. */
	readonly timeZone: string;
	readonly className?: string;
}

/** "Permanent", or "Ends in 47 hours" (kept current; the exact time is the tooltip). */
export function AccessExpiry({ expiresAt, timeZone, className }: AccessExpiryProps): React.JSX.Element {
	if (expiresAt === null) {
		return <span className={cn("text-sm text-muted-foreground", className)}>Permanent</span>;
	}
	return (
		<span className={cn("text-sm text-muted-foreground", className)}>
			Ends <RelativeTime epochMs={expiresAt} region={tenantDisplayRegion(timeZone)} />
		</span>
	);
}

export interface PermissionChecklistProps {
	/** Unique id prefix for the checkboxes (two lists on one page never share ids). */
	readonly idPrefix: string;
	readonly selected: readonly PermissionPair[];
	readonly onToggle: (permission: PermissionPair, checked: boolean) => void;
	readonly disabled?: boolean;
	/** Permissions the caller may not hand out (not in their own role): shown, but locked. */
	readonly isLocked?: (permission: PermissionPair) => boolean;
}

/** Every tenant permission, grouped by what it is about, each a labelled checkbox (controlled). */
export function PermissionChecklist({ idPrefix, selected, onToggle, disabled = false, isLocked }: PermissionChecklistProps): React.JSX.Element {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{TENANT_PERMISSION_GROUPS.map((group) => (
				<fieldset key={group.resource} className="space-y-2 rounded-lg border border-border bg-card p-4">
					<legend className="px-1 text-sm font-semibold text-foreground">{group.label}</legend>
					{group.permissions.map((permission) => (
						<PermissionCheckbox
							key={permissionKey(permission)}
							id={`${idPrefix}-${permissionKey(permission)}`}
							permission={permission}
							checked={selected.some((held) => samePermission(held, permission))}
							disabled={disabled || (isLocked?.(permission) ?? false)}
							onToggle={onToggle}
						/>
					))}
				</fieldset>
			))}
		</div>
	);
}

interface PermissionCheckboxProps {
	readonly id: string;
	readonly permission: PermissionPair;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onToggle: (permission: PermissionPair, checked: boolean) => void;
}

function PermissionCheckbox({ id, permission, checked, disabled, onToggle }: PermissionCheckboxProps): React.JSX.Element {
	// A locked or disabled permission never reports a toggle, whatever event reaches it.
	const handleChange = React.useCallback(
		(next: boolean): void => {
			if (!disabled) {
				onToggle(permission, next);
			}
		},
		[disabled, onToggle, permission],
	);
	return (
		<div className="flex items-center gap-3">
			<Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={handleChange} />
			<label htmlFor={id} className={cn("text-sm", disabled ? "text-muted-foreground" : "text-foreground")}>
				{actionLabel(permission.action)}
			</label>
		</div>
	);
}

export interface PermissionSummaryProps {
	readonly permissions: readonly PermissionPair[];
}

/** A role's permissions, read-only and grouped ("Rewards: View, Edit"). */
export function PermissionSummary({ permissions }: PermissionSummaryProps): React.JSX.Element {
	if (permissions.length === 0) {
		return <p className="text-sm text-muted-foreground">This role gives no permissions yet.</p>;
	}
	return (
		<dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
			{groupPermissions(permissions).map((group) => (
				<div key={group.resource} className="space-y-0.5">
					<dt className="text-sm font-medium text-foreground">{group.label}</dt>
					<dd className="text-sm text-muted-foreground">{group.permissions.map((permission) => actionLabel(permission.action)).join(", ")}</dd>
				</div>
			))}
		</dl>
	);
}
