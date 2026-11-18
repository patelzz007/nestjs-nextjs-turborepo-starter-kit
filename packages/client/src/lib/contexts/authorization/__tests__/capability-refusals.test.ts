import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@workspace/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeToCapabilityRefusals } from "../capability-refusals";

function apiError(statusCode: number, error: string): ApiError {
	return new ApiError({ message: "refused", error, statusCode });
}

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

afterEach(() => {
	client.clear();
});

function refuse(key: string, error: Error): Promise<void> {
	return client
		.query({ queryKey: [key], queryFn: (): Promise<string> => Promise.reject(error) })
		.then((): void => undefined)
		.catch((): void => undefined);
}

describe("subscribeToCapabilityRefusals", () => {
	it("re-reads the capabilities when a query or a mutation is refused for them, and stops when unsubscribed", async () => {
		const refresh = vi.fn();
		const stop = subscribeToCapabilityRefusals(client, refresh);

		await refuse("refused", apiError(403, "PERMISSION_DENIED"));
		await refuse("missing", apiError(404, "NOT_FOUND"));
		await client
			.getMutationCache()
			.build(client, { mutationFn: (): Promise<string> => Promise.reject(apiError(403, "TENANT_ROLE_CAPABILITY_REQUIRED")) })
			.execute(undefined)
			.then((): void => undefined)
			.catch((): void => undefined);
		expect(refresh).toHaveBeenCalledTimes(2);

		stop();
		await refuse("after", apiError(403, "PERMISSION_DENIED"));
		expect(refresh).toHaveBeenCalledTimes(2);
	});
});
