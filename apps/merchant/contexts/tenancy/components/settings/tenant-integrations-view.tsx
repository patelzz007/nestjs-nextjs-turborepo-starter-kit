"use client";

import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { tenantRoutes } from "@/lib/routes";
import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { KeyRound, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const SECTION = { title: "Integrations", description: "Tills and other systems connected to your rewards." };

export interface TenantIntegrationsViewProps {
	readonly tenantSlug: string;
}

/** "3 active tills", "1 waiting to pair" — the parts of a status count worth saying, or nothing connected. */
export function describeTills(counts: { readonly total: number; readonly active: number; readonly awaitingPairing: number }): string {
	if (counts.total === 0) {
		return "No tills connected yet.";
	}
	const parts = [`${String(counts.active)} active`];
	if (counts.awaitingPairing > 0) {
		parts.push(`${String(counts.awaitingPairing)} waiting to pair`);
	}
	return `${parts.join(" · ")} of ${String(counts.total)}`;
}

/** Integrations — tills and API keys at a glance (`merchant:manage_api_keys`), each managed on its own page. */
export function TenantIntegrationsView({ tenantSlug }: TenantIntegrationsViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageApiKeys}
			fallback={
				<div className="space-y-6">
					<SettingsSectionHeader {...SECTION} />
					<MerchantAccessDenied title="Integration access required" description="Your role can't connect tills or API keys. Contact your store owner if you need access." />
				</div>
			}>
			<IntegrationsContent tenantSlug={tenantSlug} />
		</MerchantCapabilityGate>
	);
}

function IntegrationsContent({ tenantSlug }: TenantIntegrationsViewProps): React.JSX.Element {
	const { api } = useAuth();
	const routes = tenantRoutes(tenantSlug);
	const tillsQuery = api.tenants.terminals.summary.useQuery({ tenantSlug });
	// One row asked for: only the total (in `meta`) is shown.
	const keysQuery = api.tenants.apiKeys.list.useQuery({ tenantSlug, page: 1, limit: 1 });
	const tills = tillsQuery.data?.data;
	const keyCount = readPaginatedTotal(keysQuery.data?.meta, 0);

	return (
		<div className="space-y-6">
			<SettingsSectionHeader {...SECTION} />
			<div className="grid gap-4 md:grid-cols-2">
				<IntegrationCard
					icon={<MonitorSmartphone />}
					title="Tills"
					summary={tills === undefined ? null : describeTills({ total: tills.total, active: tills.byStatus.ACTIVE, awaitingPairing: tills.byStatus.AWAITING_PAIRING })}
					href={routes.terminals}
					actionLabel="Manage tills"
				/>
				<IntegrationCard
					icon={<KeyRound />}
					title="API keys"
					summary={keysQuery.data === undefined ? null : keyCount === 1 ? "1 key in use" : `${String(keyCount)} keys in use`}
					href={routes.apiKeys}
					actionLabel="Manage API keys"
				/>
			</div>
		</div>
	);
}

interface IntegrationCardProps {
	readonly icon: React.ReactNode;
	readonly title: string;
	/** `null` while it loads. */
	readonly summary: string | null;
	readonly href: string;
	readonly actionLabel: string;
}

function IntegrationCard({ icon, title, summary, href, actionLabel }: IntegrationCardProps): React.JSX.Element {
	return (
		<section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
			<div className="flex items-center gap-3">
				<span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
					{icon}
				</span>
				<div className="min-w-0">
					<h3 className="font-semibold text-foreground">{title}</h3>
					{summary === null ? <Skeleton className="mt-1 h-4 w-40" /> : <p className="text-sm text-muted-foreground">{summary}</p>}
				</div>
			</div>
			<Link href={href} className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>
				{actionLabel}
			</Link>
		</section>
	);
}
