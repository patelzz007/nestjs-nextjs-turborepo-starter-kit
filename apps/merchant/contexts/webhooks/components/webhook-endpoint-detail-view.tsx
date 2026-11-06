"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy";
import { useWebhookRedelivery } from "@/contexts/webhooks/components/use-webhook-redelivery";
import { WebhookDeliveryLog } from "@/contexts/webhooks/components/webhook-delivery-log";
import { WebhookSecretNotice } from "@/contexts/webhooks/components/webhook-secret-notice";
import { useInvalidateWebhooks } from "@/contexts/webhooks/components/webhooks-page-view";
import { endpointStatusPresentation, webhookDeliveriesRequest } from "@/contexts/webhooks/lib/webhook-presentation";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { DEFAULT_WEBHOOK_SECRET_GRACE_HOURS, MERCHANT_CAPABILITY, PLATFORM_DISPLAY_REGION, type WebhookEndpointSummary } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { KeyRound, Pencil, Power, PowerOff, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

const REMOVE_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Remove endpoint", loading: "Removing…" };
const ROTATE_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Replace secret", loading: "Replacing…" };
const ACTION_FAILED_MESSAGE = "That didn't work. Try again.";

export interface WebhookEndpointDetailViewProps {
	readonly tenantSlug: string;
	readonly endpointId: string;
}

/** One endpoint, read-only: its facts, its actions and its own delivery log. Editing is its own page. */
export function WebhookEndpointDetailView(props: WebhookEndpointDetailViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageWebhooks}
			loading={<Skeleton className="h-96 rounded-xl" />}
			fallback={<MerchantAccessDenied title="Webhook access required" description="Only members allowed to manage webhooks (owners, by default) can see endpoints." />}>
			<WebhookEndpointDetailContent {...props} />
		</MerchantCapabilityGate>
	);
}

interface FactProps {
	readonly label: string;
	readonly children: React.ReactNode;
}

function Fact({ label, children }: FactProps): React.JSX.Element {
	return (
		<div className="space-y-1">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="text-sm text-foreground">{children}</dd>
		</div>
	);
}

function EndpointFacts({ endpoint }: { readonly endpoint: WebhookEndpointSummary }): React.JSX.Element {
	const previousStillSigns = endpoint.previousSecretExpiresAt !== null;
	return (
		<dl className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
			<Fact label="Events">
				<span className="flex flex-wrap gap-1.5">
					{endpoint.eventTypes.map((type) => (
						<code key={type} className="rounded bg-muted px-1.5 py-0.5 text-xs">
							{type}
						</code>
					))}
				</span>
			</Fact>
			<Fact label="Signing secret">
				<span className="font-mono">whsec_…{endpoint.secretHint}</span>
				{previousStillSigns && endpoint.previousSecretExpiresAt !== null ? (
					<span className="block text-xs text-muted-foreground">
						The previous secret also signs until <RelativeTime epochMs={endpoint.previousSecretExpiresAt} region={PLATFORM_DISPLAY_REGION} />
					</span>
				) : null}
			</Fact>
			<Fact label="Last delivery">
				{endpoint.lastDeliveryAt === null ? "Nothing sent yet" : <RelativeTime epochMs={endpoint.lastDeliveryAt} region={PLATFORM_DISPLAY_REGION} />}
			</Fact>
			<Fact label="Added">
				<RelativeTime epochMs={endpoint.createdAt} region={PLATFORM_DISPLAY_REGION} />
			</Fact>
		</dl>
	);
}

function WebhookEndpointDetailContent({ tenantSlug, endpointId }: WebhookEndpointDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const routes = tenantRoutes(tenantSlug).webhooks;
	const invalidateAll = useInvalidateWebhooks(tenantSlug);
	const invalidate = React.useCallback((): void => {
		invalidateAll();
		void queryClient.invalidateQueries({ queryKey: apiRouter.tenants.webhooks.endpoint.scopeKey({ tenantSlug, endpointId }) });
	}, [endpointId, invalidateAll, queryClient, tenantSlug]);

	const endpointQuery = api.tenants.webhooks.endpoint.useQuery({ tenantSlug, endpointId });
	const deliveriesQuery = api.tenants.webhooks.deliveries.useQuery(webhookDeliveriesRequest(tenantSlug, endpointId));
	const redelivery = useWebhookRedelivery(tenantSlug, invalidate);

	const [secret, setSecret] = React.useState<string | null>(null);
	const [isRemoveOpen, setIsRemoveOpen] = React.useState<boolean>(false);
	const [isRotateOpen, setIsRotateOpen] = React.useState<boolean>(false);
	const [keepPrevious, setKeepPrevious] = React.useState<boolean>(true);

	const testMutation = api.tenants.webhooks.sendTest.useMutation({ onSettled: invalidate });
	const enableMutation = api.tenants.webhooks.enableEndpoint.useMutation({ onSuccess: invalidate });
	const disableMutation = api.tenants.webhooks.disableEndpoint.useMutation({ onSuccess: invalidate });
	const rotateMutation = api.tenants.webhooks.rotateSecret.useMutation({
		onSuccess: (response): void => {
			setSecret(response.data.secret);
			setIsRotateOpen(false);
			invalidate();
		},
	});
	const removeMutation = api.tenants.webhooks.deleteEndpoint.useMutation({
		onSuccess: (): void => {
			invalidateAll();
			router.push(appRoute(routes.list));
		},
	});

	const endpoint = endpointQuery.data?.data;
	const actionError = [testMutation.error, enableMutation.error, disableMutation.error].find((error) => error !== null) ?? null;

	const handleTest = React.useCallback((): void => {
		testMutation.mutate({ tenantSlug, endpointId });
	}, [endpointId, tenantSlug, testMutation]);
	const handleToggle = React.useCallback((): void => {
		if (endpoint?.status === "ACTIVE") {
			disableMutation.mutate({ tenantSlug, endpointId });
		} else {
			enableMutation.mutate({ tenantSlug, endpointId });
		}
	}, [disableMutation, enableMutation, endpoint?.status, endpointId, tenantSlug]);
	const handleOpenRotate = React.useCallback((): void => {
		rotateMutation.reset();
		setKeepPrevious(true);
		setIsRotateOpen(true);
	}, [rotateMutation]);
	const handleRotateOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!rotateMutation.isPending) {
				setIsRotateOpen(open);
			}
		},
		[rotateMutation.isPending],
	);
	const handleKeepPreviousChange = React.useCallback((checked: boolean): void => {
		setKeepPrevious(checked);
	}, []);
	const handleConfirmRotate = React.useCallback((): void => {
		rotateMutation.mutate({ tenantSlug, endpointId, keepPreviousForHours: keepPrevious ? DEFAULT_WEBHOOK_SECRET_GRACE_HOURS : 0 });
	}, [endpointId, keepPrevious, rotateMutation, tenantSlug]);
	const handleOpenRemove = React.useCallback((): void => {
		removeMutation.reset();
		setIsRemoveOpen(true);
	}, [removeMutation]);
	const handleRemoveOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!removeMutation.isPending) {
				setIsRemoveOpen(open);
			}
		},
		[removeMutation.isPending],
	);
	const handleConfirmRemove = React.useCallback((): void => {
		removeMutation.mutate({ tenantSlug, endpointId });
	}, [endpointId, removeMutation, tenantSlug]);
	const handleDismissSecret = React.useCallback((): void => {
		setSecret(null);
	}, []);
	const refetchDeliveries = deliveriesQuery.refetch;
	const handleRetryDeliveries = React.useCallback((): void => {
		void refetchDeliveries();
	}, [refetchDeliveries]);

	if (endpointQuery.isPending) {
		return <Skeleton className="h-96 rounded-xl" />;
	}
	if (endpoint === undefined) {
		return (
			<div className="space-y-6">
				<MerchantPageHeader title="Endpoint not found" description="It may have been removed." />
				<Button variant="outline" render={<Link href={appRoute(routes.list)} />}>
					Back to webhooks
				</Button>
			</div>
		);
	}

	const status = endpointStatusPresentation(endpoint);
	const isActive = endpoint.status === "ACTIVE";
	const isToggling = enableMutation.isPending || disableMutation.isPending;

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title={endpoint.description === "" ? "Webhook endpoint" : endpoint.description}
				description={endpoint.url}
				actions={
					<div className="flex flex-wrap gap-2">
						<Button onClick={handleTest} disabled={!isActive || testMutation.isPending}>
							<Send className="size-4" aria-hidden="true" />
							{testMutation.isPending ? "Sending…" : "Send test event"}
						</Button>
						<Button variant="outline" render={<Link href={appRoute(routes.edit(endpointId))} />}>
							<Pencil className="size-4" aria-hidden="true" />
							Edit
						</Button>
					</div>
				}
			/>

			<div className="flex flex-wrap items-center gap-3">
				<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
				{status.note === null ? null : <p className="text-sm text-muted-foreground">{status.note}</p>}
			</div>

			{secret === null ? null : <WebhookSecretNotice heading="Signing secret replaced" secret={secret} onDismiss={handleDismissSecret} />}
			{testMutation.isSuccess ? (
				<p role="status" className="text-sm text-muted-foreground">
					Test event queued. Its delivery appears below within a few seconds.
				</p>
			) : null}
			{actionError === null ? null : (
				<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					{userSafeErrorMessage(actionError, ACTION_FAILED_MESSAGE)}
				</p>
			)}

			<EndpointFacts endpoint={endpoint} />

			<div className="flex flex-wrap gap-2">
				<Button variant="outline" onClick={handleToggle} disabled={isToggling}>
					{isActive ? <PowerOff className="size-4" aria-hidden="true" /> : <Power className="size-4" aria-hidden="true" />}
					{isActive ? "Switch off" : "Switch on"}
				</Button>
				<Button variant="outline" onClick={handleOpenRotate}>
					<KeyRound className="size-4" aria-hidden="true" />
					Replace signing secret
				</Button>
				<Button variant="outline" onClick={handleOpenRemove}>
					<Trash2 className="size-4" aria-hidden="true" />
					Remove
				</Button>
			</div>

			<WebhookDeliveryLog
				deliveries={deliveriesQuery.data?.data ?? []}
				isLoading={deliveriesQuery.isPending}
				isError={deliveriesQuery.isError}
				onRetry={handleRetryDeliveries}
				showEndpoint={false}
				redeliveringId={redelivery.redeliveringId}
				onRedeliver={redelivery.redeliver}
				redeliverError={redelivery.error}
			/>

			<AlertDialog open={isRotateOpen} onOpenChange={handleRotateOpenChange}>
				<AlertDialogContent align="start" actionOrder="cancel-first" labels={ROTATE_DIALOG_LABELS} confirmLoading={rotateMutation.isPending} onConfirm={handleConfirmRotate}>
					<AlertDialogMedia>
						<KeyRound aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Replace the signing secret?</AlertDialogTitle>
					<AlertDialogDescription>You get a new secret to put on your server. Deliveries are signed with it from now on.</AlertDialogDescription>
					<Label className="flex items-start gap-3 text-sm font-normal">
						<Checkbox checked={keepPrevious} onCheckedChange={handleKeepPreviousChange} className="mt-0.5" />
						<span>Keep the old secret working for {String(DEFAULT_WEBHOOK_SECRET_GRACE_HOURS)} hours, so your server can switch over. Untick if the old one leaked.</span>
					</Label>
					{rotateMutation.error === null ? null : (
						<p role="alert" className="text-sm text-destructive">
							{userSafeErrorMessage(rotateMutation.error, ACTION_FAILED_MESSAGE)}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={isRemoveOpen} onOpenChange={handleRemoveOpenChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={REMOVE_DIALOG_LABELS}
					confirmLoading={removeMutation.isPending}
					onConfirm={handleConfirmRemove}>
					<AlertDialogMedia severity="critical">
						<Trash2 aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Remove this endpoint?</AlertDialogTitle>
					<AlertDialogDescription>Nothing more is sent to {endpoint.url}. Deliveries still waiting are cancelled; past ones stay in the log.</AlertDialogDescription>
					{removeMutation.error === null ? null : (
						<p role="alert" className="text-sm text-destructive">
							{userSafeErrorMessage(removeMutation.error, ACTION_FAILED_MESSAGE)}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
