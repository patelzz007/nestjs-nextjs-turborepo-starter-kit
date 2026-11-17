"use client";

import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PERMISSION } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { formatWhen, ROLLOUT_UNIT_LABELS } from "../lib/release-labels";

/** `/releases/groups` (ADR 087): the reusable sets rules name — conditions, or a list of people or stores. */
export function FlagGroupsList(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const groups = api.featureFlags.groups.useQuery(undefined).data?.data.groups;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Flag groups</h1>
					<p className="text-sm text-muted-foreground">
						A named set many rules can share: either conditions (staff, one country&apos;s apps) or a list of people, merchants, branches or devices.
					</p>
				</div>
				{can(PERMISSION.FEATURE_FLAG_GROUP.UPDATE) ? (
					<Button render={<Link href={ROUTES.releases.groups.create} />} nativeButton={false}>
						<Plus className="size-4" />
						New group
					</Button>
				) : null}
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Groups</CardTitle>
					<CardDescription>A group a rule still names can&apos;t be removed.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					{groups === undefined ? (
						<Skeleton className="h-40 w-full rounded-xl" />
					) : groups.length === 0 ? (
						<p className="text-sm text-muted-foreground">No groups yet.</p>
					) : (
						<Table aria-label="Flag groups">
							<TableHeader>
								<TableRow>
									<TableHead>Group</TableHead>
									<TableHead>Kind</TableHead>
									<TableHead>Used by</TableHead>
									<TableHead>Last changed</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{groups.map((group): React.JSX.Element => (
									<TableRow key={group.id}>
										<TableCell>
											<Link href={ROUTES.releases.groups.detail(group.id)} className="font-medium hover:underline">
												{group.name}
											</Link>
											<p className="font-mono text-xs text-muted-foreground">{group.key}</p>
										</TableCell>
										<TableCell>
											{group.definition.kind === "LIST" ? (
												<StatusBadge tone="neutral">{`${String(group.memberCount)} ${ROLLOUT_UNIT_LABELS[group.definition.unit].toLowerCase()}${group.memberCount === 1 ? "" : "s"}`}</StatusBadge>
											) : (
												<StatusBadge tone="info">{`${String(group.definition.conditions.length)} condition${group.definition.conditions.length === 1 ? "" : "s"}`}</StatusBadge>
											)}
										</TableCell>
										<TableCell className="font-mono text-xs">{group.usedBy.length === 0 ? "—" : group.usedBy.map((usage) => usage.key).join(", ")}</TableCell>
										<TableCell className="whitespace-nowrap">{formatWhen(group.updatedAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
