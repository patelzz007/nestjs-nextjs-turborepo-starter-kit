"use client";

import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { StatCard } from "@workspace/ui/components/stat-card";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { OrganizationLocationList } from "@/components/org/organization-location-list";
import { orgRoutes, ROUTES } from "@/lib/routes";
import { Can, useAuthorization } from "@workspace/client/lib/auth/can";
import { KYB_STATUS_DISPLAY, ORGANIZATION_LIFECYCLE_DISPLAY } from "@/lib/org/organization-status";
import { LIST_SLOT_INDEX, MERCHANT_CAPABILITY, type OrganizationContextResponse, type OrganizationMembershipRole } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { IconTile, type IconTileTone } from "@workspace/ui/components/icon-tile";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowRight, BarChart3, Building2, Gift, LayoutDashboard, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const ROLE_LABELS: Record<OrganizationMembershipRole, string> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};

interface OrgNavLinkProps {
	readonly href: string;
	readonly title: string;
	readonly description: string;
	readonly icon: React.ReactNode;
	/** The icon tile's colour — by what the destination is about, so the list scans by meaning. */
	readonly tone: IconTileTone;
	readonly external?: boolean;
}

function OrgNavLink({ href, title, description, icon, tone, external = false }: OrgNavLinkProps): React.JSX.Element {
	return (
		<Link
			href={href}
			className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
			<IconTile tone={tone}>{icon}</IconTile>
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium text-foreground">{title}</p>
					{external ? <span className="text-xs text-muted-foreground">Merchant home</span> : null}
				</div>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			<ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
		</Link>
	);
}

export interface OrgDashboardPageViewProps {
	readonly orgSlug: string;
	readonly context: OrganizationContextResponse | null;
	readonly contextError?: boolean;
}

/** Organization dashboard — requires `merchant:view_dashboard`; shortcuts are shown only for routes the role can use. */
export function OrgDashboardPageView(props: OrgDashboardPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewDashboard}>
			<OrgDashboardPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

function OrgDashboardPageContent({ orgSlug, context, contextError = false }: OrgDashboardPageViewProps): React.JSX.Element {
	const { can } = useAuthorization();
	const canManageLocations = can(MERCHANT_CAPABILITY.manageLocations);
	const displayName = context?.organization.displayName ?? orgSlug;
	const lifecycleState = context?.organization.lifecycleState;
	const membershipRole = context?.membership.role;
	const locationCount = context?.locations.length ?? 0;
	const policyVersion = context?.policyVersion;
	const kybStatus = context?.merchantProfile?.kybStatus;
	const primaryLocation = context?.locations.find((location) => location.isPrimary) ?? context?.locations[LIST_SLOT_INDEX.first];

	return (
		<div className="space-y-8">
			<MerchantSurfacePanel className="overflow-hidden">
				<div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
					<div className="flex min-w-0 items-center gap-4">
						<div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
							<Building2 className="size-6" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="text-sm text-muted-foreground">Organization workspace</p>
							<h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{displayName}</h1>
							<p className="mt-1 truncate font-mono text-xs text-muted-foreground">/orgs/{orgSlug}/dashboard</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{lifecycleState !== undefined ? (
							<StatusBadge tone={ORGANIZATION_LIFECYCLE_DISPLAY[lifecycleState].tone}>{ORGANIZATION_LIFECYCLE_DISPLAY[lifecycleState].label}</StatusBadge>
						) : null}
						<Badge variant="secondary">URL tenant</Badge>
					</div>
				</div>
				<div className="space-y-3 border-t border-border px-5 py-4 text-sm text-muted-foreground sm:px-6">
					<p>
						<strong className="font-medium text-foreground">You are here:</strong> organization identity, membership, and admin routes scoped to{" "}
						<span className="font-mono text-foreground">{orgSlug}</span>.
					</p>
					<p>
						<strong className="font-medium text-foreground">Merchant home (`/`):</strong> rewards performance, campaigns, redemptions, and analytics for day-to-day operations.
						Same business, different surface.
					</p>
				</div>
			</MerchantSurfacePanel>

			{contextError ? (
				<MerchantSurfacePanel className="border-destructive/30 bg-destructive/5 p-5">
					<p className="font-medium text-foreground">Could not load organization context</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Verify you are signed in and have an active membership for <span className="font-mono">{orgSlug}</span>.
					</p>
				</MerchantSurfacePanel>
			) : null}

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard
					label="Your role"
					tone="violet"
					value={membershipRole !== undefined ? ROLE_LABELS[membershipRole] : "—"}
					hint="Membership in this organization"
					icon={<ShieldCheck className="size-5" aria-hidden="true" />}
				/>
				<StatCard
					label="Locations"
					tone="blue"
					value={String(locationCount)}
					hint={primaryLocation !== undefined ? `Primary: ${primaryLocation.name}` : "No locations yet"}
					icon={<MapPin className="size-5" aria-hidden="true" />}
				/>
				<StatCard
					label="KYB status"
					tone="teal"
					value={kybStatus !== undefined ? KYB_STATUS_DISPLAY[kybStatus].label : "—"}
					hint="Business verification for this org"
					icon={<ShieldCheck className="size-5" aria-hidden="true" />}
				/>
				<StatCard
					label="Policy version"
					tone="orange"
					value={policyVersion !== undefined ? String(policyVersion) : "—"}
					hint="Active authorization policy revision"
					icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
				/>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<section className="space-y-4">
					<div className="space-y-1">
						<h2 className="text-lg font-semibold text-foreground">Organization administration</h2>
						<p className="text-sm text-muted-foreground">
							Routes under <span className="font-mono">/orgs/{orgSlug}</span> — tenant-scoped settings.
						</p>
					</div>
					<div className="space-y-3">
						<Can permission={MERCHANT_CAPABILITY.viewLocations}>
							<OrgNavLink
								href={orgRoutes(orgSlug).settings.locations}
								title="Store locations"
								tone="blue"
								description="View every store site under this organization and your location access scope."
								icon={<MapPin className="size-5" aria-hidden="true" />}
							/>
						</Can>
						<Can permission={MERCHANT_CAPABILITY.manageTeam}>
							<OrgNavLink
								href={orgRoutes(orgSlug).settings.team}
								title="Team & access"
								tone="violet"
								description="Invite members, manage roles, and review access requests."
								icon={<Users className="size-5" aria-hidden="true" />}
							/>
						</Can>
						<Can permission={MERCHANT_CAPABILITY.manageVerification}>
							<OrgNavLink
								href={orgRoutes(orgSlug).settings.verification}
								title="Business verification"
								tone="teal"
								description="Submit or update KYB documents for this organization."
								icon={<ShieldCheck className="size-5" aria-hidden="true" />}
							/>
						</Can>
					</div>
				</section>

				<section className="space-y-4">
					<div className="space-y-1">
						<h2 className="text-lg font-semibold text-foreground">Merchant operations</h2>
						<p className="text-sm text-muted-foreground">Rewards, analytics, and POS activity for this organization.</p>
					</div>
					<div className="space-y-3">
						<Can permission={MERCHANT_CAPABILITY.viewRewards}>
							<OrgNavLink
								href={orgRoutes(orgSlug).rewards.list}
								title="Rewards"
								tone="brand"
								description="Claims, redemptions, conversion metrics, and active campaigns."
								icon={<Gift className="size-5" aria-hidden="true" />}
							/>
						</Can>
						<Can permission={MERCHANT_CAPABILITY.viewAnalytics}>
							<OrgNavLink
								href={orgRoutes(orgSlug).analytics}
								title="Analytics"
								tone="orange"
								description="Performance trends and top-performing rewards."
								icon={<BarChart3 className="size-5" aria-hidden="true" />}
							/>
						</Can>
						<Can permission={MERCHANT_CAPABILITY.viewRedemptions}>
							<OrgNavLink
								href={orgRoutes(orgSlug).redemptions}
								title="Redemptions log"
								tone="green"
								description="Recent POS scans and redemption confirmations."
								icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
							/>
						</Can>
					</div>
				</section>
			</div>

			{context !== null && context.locations.length > 0 ? (
				<section className="space-y-4">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold text-foreground">Store locations</h2>
							<p className="text-sm text-muted-foreground">
								{context.locations.length} location{context.locations.length === 1 ? "" : "s"} under this organization.
							</p>
						</div>
						<Can permission={MERCHANT_CAPABILITY.viewLocations}>
							<Link href={orgRoutes(orgSlug).settings.locations} className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
								<MapPin className="size-4" aria-hidden="true" />
								{canManageLocations ? "Manage locations" : "View locations"}
							</Link>
						</Can>
					</div>
					<OrganizationLocationList
						locations={context.locations}
						membershipLocationScopeType={context.membership.locationScopeType}
						membershipLocationIds={context.membership.locationIds}
						showAccessHints
					/>
				</section>
			) : null}

			{context !== null ? (
				<MerchantSurfacePanel className="p-5 sm:p-6">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="space-y-3">
							<h2 className="text-base font-semibold text-foreground">Tenant snapshot</h2>
							<dl className="grid gap-3 text-sm sm:grid-cols-2">
								<div>
									<dt className="text-muted-foreground">Organization ID</dt>
									<dd className="mt-0.5 font-mono text-xs text-foreground">{context.organization.id}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Membership status</dt>
									<dd className="mt-0.5 text-foreground capitalize">{context.membership.status.toLowerCase()}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Location scope</dt>
									<dd className="mt-0.5 text-foreground">
										{context.membership.locationScopeType === "ALL_LOCATIONS" ? "All locations" : `${String(context.membership.locationIds.length)} selected`}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Merchant contact</dt>
									<dd className="mt-0.5 text-foreground">{context.merchantProfile?.contactEmail ?? "—"}</dd>
								</div>
							</dl>
							{kybStatus !== undefined ? (
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-sm text-muted-foreground">Verification:</span>
									<StatusBadge tone={KYB_STATUS_DISPLAY[kybStatus].tone}>{KYB_STATUS_DISPLAY[kybStatus].label}</StatusBadge>
								</div>
							) : null}
						</div>
						<Link href={ROUTES.home} className={cn(buttonVariants({ variant: "outline" }), "gap-2 bg-transparent")}>
							<Gift className="size-4" aria-hidden="true" />
							Open merchant home
						</Link>
					</div>
				</MerchantSurfacePanel>
			) : (
				<div className="flex flex-wrap gap-3">
					<Link href={ROUTES.home}>
						<Button variant="outline" className="gap-2 bg-transparent">
							<Gift className="size-4" aria-hidden="true" />
							Go to merchant home
						</Button>
					</Link>
				</div>
			)}
		</div>
	);
}
