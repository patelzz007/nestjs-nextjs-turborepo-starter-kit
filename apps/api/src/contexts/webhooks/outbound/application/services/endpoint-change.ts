import type { WebhookEndpoint, WebhookEndpointState } from "../../domain/aggregates/webhook-endpoint.aggregate";
import { WebhookEndpointChangedError, WebhookEndpointNotFoundError } from "../../domain/errors/webhooks.errors";
import type { WebhooksScope } from "../webhooks-scope";

/**
 * One member change to one live endpoint of the tenant: load it, apply `change`, and save it as a compare-and-set
 * on the version it was read at (a concurrent change by someone else is refused, never overwritten). An endpoint of
 * another tenant is answered as not found. Answers the endpoint as it is now stored (a save bumps its version).
 */
export async function changeLiveEndpoint(
	scope: WebhooksScope,
	tenantId: string,
	endpointId: string,
	change: (endpoint: WebhookEndpoint) => void,
): Promise<WebhookEndpointState> {
	const endpoint = await scope.endpoints.findLive(tenantId, endpointId);
	if (endpoint === null) {
		throw new WebhookEndpointNotFoundError(endpointId);
	}
	change(endpoint);
	if (!endpoint.isChanged) {
		return endpoint.snapshot;
	}
	if (!(await scope.endpoints.save(endpoint))) {
		throw new WebhookEndpointChangedError(endpointId);
	}
	return { ...endpoint.snapshot, version: endpoint.snapshot.version + 1 };
}
