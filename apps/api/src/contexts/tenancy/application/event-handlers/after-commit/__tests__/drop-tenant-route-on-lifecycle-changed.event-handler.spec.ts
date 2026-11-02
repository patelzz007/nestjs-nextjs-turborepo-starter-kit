import { Logger } from "@nestjs/common";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import type { TenantRouteCachePort } from "../../../../../../platform/application/tenancy/tenant-route-cache.port";
import { TenantLifecycleChanged } from "../../../../domain/events/tenants.events";
import { DropTenantRouteOnLifecycleChangedHandler } from "../drop-tenant-route-on-lifecycle-changed.event-handler";

class RecordingRouteCache implements TenantRouteCachePort {
	public readonly dropped: string[] = [];

	public constructor(private readonly failing = false) {}

	public invalidateTenant(tenantId: string): Promise<void> {
		this.dropped.push(tenantId);
		return this.failing ? Promise.reject(new Error("redis down")) : Promise.resolve();
	}
}

describe("DropTenantRouteOnLifecycleChangedHandler", () => {
	it("drops the tenant's cached routes after a lifecycle change commits", async () => {
		const cache = new RecordingRouteCache();
		await new DropTenantRouteOnLifecycleChangedHandler(cache).handle(new TenantLifecycleChanged(epochMs(1), "tenant-acme", "ACTIVE", "SUSPENDED"));
		expect(cache.dropped).toEqual(["tenant-acme"]);
	});

	it("logs, and never throws, when the cache cannot be cleared", async () => {
		const error = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		await expect(
			new DropTenantRouteOnLifecycleChangedHandler(new RecordingRouteCache(true)).handle(new TenantLifecycleChanged(epochMs(1), "tenant-acme", "ACTIVE", "BANNED")),
		).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledWith(expect.objectContaining({ event: "tenancy.route_cache_invalidation_failed", tenantId: "tenant-acme" }));
		error.mockRestore();
	});
});
