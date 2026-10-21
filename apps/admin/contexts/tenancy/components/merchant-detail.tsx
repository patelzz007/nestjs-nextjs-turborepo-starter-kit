"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { AdminMerchantDetailResponse, Envelope, TenantLifecycleResponse } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import Link from "next/link";
import * as React from "react";

import { MerchantDetailPageSkeleton } from "@/components/loading/merchant-skeletons";
import { KYB_STATUS_LABELS, MERCHANT_TENANT_STATUS_LABELS } from "@/lib/data-table/enum-filter-options";
import { formatDateTime } from "@/lib/format/dates";
import { pilotCityLabel } from "@/lib/format/pilot-city";
import { ROUTES } from "@/lib/routes";

import { MerchantLifecyclePanel } from "./merchant-lifecycle-panel";

export interface MerchantDetailViewProps {
	readonly tenantId: string;
	/** The server-prefetched `GET /admin/merchants/:tenantId` envelope, or `undefined` when the prefetch failed. */
	readonly initialMerchant?: Envelope<AdminMerchantDetailResponse> | undefined;
	/** The server-prefetched `GET /admin/merchants/:tenantId/lifecycle` envelope, or `undefined`. */
	readonly initialLifecycle?: Envelope<TenantLifecycleResponse> | undefined;
}

function SummaryField({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
	return (
		<div className="space-y-1">
			<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
			<dd className="text-sm text-foreground">{value}</dd>
		</div>
	);
}

/** `/merchants/[id]` — the merchant's summary and its lifecycle. */
export default function MerchantDetailView({ tenantId, initialMerchant, initialLifecycle }: MerchantDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const merchantQuery = api.rewardsAdmin.getTenant.useQuery({ tenantId }, initialDataOption(initialMerchant));
	const lifecycleQuery = api.rewardsAdmin.getTenantLifecycle.useQuery({ tenantId }, initialDataOption(initialLifecycle));
	const merchant = merchantQuery.data?.data;
	const lifecycle = lifecycleQuery.data?.data;

	if ((merchantQuery.isLoading && merchant === undefined) || (lifecycleQuery.isLoading && lifecycle === undefined)) {
		return <MerchantDetailPageSkeleton />;
	}
	if (merchant === undefined || lifecycle === undefined) {
		return (
			<div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
				Failed to load the merchant.{" "}
				<Link href={ROUTES.merchants.list} className="underline">
					Back to merchants
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div className="min-w-0">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">{merchant.businessName}</h1>
					<p className="mt-0.5 text-sm text-muted-foreground">{merchant.legalName ?? merchant.category}</p>
				</div>
				<Link href={ROUTES.merchants.verificationFor(tenantId)} className={buttonVariants({ variant: "outline" })}>
					KYB review
				</Link>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Merchant</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-4 md:grid-cols-3">
						<SummaryField label="Status" value={MERCHANT_TENANT_STATUS_LABELS[merchant.status]} />
						<SummaryField label="KYB" value={KYB_STATUS_LABELS[merchant.kybStatus]} />
						<SummaryField label="City" value={pilotCityLabel(merchant.city)} />
						<SummaryField label="Owner" value={merchant.ownerFullName ?? merchant.ownerEmail ?? "—"} />
						<SummaryField label="Members" value={String(merchant.memberCount)} />
						<SummaryField label="Onboarded" value={formatDateTime(merchant.createdAt)} />
					</dl>
				</CardContent>
			</Card>

			<MerchantLifecyclePanel lifecycle={lifecycle} />
		</div>
	);
}
