import { describe, expect, it } from "vitest";
import { epochMs, type CapabilityDefinition } from "@workspace/shared";

import { UserAuthorizationChanged } from "../../domain/events/user-authorization-changed.event";
import { PurgeOldPermissionAuditLogsCommand } from "../commands/purge-old-permission-audit-logs/purge-old-permission-audit-logs.command";
import { PERMISSION_AUDIT_RETENTION_MS, PurgeOldPermissionAuditLogsHandler } from "../commands/purge-old-permission-audit-logs/purge-old-permission-audit-logs.handler";
import { SyncCapabilityCatalogCommand } from "../commands/sync-capability-catalog/sync-capability-catalog.command";
import { SyncCapabilityCatalogHandler } from "../commands/sync-capability-catalog/sync-capability-catalog.handler";
import { SyncPermissionRegistryCommand } from "../commands/sync-permission-registry/sync-permission-registry.command";
import { SyncPermissionRegistryHandler } from "../commands/sync-permission-registry/sync-permission-registry.handler";
import { SyncReferenceDataCommand } from "../commands/sync-reference-data/sync-reference-data.command";
import { SyncReferenceDataHandler } from "../commands/sync-reference-data/sync-reference-data.handler";
import { InvalidateAuthorizationOnUserAuthorizationChanged } from "../event-handlers/after-commit/invalidate-authorization-on-user-authorization-changed.event-handler";
import type { AuthorizationCacheInvalidationPort, UserInvalidationScope, UserInvalidationTrigger } from "../ports/authorization-cache-invalidation.port";
import type { ReferenceDataSyncPort, ReferenceDataSyncReport } from "../ports/catalog-sync.port";
import type { CapabilityCatalogReadPort } from "../ports/rbac-read.port";
import { authorizationSystemActor } from "../services/rbac-actor";
import { InMemoryAuthorizationStore, NOW } from "./fakes/authorization.fakes";

class RecordingInvalidation implements AuthorizationCacheInvalidationPort {
	public readonly users: { readonly userIds: readonly string[]; readonly scope: UserInvalidationScope }[] = [];
	public cleared = 0;

	public constructor(private readonly failure: Error | null = null) {}

	public invalidateUsers(userIds: readonly string[], scope: UserInvalidationScope): Promise<void> {
		if (this.failure !== null) {
			return Promise.reject(this.failure);
		}
		this.users.push({ userIds, scope });
		return Promise.resolve();
	}

	public clearAll(): Promise<void> {
		this.cleared += 1;
		return Promise.resolve();
	}

	public invalidateUsersOnThisInstance(userIds: readonly string[], trigger: UserInvalidationTrigger): void {
		this.users.push({ userIds, scope: { accessTokenState: true, trigger } });
	}
}

class CountingCapabilityCatalog implements CapabilityCatalogReadPort {
	public invalidations = 0;

	public listCatalog(): Promise<CapabilityDefinition[]> {
		return Promise.resolve([]);
	}

	public invalidate(): void {
		this.invalidations += 1;
	}
}

const bootstrap = authorizationSystemActor("authorization.permission_registry.sync", "bootstrap", "boot sync");

describe("Boot-time catalog sync (D21)", () => {
	it("syncs the permission registry under the catalog lock, clearing caches only when rows changed", async () => {
		const store = new InMemoryAuthorizationStore();
		const invalidation = new RecordingInvalidation();
		const handler = new SyncPermissionRegistryHandler(store.uow, invalidation);

		await handler.execute(new SyncPermissionRegistryCommand(bootstrap));
		expect(store.catalog.locks).toBe(1);
		expect(store.catalog.synced.at(0)?.length).toBeGreaterThan(0);
		expect(invalidation.cleared).toBe(0);

		store.catalog.registryResult = { created: [], updated: [], orphaned: [{ id: "p-x", action: "READ", resource: "USER" }] };
		await handler.execute(new SyncPermissionRegistryCommand(bootstrap));
		expect(invalidation.cleared).toBe(0);

		const [definition] = store.catalog.synced.at(0) ?? [];
		if (definition === undefined) {
			throw new Error("the registry has definitions");
		}
		store.catalog.registryResult = { created: [definition], updated: [], orphaned: [] };
		await handler.execute(new SyncPermissionRegistryCommand(bootstrap));
		expect(invalidation.cleared).toBe(1);
	});

	it("converges platform capabilities under the same lock, then drops the per-process catalog copy", async () => {
		const store = new InMemoryAuthorizationStore();
		const catalog = new CountingCapabilityCatalog();
		store.catalog.capabilityResult = { created: 2, updated: 1 };

		await expect(
			new SyncCapabilityCatalogHandler(store.uow, catalog).execute(
				new SyncCapabilityCatalogCommand(authorizationSystemActor("authorization.capability_catalog.sync", "bootstrap", "boot sync")),
			),
		).resolves.toEqual({ created: 2, updated: 1 });

		expect(store.catalog.locks).toBe(1);
		expect(catalog.invalidations).toBe(1);
	});

	it("runs the reference-data sync through its port", async () => {
		const report: ReferenceDataSyncReport = { sections: [{ section: "roles", change: { created: 1, updated: 0, restored: 0, retired: 0 } }], totalChanges: 1 };
		const port: ReferenceDataSyncPort = { sync: (): Promise<ReferenceDataSyncReport> => Promise.resolve(report) };

		await expect(new SyncReferenceDataHandler(port).execute(new SyncReferenceDataCommand(authorizationSystemActor("reference_data.sync", "cli", "sync")))).resolves.toEqual(
			report,
		);
	});
});

describe("PurgeOldPermissionAuditLogsHandler", () => {
	it("retires audit rows older than the retention window, as of now", async () => {
		const store = new InMemoryAuthorizationStore();
		store.permissionAudit.retireCount = 4;

		await expect(
			new PurgeOldPermissionAuditLogsHandler(store.uow, store.clock).execute(
				new PurgeOldPermissionAuditLogsCommand(authorizationSystemActor("maintenance.audit_log_retention", "cron", "purge")),
			),
		).resolves.toBe(4);

		expect(store.permissionAudit.retired).toEqual([{ cutoff: epochMs(NOW - PERMISSION_AUDIT_RETENTION_MS), now: NOW }]);
	});
});

describe("After-commit invalidation", () => {
	it("drops the changed users' authorization and access-token state everywhere", async () => {
		const invalidation = new RecordingInvalidation();

		await new InvalidateAuthorizationOnUserAuthorizationChanged(invalidation).handle(new UserAuthorizationChanged(NOW, ["user-1", "user-2"]));

		expect(invalidation.users).toEqual([{ userIds: ["user-1", "user-2"], scope: { accessTokenState: true, trigger: "rbac_mutation" } }]);
	});

	it("logs instead of throwing after commit when the cache is unavailable", async () => {
		const broken = new RecordingInvalidation(new Error("redis down"));

		await expect(new InvalidateAuthorizationOnUserAuthorizationChanged(broken).handle(new UserAuthorizationChanged(NOW, ["user-1"]))).resolves.toBeUndefined();
	});
});
