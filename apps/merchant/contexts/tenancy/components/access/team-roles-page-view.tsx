"use client";

import { tenantRoutes } from "@/lib/routes";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { TenantRoleResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface TeamRolesPageViewProps {
	readonly tenantSlug: string;
}

/** "Copied from the Manager template", or "Created by your team". */
export function roleOriginLabel(role: Pick<TenantRoleResponse, "templateKey">): string {
	return role.templateKey === null ? "Created by your team" : "Standard role";
}

/** "12 permissions · 3 members", singular when one. */
export function roleCountsLabel(role: Pick<TenantRoleResponse, "permissions" | "holderCount">): string {
	const permissions = role.permissions.length === 1 ? "1 permission" : `${String(role.permissions.length)} permissions`;
	const members = role.holderCount === 1 ? "1 member" : `${String(role.holderCount)} members`;
	return `${permissions} · ${members}`;
}

/** The tenant's roles (ADR 067) — its copies of Owner, Manager and Cashier, and any it created — as the Roles tab lists them. */
export function TeamRolesList({ tenantSlug }: TeamRolesPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const rolesQuery = api.tenantAccess.roles.useQuery({ tenantSlug });
	const routes = tenantRoutes(tenantSlug).settings.teamRoles;
	const roles = rolesQuery.data?.data ?? [];
	const { refetch } = rolesQuery;
	const handleRetry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	return (
		<div className="space-y-4">
			<Card className="gap-3 p-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-0.5">
						<h3 className="text-base font-semibold text-foreground">Roles</h3>
						<p className="text-sm text-muted-foreground">Edit a role and everyone holding it changes at once.</p>
					</div>
					<Link href={routes.new} className={buttonVariants({ size: "sm" })}>
						New role
					</Link>
				</div>
				{rolesQuery.isLoading ? (
					<div aria-busy="true" aria-label="Loading roles" className="space-y-3">
						<Skeleton className="h-16 w-full rounded-lg" />
						<Skeleton className="h-16 w-full rounded-lg" />
						<Skeleton className="h-16 w-full rounded-lg" />
					</div>
				) : rolesQuery.isError ? (
					<div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm text-destructive">
						<span>{resolveAuthErrorMessage(rolesQuery.error)}</span>
						<Button type="button" variant="outline" size="sm" onClick={handleRetry}>
							Try again
						</Button>
					</div>
				) : (
					<ul className="space-y-3">
						{roles.map((role) => (
							<li key={role.id}>
								<Link
									href={routes.detail(role.id)}
									className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
									<span className="min-w-0 space-y-1">
										<span className="flex flex-wrap items-center gap-2">
											<span className="font-medium text-foreground">{role.name}</span>
											<Badge variant={role.templateKey === null ? "outline" : "secondary"}>{roleOriginLabel(role)}</Badge>
										</span>
										<span className="block text-sm text-muted-foreground">{roleCountsLabel(role)}</span>
									</span>
									<ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
								</Link>
							</li>
						))}
					</ul>
				)}
			</Card>
		</div>
	);
}
