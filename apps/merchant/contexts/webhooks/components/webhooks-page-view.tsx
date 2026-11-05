"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy";
import { useWebhookEndpointFieldHandlers, WebhookEndpointFields } from "@/contexts/webhooks/components/webhook-endpoint-fields";
import { useWebhookRedelivery } from "@/contexts/webhooks/components/use-webhook-redelivery";
import { WebhookDeliveryLog } from "@/contexts/webhooks/components/webhook-delivery-log";
import { WebhookReceiverGuide } from "@/contexts/webhooks/components/webhook-receiver-guide";
import { WebhookSecretNotice } from "@/contexts/webhooks/components/webhook-secret-notice";
import {
	EMPTY_WEBHOOK_ENDPOINT_FORM,
	endpointStatusPresentation,
	parseWebhookEndpointForm,
	toggleEventType,
	webhookDeliveriesRequest,
	type WebhookEndpointFormValues,
} from "@/contexts/webhooks/lib/webhook-presentation";
import { tenantRoutes } from "@/lib/routes";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MAX_WEBHOOK_ENDPOINTS_PER_TENANT, MERCHANT_CAPABILITY, type WebhookEndpointSummary } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { ChevronRight, Plus, Webhook } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const CREATE_FAILED_MESSAGE = "The endpoint could not be added. Check the address and try again.";

export interface WebhooksPageViewProps {
	readonly tenantSlug: string;
}

/** Outgoing webhooks: the tenant's endpoints, adding one, the delivery log and how to receive them. */
export function WebhooksPageView(props: WebhooksPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageWebhooks}
			loading={<Skeleton className="h-96 rounded-xl" />}
			fallback={
				<div className="space-y-8">
					<MerchantPageHeader title="Webhooks" description="Send your store's events to your own systems." />
					<MerchantAccessDenied
						title="Webhook access required"
						description="Only members allowed to manage webhooks (owners, by default) can set them up. Ask your store owner for access."
					/>
				</div>
			}>
			<WebhooksPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

/** Quick invalidation of every webhooks read of the tenant (endpoints, one endpoint, deliveries). */
export function useInvalidateWebhooks(tenantSlug: string): () => void {
	const queryClient = useQueryClient();
	return React.useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: apiRouter.tenants.webhooks.endpoints.scopeKey({ tenantSlug }) });
		void queryClient.invalidateQueries({ queryKey: apiRouter.tenants.webhooks.deliveries.scopeKey({ tenantSlug }) });
	}, [queryClient, tenantSlug]);
}

interface EndpointRowProps {
	readonly endpoint: WebhookEndpointSummary;
	readonly href: string;
}

function EndpointRow({ endpoint, href }: EndpointRowProps): React.JSX.Element {
	const status = endpointStatusPresentation(endpoint);
	return (
		<li>
			<Link href={href} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none">
				<div className="min-w-0 flex-1 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
						<span className="truncate text-sm font-medium text-foreground">{endpoint.url}</span>
					</div>
					<p className="text-xs text-muted-foreground">
						{endpoint.description === "" ? null : `${endpoint.description} · `}
						{endpoint.eventTypes.length === 1 ? "1 event" : `${String(endpoint.eventTypes.length)} events`}
						{status.note === null ? null : ` · ${status.note}`}
					</p>
				</div>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			</Link>
		</li>
	);
}

function WebhooksPageContent({ tenantSlug }: WebhooksPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const routes = tenantRoutes(tenantSlug).webhooks;
	const invalidate = useInvalidateWebhooks(tenantSlug);

	const endpointsQuery = api.tenants.webhooks.endpoints.useQuery({ tenantSlug, page: 1, limit: MAX_WEBHOOK_ENDPOINTS_PER_TENANT });
	const deliveriesQuery = api.tenants.webhooks.deliveries.useQuery(webhookDeliveriesRequest(tenantSlug));
	const endpoints: readonly WebhookEndpointSummary[] = endpointsQuery.data?.data ?? [];
	const atLimit = endpoints.length >= MAX_WEBHOOK_ENDPOINTS_PER_TENANT;

	const [values, setValues] = React.useState<WebhookEndpointFormValues>(EMPTY_WEBHOOK_ENDPOINT_FORM);
	const [isAdding, setIsAdding] = React.useState<boolean>(false);
	const [secret, setSecret] = React.useState<string | null>(null);
	const handlers = useWebhookEndpointFieldHandlers(setValues, toggleEventType);
	const createInput = parseWebhookEndpointForm(values);

	const createMutation = api.tenants.webhooks.createEndpoint.useMutation({
		onSuccess: (response): void => {
			setSecret(response.data.secret);
			setValues(EMPTY_WEBHOOK_ENDPOINT_FORM);
			setIsAdding(false);
			invalidate();
		},
	});
	const redelivery = useWebhookRedelivery(tenantSlug, invalidate);

	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (createInput !== undefined) {
				createMutation.mutate({ tenantSlug, ...createInput });
			}
		},
		[createInput, createMutation, tenantSlug],
	);
	const handleStartAdding = React.useCallback((): void => {
		setIsAdding(true);
	}, []);
	const handleCancelAdding = React.useCallback((): void => {
		setIsAdding(false);
		setValues(EMPTY_WEBHOOK_ENDPOINT_FORM);
		createMutation.reset();
	}, [createMutation]);
	const handleDismissSecret = React.useCallback((): void => {
		setSecret(null);
	}, []);
	const refetchDeliveries = deliveriesQuery.refetch;
	const handleRetryDeliveries = React.useCallback((): void => {
		void refetchDeliveries();
	}, [refetchDeliveries]);

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="Webhooks"
				description="Tell your own systems the moment something happens in your store: a reward goes live, a customer claims or redeems one, a sale or a payment completes."
				actions={
					isAdding || atLimit ? null : (
						<Button onClick={handleStartAdding}>
							<Plus className="size-4" aria-hidden="true" />
							Add endpoint
						</Button>
					)
				}
			/>

			{secret === null ? null : <WebhookSecretNotice heading="Endpoint added" secret={secret} onDismiss={handleDismissSecret} />}

			{isAdding ? (
				<form onSubmit={handleSubmit} aria-labelledby="add-webhook-heading" className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
					<h2 id="add-webhook-heading" className="text-base font-semibold text-foreground">
						Add an endpoint
					</h2>
					<WebhookEndpointFields values={values} disabled={createMutation.isPending} {...handlers} />
					{createMutation.error === null ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{userSafeErrorMessage(createMutation.error, CREATE_FAILED_MESSAGE)}
						</p>
					)}
					<div className="flex flex-wrap gap-2">
						<Button type="submit" disabled={createInput === undefined || createMutation.isPending}>
							{createMutation.isPending ? "Adding…" : "Add endpoint"}
						</Button>
						<Button type="button" variant="ghost" onClick={handleCancelAdding} disabled={createMutation.isPending}>
							Cancel
						</Button>
					</div>
				</form>
			) : null}

			<section aria-labelledby="webhook-endpoints-heading" className="space-y-3">
				<div>
					<h2 id="webhook-endpoints-heading" className="text-base font-semibold text-foreground">
						Endpoints
					</h2>
					<p className="text-sm text-muted-foreground">
						{atLimit
							? `You have the most endpoints allowed (${String(MAX_WEBHOOK_ENDPOINTS_PER_TENANT)}). Remove one to add another.`
							: `Up to ${String(MAX_WEBHOOK_ENDPOINTS_PER_TENANT)} per business.`}
					</p>
				</div>
				{endpointsQuery.isPending ? (
					<Skeleton className="h-24 rounded-xl" />
				) : endpointsQuery.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{userSafeErrorMessage(endpointsQuery.error, "Couldn't load your endpoints.")}
					</p>
				) : endpoints.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Webhook aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No endpoints yet</EmptyTitle>
							<EmptyDescription>Add the address of your server, choose the events it should hear about, then send it a test.</EmptyDescription>
						</EmptyHeader>
						{isAdding ? null : (
							<Button onClick={handleStartAdding}>
								<Plus className="size-4" aria-hidden="true" />
								Add endpoint
							</Button>
						)}
					</Empty>
				) : (
					<ul className="divide-y divide-border rounded-xl border border-border bg-card">
						{endpoints.map((endpoint) => (
							<EndpointRow key={endpoint.id} endpoint={endpoint} href={routes.detail(endpoint.id)} />
						))}
					</ul>
				)}
			</section>

			<WebhookDeliveryLog
				deliveries={deliveriesQuery.data?.data ?? []}
				isLoading={deliveriesQuery.isPending}
				isError={deliveriesQuery.isError}
				onRetry={handleRetryDeliveries}
				showEndpoint
				redeliveringId={redelivery.redeliveringId}
				onRedeliver={redelivery.redeliver}
				redeliverError={redelivery.error}
			/>

			<WebhookReceiverGuide />
		</div>
	);
}
