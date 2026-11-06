"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { PaymentStatusBadge } from "@/contexts/payments/components/payment-status-badge";
import { formatPaymentAmount, PAYMENT_PROVIDER_LABELS } from "@/contexts/payments/lib/payments";
import { PAYMENTS_URL_STATE, toPaymentsQuery } from "@/contexts/payments/url-state/payments";
import { tenantRoutes } from "@/lib/routes";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import type { PaymentIntentResponse } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";
import { ListPager } from "@workspace/ui/components/list-pager";
import { Skeleton } from "@workspace/ui/components/skeleton";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { format } from "date-fns";
import { CreditCardIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

const PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Payment pages" };

/** How many placeholder rows show while the first page loads. */
const LOADING_ROWS = 4;

export interface MerchantPaymentsPageViewProps {
	readonly tenantSlug: string;
}

/** The store's payments (ADR 020), newest first, and the way to ask for one. */
export function MerchantPaymentsPageView({ tenantSlug }: MerchantPaymentsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const routes = tenantRoutes(tenantSlug).payments;
	const [urlState, updateUrlState] = useUrlState(PAYMENTS_URL_STATE);
	const paymentsQuery = api.tenantPayments.payments.useQuery({ tenantSlug, ...toPaymentsQuery(urlState) }, { placeholderData: keepPreviousData });
	const pager = useUrlListPager(urlState, updateUrlState, paymentsQuery.data?.meta);

	return (
		<div className="flex flex-col gap-6">
			<MerchantPageHeader
				title="Payments"
				description="Send a customer a link to pay by online banking, card or e-wallet. Each payment shows here as it's paid."
				actions={
					<Link href={appRoute(routes.new)} className={buttonVariants()}>
						New payment
					</Link>
				}
			/>
			<PaymentList tenantSlug={tenantSlug} payments={paymentsQuery.data?.data} isError={paymentsQuery.isError} newHref={routes.new} />
			{(paymentsQuery.data?.data.length ?? 0) > 0 ? (
				<ListPager
					page={pager.page}
					totalPages={pager.totalPages}
					hasPrevious={pager.hasPrevious}
					hasNext={pager.hasNext}
					onPrevious={pager.onPrevious}
					onNext={pager.onNext}
					disabled={paymentsQuery.isPlaceholderData}
					labels={PAGER_LABELS}
				/>
			) : null}
		</div>
	);
}

interface PaymentListProps {
	readonly tenantSlug: string;
	readonly payments: readonly PaymentIntentResponse[] | undefined;
	readonly isError: boolean;
	readonly newHref: string;
}

function PaymentList({ tenantSlug, payments, isError, newHref }: PaymentListProps): React.JSX.Element {
	if (isError) {
		return <p className="text-sm text-muted-foreground">{`Couldn't load your payments. Check your connection and try again.`}</p>;
	}
	if (payments === undefined) {
		return (
			<div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading payments">
				{placeholderKeys("payment", LOADING_ROWS).map((key): React.JSX.Element => (
					<Skeleton key={key} className="h-18 w-full rounded-xl" />
				))}
			</div>
		);
	}
	if (payments.length === 0) {
		return (
			<Empty className="rounded-xl border border-dashed border-border">
				<EmptyHeader>
					<CreditCardIcon className="size-6 text-muted-foreground" aria-hidden="true" />
					<EmptyTitle>No payments yet</EmptyTitle>
					<EmptyDescription>Enter an amount and the customer&apos;s details, and they get a secure page to pay on.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Link href={appRoute(newHref)} className={buttonVariants()}>
						Ask for your first payment
					</Link>
				</EmptyContent>
			</Empty>
		);
	}
	return (
		<ul className="flex flex-col gap-3" aria-label="Payments">
			{payments.map((payment): React.JSX.Element => (
				<li key={payment.id}>
					<PaymentRow tenantSlug={tenantSlug} payment={payment} />
				</li>
			))}
		</ul>
	);
}

function PaymentRow({ tenantSlug, payment }: { readonly tenantSlug: string; readonly payment: PaymentIntentResponse }): React.JSX.Element {
	return (
		<Card className="gap-0 p-0 transition-colors hover:bg-foreground/[0.03]">
			<Link href={appRoute(tenantRoutes(tenantSlug).payments.detail(payment.id))} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
				<span className="w-28 shrink-0 text-base font-semibold text-foreground tabular-nums">{formatPaymentAmount(payment.amountMinor, payment.currency)}</span>
				<span className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="truncate text-sm font-medium text-foreground">{payment.description}</span>
					<span className="truncate text-xs text-muted-foreground">
						{payment.payerName}, {PAYMENT_PROVIDER_LABELS[payment.provider]}, {format(payment.createdAt, "d MMM yyyy, HH:mm")}
					</span>
				</span>
				<PaymentStatusBadge status={payment.status} />
			</Link>
		</Card>
	);
}
