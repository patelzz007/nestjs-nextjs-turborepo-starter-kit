"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy";
import { useWebhookEndpointFieldHandlers, WebhookEndpointFields } from "@/contexts/webhooks/components/webhook-endpoint-fields";
import { useInvalidateWebhooks } from "@/contexts/webhooks/components/webhooks-page-view";
import { formValuesOf, parseWebhookEndpointForm, toggleEventType, type WebhookEndpointFormValues } from "@/contexts/webhooks/lib/webhook-presentation";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MERCHANT_CAPABILITY, type WebhookEndpointSummary } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const SAVE_FAILED_MESSAGE = "The changes could not be saved. Try again.";

export interface WebhookEndpointEditViewProps {
	readonly tenantSlug: string;
	readonly endpointId: string;
}

/** The endpoint editor: its address, description and events. Saving returns to the endpoint. */
export function WebhookEndpointEditView(props: WebhookEndpointEditViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageWebhooks}
			loading={<Skeleton className="h-96 rounded-xl" />}
			fallback={<MerchantAccessDenied title="Webhook access required" description="Only members allowed to manage webhooks (owners, by default) can change endpoints." />}>
			<WebhookEndpointEditLoader {...props} />
		</MerchantCapabilityGate>
	);
}

function WebhookEndpointEditLoader({ tenantSlug, endpointId }: WebhookEndpointEditViewProps): React.JSX.Element {
	const { api } = useAuth();
	const endpointQuery = api.tenants.webhooks.endpoint.useQuery({ tenantSlug, endpointId });
	const endpoint = endpointQuery.data?.data;
	if (endpointQuery.isPending) {
		return <Skeleton className="h-96 rounded-xl" />;
	}
	if (endpoint === undefined) {
		return (
			<div className="space-y-6">
				<MerchantPageHeader title="Endpoint not found" description="It may have been removed." />
				<Button variant="outline" render={<Link href={tenantRoutes(tenantSlug).webhooks.list} />}>
					Back to webhooks
				</Button>
			</div>
		);
	}
	// Keyed by version: a newer copy of the endpoint starts the form again from its values.
	return <WebhookEndpointEditForm key={endpoint.version} tenantSlug={tenantSlug} endpoint={endpoint} />;
}

interface WebhookEndpointEditFormProps {
	readonly tenantSlug: string;
	readonly endpoint: WebhookEndpointSummary;
}

function WebhookEndpointEditForm({ tenantSlug, endpoint }: WebhookEndpointEditFormProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const routes = tenantRoutes(tenantSlug).webhooks;
	const invalidateAll = useInvalidateWebhooks(tenantSlug);
	const [values, setValues] = React.useState<WebhookEndpointFormValues>(() => formValuesOf(endpoint));
	const handlers = useWebhookEndpointFieldHandlers(setValues, toggleEventType);
	const input = parseWebhookEndpointForm(values);

	const saveMutation = api.tenants.webhooks.updateEndpoint.useMutation({
		onSuccess: (): void => {
			invalidateAll();
			void queryClient.invalidateQueries({ queryKey: apiRouter.tenants.webhooks.endpoint.scopeKey({ tenantSlug, endpointId: endpoint.id }) });
			router.push(routes.detail(endpoint.id));
		},
	});

	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (input !== undefined) {
				saveMutation.mutate({ tenantSlug, endpointId: endpoint.id, ...input });
			}
		},
		[endpoint.id, input, saveMutation, tenantSlug],
	);

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Edit endpoint" description={endpoint.url} />
			<form onSubmit={handleSubmit} aria-label="Edit endpoint" className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
				<WebhookEndpointFields values={values} disabled={saveMutation.isPending} {...handlers} />
				{saveMutation.error === null ? null : (
					<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
						{userSafeErrorMessage(saveMutation.error, SAVE_FAILED_MESSAGE)}
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					<Button type="submit" disabled={input === undefined || saveMutation.isPending}>
						{saveMutation.isPending ? "Saving…" : "Save changes"}
					</Button>
					<Button variant="ghost" render={<Link href={routes.detail(endpoint.id)} />}>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
}
