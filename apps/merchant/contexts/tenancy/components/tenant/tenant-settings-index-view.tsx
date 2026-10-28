"use client";

import { tenantRoutes } from "@/lib/routes";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MERCHANT_CAPABILITY, PLATFORM_DISPLAY_REGION, type KybStatus, type TenantContextResponse, type TenantLifecycleState } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import Link from "next/link";
import type * as React from "react";
import type { JSX } from "react";

import { LeaveTenantCard } from "../lifecycle/leave-tenant-card";
import { SupportAccessApprovalsCard } from "../support-access/support-access-approvals-card";

/** The business's standing, in words, and the badge tone it reads in. */
export const LIFECYCLE_LABELS: Readonly<Record<TenantLifecycleState, { readonly label: string; readonly variant: React.ComponentProps<typeof Badge>["variant"] }>> = {
	PROVISIONING: { label: "Setting up", variant: "info-light" },
	ACTIVE: { label: "Active", variant: "success-light" },
	RESTRICTED: { label: "Restricted", variant: "warning-light" },
	SUSPENDED: { label: "Suspended", variant: "destructive-light" },
	BANNED: { label: "Banned", variant: "destructive-light" },
	PENDING_DELETION: { label: "Closing", variant: "warning-light" },
	DELETED: { label: "Closed", variant: "outline" },
};

export const KYB_LABELS: Readonly<Record<KybStatus, { readonly label: string; readonly variant: React.ComponentProps<typeof Badge>["variant"] }>> = {
	PENDING: { label: "Verification pending", variant: "warning-light" },
	ACTION_REQUIRED: { label: "Verification needs action", variant: "warning-light" },
	APPROVED: { label: "Verified", variant: "success-light" },
	REJECTED: { label: "Verification rejected", variant: "destructive-light" },
};

export interface TenantSettingsIndexViewProps {
	readonly tenantSlug: string;
}

/**
 * Business profile — the first settings section: how the business appears and where it stands, from the
 * member-wide tenant context. Changing the logo and the verification details lives on their own sections.
 */
export function TenantSettingsIndexView({ tenantSlug }: TenantSettingsIndexViewProps): JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const contextQuery = api.tenants.context.useQuery({ tenantSlug });
	const context = contextQuery.data?.data;

	return (
		<div className="space-y-6">
			<SettingsSectionHeader title="Business profile" description="How your business appears to customers, and where it stands." />
			{context === undefined ? (
				<Skeleton aria-label="Loading business profile" className="h-56 w-full rounded-xl" />
			) : (
				<BusinessProfileCard
					tenantSlug={tenantSlug}
					context={context}
					canEditBranding={can(MERCHANT_CAPABILITY.viewLocations)}
					canReviewKyb={can(MERCHANT_CAPABILITY.manageVerification)}
				/>
			)}
			<SupportAccessApprovalsCard tenantSlug={tenantSlug} />
			<LeaveTenantCard tenantSlug={tenantSlug} />
		</div>
	);
}

interface BusinessProfileCardProps {
	readonly tenantSlug: string;
	readonly context: TenantContextResponse;
	readonly canEditBranding: boolean;
	readonly canReviewKyb: boolean;
}

function BusinessProfileCard({ tenantSlug, context, canEditBranding, canReviewKyb }: BusinessProfileCardProps): JSX.Element {
	const { tenant, merchantProfile } = context;
	const routes = tenantRoutes(tenantSlug).settings;
	const lifecycle = LIFECYCLE_LABELS[tenant.lifecycleState];
	const kyb = merchantProfile === null ? null : KYB_LABELS[merchantProfile.kybStatus];
	const region = { locale: PLATFORM_DISPLAY_REGION.locale, timeZone: tenant.timeZone };

	return (
		<section aria-labelledby="business-profile-name" className="overflow-hidden rounded-xl border border-border bg-card">
			<div className="flex flex-wrap items-center gap-4 border-b border-border p-5">
				<EntityAvatar name={tenant.displayName} src={tenant.logo?.url ?? null} sources={tenant.logo?.sources} alt="" size="lg" />
				<div className="min-w-0 flex-1 space-y-1">
					<h3 id="business-profile-name" className="truncate text-lg font-semibold text-foreground">
						{tenant.displayName}
					</h3>
					<div className="flex flex-wrap gap-2">
						<Badge variant={lifecycle.variant}>{lifecycle.label}</Badge>
						{kyb === null ? null : <Badge variant={kyb.variant}>{kyb.label}</Badge>}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{canEditBranding ? (
						<Link href={routes.branding} className={buttonVariants({ variant: "outline", size: "sm" })}>
							Change logo
						</Link>
					) : null}
					{canReviewKyb ? (
						<Link href={routes.verification} className={buttonVariants({ variant: "outline", size: "sm" })}>
							Verification details
						</Link>
					) : null}
				</div>
			</div>
			<dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
				<ProfileField term="Legal name" value={merchantProfile?.legalName ?? null} />
				<ProfileField term="Category" value={merchantProfile?.category ?? null} />
				<ProfileField term="City" value={merchantProfile?.city ?? null} />
				<ProfileField term="Contact email" value={merchantProfile?.contactEmail ?? null} />
				<ProfileField term="Contact phone" value={merchantProfile?.contactPhone ?? null} />
				<ProfileField term="Time zone" value={tenant.timeZone} />
				<ProfileField term="Address in the console" value={`/t/${tenant.slug}`} />
				<ProfileField term="Joined" value={formatEpochMs(tenant.createdAt, "date", region)} />
			</dl>
		</section>
	);
}

function ProfileField({ term, value }: { readonly term: string; readonly value: string | null }): JSX.Element {
	return (
		<div className="min-w-0 space-y-0.5">
			<dt className="text-xs text-muted-foreground">{term}</dt>
			<dd className={value === null ? "text-sm text-muted-foreground" : "truncate text-sm text-foreground"}>{value ?? "Not given"}</dd>
		</div>
	);
}
