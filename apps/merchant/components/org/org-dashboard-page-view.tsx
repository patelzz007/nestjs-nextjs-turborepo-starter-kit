"use client";

import { MerchantStatCard } from "@/components/merchant-ui/stat-card";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { organizationPath } from "@/lib/org/slug";
import type { KybStatus, OrganizationContextResponse, OrganizationLifecycleState, OrganizationMembershipRole } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowRight, BarChart3, Building2, Gift, LayoutDashboard, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const LIFECYCLE_LABELS: Record<OrganizationLifecycleState, string> = {
	PROVISIONING: "Provisioning",
	ACTIVE: "Active",
	RESTRICTED: "Restricted",
	SUSPENDED: "Suspended",
	PENDING_DELETION: "Pending deletion",
	DELETED: "Deleted",
};

const ROLE_LABELS: Record<OrganizationMembershipRole, string> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};

const KYB_LABELS: Record<KybStatus, string> = {
	PENDING: "Pending review",
	ACTION_REQUIRED: "Action required",
	APPROVED: "Approved",
	REJECTED: "Rejected",
};

function lifecycleBadgeVariant(state: OrganizationLifecycleState): "default" | "secondary" | "outline" | "destructive" {
	if (state === "ACTIVE") {
		return "default";
	}
	if (state === "SUSPENDED" || state === "DELETED" || state === "PENDING_DELETION") {
		return "destructive";
	}
	return "outline";
}

function kybBadgeVariant(status: KybStatus): "default" | "secondary" | "outline" | "destructive" {
	if (status === "APPROVED") {
		return "default";
	}
	if (status === "REJECTED" || status === "ACTION_REQUIRED") {
		return "destructive";
	}
	return "outline";
}

interface OrgNavLinkProps {
	readonly href: string;
	readonly title: string;
	readonly description: string;
	readonly icon: React.ReactNode;
	readonly external?: boolean;
}

function OrgNavLink({ href, title, description, icon, external = false }: OrgNavLinkProps): React.JSX.Element {
	return (
		<Link
			href={href}
			className="group flex items-start gap-4 rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-info/40 hover:bg-info-soft/30">
			<div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-info">{icon}</div>
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex items-center gap-2">
					<p className="font-medium text-foreground transition-colors group-hover:text-info">{title}</p>
					{external ? (
						<Badge variant="secondary" className="shrink-0 text-[10px] tracking-wide uppercase">
							Merchant home
						</Badge>
					) : (
						<Badge variant="outline" className="shrink-0 text-[10px] tracking-wide uppercase">
							Org route
						</Badge>
					)}
				</div>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			<ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-info" aria-hidden="true" />
		</Link>
	);
}

export interface OrgDashboardPageViewProps {
	readonly orgSlug: string;
	readonly context: OrganizationContextResponse | null;
	readonly contextError?: boolean;
}

export function OrgDashboardPageView({ orgSlug, context, contextError = false }: OrgDashboardPageViewProps): React.JSX.Element {
	const displayName = context?.organization.displayName ?? orgSlug;
	const lifecycleState = context?.organization.lifecycleState;
	const membershipRole = context?.membership.role;
	const locationCount = context?.locations.length ?? 0;
	const policyVersion = context?.policyVersion;
	const kybStatus = context?.merchantProfile?.kybStatus;
	const primaryLocation = context?.locations.find((location) => location.isPrimary) ?? context?.locations[0];

	return (
		<div className="space-y-8">
			<MerchantSurfacePanel accent className="overflow-hidden">
				<div className="border-b border-border bg-info-soft/40 px-5 py-4 sm:px-6">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="space-y-2">
							<p className="text-xs font-semibold tracking-[0.16em] text-info uppercase">Organization workspace</p>
							<div className="flex flex-wrap items-center gap-3">
								<div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-info shadow-xs">
									<Building2 className="size-6" aria-hidden="true" />
								</div>
								<div>
									<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{displayName}</h1>
									<p className="mt-1 font-mono text-sm text-muted-foreground">/orgs/{orgSlug}/dashboard</p>
								</div>
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							{lifecycleState !== undefined ? <Badge variant={lifecycleBadgeVariant(lifecycleState)}>{LIFECYCLE_LABELS[lifecycleState]}</Badge> : null}
							<Badge variant="secondary">URL tenant</Badge>
						</div>
					</div>
				</div>
				<div className="space-y-3 px-5 py-4 text-sm text-muted-foreground sm:px-6">
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
				<MerchantStatCard
					label="Your role"
					value={membershipRole !== undefined ? ROLE_LABELS[membershipRole] : "—"}
					hint="Membership in this organization"
					icon={<ShieldCheck className="size-5" aria-hidden="true" />}
				/>
				<MerchantStatCard
					label="Locations"
					value={String(locationCount)}
					hint={primaryLocation !== undefined ? `Primary: ${primaryLocation.name}` : "No locations yet"}
					icon={<MapPin className="size-5" aria-hidden="true" />}
				/>
				<MerchantStatCard
					label="KYB status"
					value={kybStatus !== undefined ? KYB_LABELS[kybStatus] : "—"}
					hint="Business verification for this org"
					icon={<ShieldCheck className="size-5" aria-hidden="true" />}
				/>
				<MerchantStatCard
					label="Policy version"
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
						<OrgNavLink
							href={organizationPath(orgSlug, "settings/team")}
							title="Team & access"
							description="Invite members, manage roles, and review access requests."
							icon={<Users className="size-5" aria-hidden="true" />}
						/>
						<OrgNavLink
							href="/settings/verification"
							title="Business verification"
							description="Submit or update KYB documents for this merchant organization."
							icon={<ShieldCheck className="size-5" aria-hidden="true" />}
							external
						/>
					</div>
				</section>

				<section className="space-y-4">
					<div className="space-y-1">
						<h2 className="text-lg font-semibold text-foreground">Merchant operations</h2>
						<p className="text-sm text-muted-foreground">Routes on the merchant home — rewards, analytics, and POS activity.</p>
					</div>
					<div className="space-y-3">
						<OrgNavLink
							href="/"
							title="Rewards dashboard"
							description="Claims, redemptions, conversion metrics, and active campaigns."
							icon={<Gift className="size-5" aria-hidden="true" />}
							external
						/>
						<OrgNavLink
							href="/analytics"
							title="Analytics"
							description="Performance trends and top-performing rewards."
							icon={<BarChart3 className="size-5" aria-hidden="true" />}
							external
						/>
						<OrgNavLink
							href="/redemptions"
							title="Redemptions log"
							description="Recent POS scans and redemption confirmations."
							icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
							external
						/>
					</div>
				</section>
			</div>

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
									<Badge variant={kybBadgeVariant(kybStatus)}>{KYB_LABELS[kybStatus]}</Badge>
								</div>
							) : null}
						</div>
						<Link href="/" className={cn(buttonVariants({ variant: "outline" }), "gap-2 bg-transparent")}>
							<Gift className="size-4" aria-hidden="true" />
							Open merchant home
						</Link>
					</div>
				</MerchantSurfacePanel>
			) : (
				<div className="flex flex-wrap gap-3">
					<Link href="/">
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
