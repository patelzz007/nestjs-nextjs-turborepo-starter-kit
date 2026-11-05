"use client";

import { MerchantRewardDetailPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { PaymentStatusBadge } from "@/contexts/payments/components/payment-status-badge";
import { formatPaymentAmount, PAYMENT_PROVIDER_LABELS } from "@/contexts/payments/lib/payments";
import { MerchantCapabilityGate } from "@/contexts/tenancy";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MERCHANT_CAPABILITY, PAYMENT_PROVIDER_REFUNDS, type PaymentIntentResponse } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { toastMessage } from "@workspace/ui/components/toast";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { format } from "date-fns";
import { ArrowLeftIcon, CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** How often a payment waiting for its customer is re-read, so "Paid" appears without a refresh. */
const PENDING_REFRESH_MS = 5_000;

const REFUND_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Refund payment", loading: "Refunding…" };

export interface MerchantPaymentDetailPageViewProps {
	readonly tenantSlug: string;
	readonly paymentId: string;
}

/** `/t/:tenantSlug/payments/:paymentId` — one payment: where it stands, its checkout link while it can be paid, and its refund. */
export function MerchantPaymentDetailPageView(props: MerchantPaymentDetailPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.managePayments} loading={<MerchantRewardDetailPageSkeleton />}>
			<PaymentDetailContent {...props} />
		</MerchantCapabilityGate>
	);
}

function PaymentDetailContent({ tenantSlug, paymentId }: MerchantPaymentDetailPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const paymentQuery = api.tenantPayments.payment.useQuery(
		{ tenantSlug, paymentId },
		{ refetchInterval: (query): number | false => (query.state.data?.data.status === "PENDING" ? PENDING_REFRESH_MS : false) },
	);
	if (paymentQuery.isError) {
		return (
			<div className="flex flex-col gap-4">
				<BackLink tenantSlug={tenantSlug} />
				<p className="text-sm text-muted-foreground">{userSafeErrorMessage(paymentQuery.error, "Couldn't load this payment.")}</p>
			</div>
		);
	}
	const payment = paymentQuery.data?.data;
	if (payment === undefined) {
		return <MerchantRewardDetailPageSkeleton />;
	}
	return <PaymentDetail tenantSlug={tenantSlug} payment={payment} />;
}

function BackLink({ tenantSlug }: { readonly tenantSlug: string }): React.JSX.Element {
	return (
		<Link
			href={tenantRoutes(tenantSlug).payments.list}
			className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
			<ArrowLeftIcon className="size-4" aria-hidden="true" />
			All payments
		</Link>
	);
}

function DetailRow({ term, children }: { readonly term: string; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
			<dt className="text-sm text-muted-foreground">{term}</dt>
			<dd className="min-w-0 text-sm break-words text-foreground">{children}</dd>
		</div>
	);
}

/** What the merchant can do next, in a sentence, for each state. */
export function describePaymentNextStep(payment: PaymentIntentResponse): string {
	switch (payment.status) {
		case "PENDING":
			return "Send the customer the checkout link. This page updates by itself once they pay.";
		case "PAID":
			return payment.refundable
				? "Paid. You can refund it in full here."
				: `Paid. Refunds for ${PAYMENT_PROVIDER_LABELS[payment.provider]} payments are made in its own dashboard.`;
		case "FAILED":
			return "The payment didn't go through. The customer can try the same link again while it is open, or you can ask for a new payment.";
		case "CANCELLED":
			return "This payment was closed before it was paid. Ask for a new payment if the customer still needs to pay.";
		case "REFUNDED":
			return "Refunded in full. The customer gets the money back through the way they paid.";
	}
}

function PaymentDetail({ tenantSlug, payment }: { readonly tenantSlug: string; readonly payment: PaymentIntentResponse }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [confirmingRefund, setConfirmingRefund] = React.useState(false);
	const { isCopied, copyToClipboard } = useCopyToClipboard({
		onError: (): void => {
			toastMessage.error({ title: "Link not copied", description: "Select the link and copy it yourself." });
		},
	});
	const refund = api.tenantPayments.refundPayment.useMutation({
		onSuccess: (response): void => {
			const defs = apiRouter.tenantPayments;
			queryClient.setQueryData(defs.payment.queryKey({ tenantSlug, paymentId: response.data.payment.id }), { ...response, data: response.data.payment });
			void queryClient.invalidateQueries({ queryKey: defs.payments.scopeKey({ tenantSlug }) });
			setConfirmingRefund(false);
			toastMessage.success(
				response.data.outcome === "refunded"
					? { title: "Payment refunded", description: "The customer gets the money back through the way they paid." }
					: { title: "Refund requested", description: "The gateway is processing it; this page shows it once it's done." },
			);
		},
	});
	const { mutate: refundMutate } = refund;
	const handleCopy = React.useCallback((): void => {
		copyToClipboard(payment.checkoutUrl ?? "");
	}, [copyToClipboard, payment.checkoutUrl]);
	const handleRefundRequest = React.useCallback((): void => {
		setConfirmingRefund(true);
	}, []);
	const handleRefundDialogChange = React.useCallback((open: boolean): void => {
		setConfirmingRefund(open);
	}, []);
	const handleConfirmRefund = React.useCallback((): void => {
		refundMutate({ tenantSlug, paymentId: payment.id });
	}, [payment.id, refundMutate, tenantSlug]);
	const amount = formatPaymentAmount(payment.amountMinor, payment.currency);

	return (
		<div className="flex flex-col gap-6">
			<BackLink tenantSlug={tenantSlug} />
			<div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
				<div className="flex min-w-0 flex-col gap-2">
					<PaymentStatusBadge status={payment.status} />
					<h1 className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{amount}</h1>
					<p className="text-sm text-muted-foreground">{payment.description}</p>
				</div>
				{payment.refundable ? (
					<Button type="button" variant="outline" onClick={handleRefundRequest} disabled={refund.isPending}>
						Refund
					</Button>
				) : null}
			</div>

			<p className="text-sm text-foreground">{describePaymentNextStep(payment)}</p>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
				{payment.checkoutUrl === null ? null : (
					<section aria-labelledby="payment-checkout-heading" className="flex flex-col gap-3">
						<h2 id="payment-checkout-heading" className="text-base font-semibold text-foreground">
							Checkout link
						</h2>
						<Card className="flex flex-col gap-4 p-5">
							<p className="font-mono text-xs break-all text-muted-foreground" data-slot="payment-checkout-url">
								{payment.checkoutUrl}
							</p>
							<div className="flex flex-wrap gap-2">
								<Button type="button" onClick={handleCopy}>
									{isCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
									{isCopied ? "Copied" : "Copy link"}
								</Button>
								<a href={payment.checkoutUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
									<ExternalLinkIcon aria-hidden="true" />
									Open checkout
								</a>
							</div>
						</Card>
					</section>
				)}
				<section aria-labelledby="payment-details-heading" className="flex flex-col gap-3">
					<h2 id="payment-details-heading" className="text-base font-semibold text-foreground">
						Details
					</h2>
					<Card className="gap-0 px-5 py-2">
						<dl className="divide-y divide-border">
							<DetailRow term="Customer">
								{payment.payerName}
								<span className="block text-muted-foreground">{payment.payerEmail}</span>
							</DetailRow>
							<DetailRow term="Paid with">{PAYMENT_PROVIDER_LABELS[payment.provider]}</DetailRow>
							<DetailRow term="Asked for">{format(payment.createdAt, "d MMM yyyy, HH:mm")}</DetailRow>
							<DetailRow term="Paid">{payment.paidAt === null ? "Not yet" : format(payment.paidAt, "d MMM yyyy, HH:mm")}</DetailRow>
							<DetailRow term="Refunds">
								{PAYMENT_PROVIDER_REFUNDS[payment.provider] ? "Here, in full" : `In the ${PAYMENT_PROVIDER_LABELS[payment.provider]} dashboard`}
							</DetailRow>
							{payment.providerPaymentId === null ? null : <DetailRow term="Gateway reference">{payment.providerPaymentId}</DetailRow>}
						</dl>
					</Card>
				</section>
			</div>

			<AlertDialog open={confirmingRefund} onOpenChange={handleRefundDialogChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={REFUND_DIALOG_LABELS}
					confirmLoading={refund.isPending}
					onConfirm={handleConfirmRefund}>
					<AlertDialogTitle>
						Refund {amount} to {payment.payerName}?
					</AlertDialogTitle>
					<AlertDialogDescription>The full amount goes back through the way they paid. This can&apos;t be undone.</AlertDialogDescription>
					{refund.error === null ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{userSafeErrorMessage(refund.error, "The refund wasn't made. Check your connection and try again.")}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
