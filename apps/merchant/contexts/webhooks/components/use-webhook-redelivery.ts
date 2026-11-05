"use client";

import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { WebhookDeliverySummary } from "@workspace/shared";
import * as React from "react";

const REDELIVER_FAILED_MESSAGE = "The delivery could not be sent again. Try again.";

export interface WebhookRedelivery {
	readonly redeliveringId: string | null;
	readonly redeliver: (delivery: WebhookDeliverySummary) => void;
	readonly error: string | null;
}

/** "Send again" for a settled delivery: one in flight at a time, the log refreshed after. */
export function useWebhookRedelivery(tenantSlug: string, onDone: () => void): WebhookRedelivery {
	const { api } = useAuth();
	const [redeliveringId, setRedeliveringId] = React.useState<string | null>(null);
	const mutation = api.tenants.webhooks.redeliver.useMutation({
		onSettled: (): void => {
			setRedeliveringId(null);
			onDone();
		},
	});
	const mutate = mutation.mutate;
	const redeliver = React.useCallback(
		(delivery: WebhookDeliverySummary): void => {
			setRedeliveringId(delivery.id);
			mutate({ tenantSlug, deliveryId: delivery.id });
		},
		[mutate, tenantSlug],
	);
	return { redeliveringId, redeliver, error: mutation.error === null ? null : userSafeErrorMessage(mutation.error, REDELIVER_FAILED_MESSAGE) };
}
