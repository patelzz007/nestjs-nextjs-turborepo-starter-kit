"use client";

import { orgRoutes } from "@/lib/routes";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import Link from "next/link";
import type { JSX } from "react";

interface SettingsLinkCardProps {
	readonly title: string;
	readonly description: string;
	readonly href: string;
	readonly actionLabel: string;
}

function SettingsLinkCard({ title, description, href, actionLabel }: SettingsLinkCardProps): JSX.Element {
	return (
		<div className="rounded-xl border bg-card p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<p className="font-medium">{title}</p>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				<Link href={href} className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
					{actionLabel}
				</Link>
			</div>
		</div>
	);
}

export interface OrganizationSettingsIndexViewProps {
	readonly orgSlug: string;
}

/**
 * Organization settings index. Each card shows only with the capability its
 * destination page requires (`ORG_PAGE_RULES`) — the page re-checks on the
 * server and the API stays authoritative; hiding a card is only a convenience.
 */
export function OrganizationSettingsIndexView({ orgSlug }: OrganizationSettingsIndexViewProps): JSX.Element {
	const { can } = useAuthorization();
	const canManageTeam = can(MERCHANT_CAPABILITY.manageTeam);
	const canViewLocations = can(MERCHANT_CAPABILITY.viewLocations);
	const canManageVerification = can(MERCHANT_CAPABILITY.manageVerification);
	const routes = orgRoutes(orgSlug);

	return (
		<div className="space-y-8">
			<AnalyticsPageHeader title="Organization settings" description="Configure your team, store locations, and business verification." />
			{canManageTeam ? (
				<SettingsLinkCard
					title="Team & access"
					description="Invite members, manage roles, and review access requests."
					href={routes.settings.team}
					actionLabel="Manage team"
				/>
			) : null}
			{canViewLocations ? (
				<SettingsLinkCard
					title="Store locations"
					description="View every store site under this organization and your location access scope."
					href={routes.settings.locations}
					actionLabel="View locations"
				/>
			) : null}
			{canManageVerification ? (
				<SettingsLinkCard
					title="Business verification (KYB)"
					description="Review your KYB submission and update details or documents while verification is pending."
					href={routes.settings.verification}
					actionLabel="View verification"
				/>
			) : null}
			<p className="text-sm text-muted-foreground">
				Your own email, password, and two-factor authentication live on{" "}
				<Link href={routes.account} className="font-medium text-primary hover:underline">
					Account
				</Link>
				.
			</p>
		</div>
	);
}
