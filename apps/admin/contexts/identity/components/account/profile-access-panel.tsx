import type { SlimRoleResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type { AccessSummary } from "@/contexts/identity/lib/account/access-summary";
import { formatCount } from "@/lib/format/numbers";
import { ROUTES } from "@/lib/routes";

export interface ProfileAccessPanelProps {
	readonly roles: readonly SlimRoleResponse[];
	readonly access: AccessSummary;
	readonly className?: string;
}

/**
 * What the signed-in admin's roles let them do: each role with its
 * description, the areas their permissions cover, and the way to their
 * sign-in security. Read-only — roles are granted by another admin.
 */
export function ProfileAccessPanel({ roles, access, className }: ProfileAccessPanelProps): React.JSX.Element {
	const permissionWord = access.permissionCount === 1 ? "permission" : "permissions";
	const areaWord = access.areas.length === 1 ? "area" : "areas";
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Your access</CardTitle>
				<CardDescription>Roles are granted by another admin.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				{roles.length === 0 ? (
					<p className="text-sm text-muted-foreground">You have no roles yet.</p>
				) : (
					<ul className="flex flex-col gap-3">
						{roles.map((role: SlimRoleResponse): React.JSX.Element => (
							<li key={role.id} className="flex items-start gap-3">
								<IconTile tone="neutral" size="sm" className="rounded-lg">
									<ShieldCheck />
								</IconTile>
								<div className="min-w-0">
									<p className="text-sm font-medium">{role.name}</p>
									{role.description === null ? null : <p className="text-sm text-muted-foreground">{role.description}</p>}
								</div>
							</li>
						))}
					</ul>
				)}
				<div className="flex flex-col gap-2">
					<p className="text-sm">
						<span className="font-medium tabular-nums">{formatCount(access.permissionCount)}</span> {permissionWord} across{" "}
						<span className="font-medium tabular-nums">{formatCount(access.areas.length)}</span> {areaWord}
					</p>
					{access.areas.length === 0 ? null : (
						<ul className="flex flex-wrap gap-1.5" aria-label="Areas you can work in">
							{access.areas.map((area: string): React.JSX.Element => (
								<li key={area}>
									<Badge variant="outline">{area}</Badge>
								</li>
							))}
						</ul>
					)}
				</div>
			</CardContent>
			<CardFooter>
				<Link href={ROUTES.account.security} className={buttonVariants({ variant: "outline", className: "w-full gap-2" })}>
					<KeyRound className="size-4" aria-hidden="true" />
					Password and two-factor
				</Link>
			</CardFooter>
		</Card>
	);
}
