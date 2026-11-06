import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { TEST_RESOLVE_PUBLIC_URL } from "../../../../../../e2e/support/public-urls";
import { createTestTypedConfig } from "../../../../../../e2e/support/test-api-env";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { RlsTransactionScope } from "../../../../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import type { RlsTransactionRunner } from "../../../../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { PrismaService } from "../../../../../prisma/prisma.service";
import type { TenantDisplayData, TenantReadPort } from "../../../../tenancy/public-api";
import { TenantDisplayAdapter } from "../../adapters/tenant-display.adapter";
import { PrismaRewardReadRepository } from "../prisma-reward.read-repository";
import { RewardsReadSession } from "../rewards-read-session";
import { buildRewardRow } from "./reward-row.fixture";

vi.mock("../../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const ACTOR: ActorContext = {
	kind: "user",
	userId: "customer-1",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
};
const PAGE_QUERY = { page: 1, limit: 12 };

/**
 * A transaction runner that records whether one of its transactions is open, and a database whose reward reads
 * answer with one row.
 */
function recordingRunner(row: ReturnType<typeof buildRewardRow>): { readonly runner: RlsTransactionRunner<Prisma.TransactionClient>; readonly isOpen: () => boolean } {
	let open = false;
	const db = Object.assign(new PrismaService(createTestTypedConfig()), {
		reward: {
			count: (): Promise<number> => Promise.resolve(1),
			findMany: (): Promise<readonly ReturnType<typeof buildRewardRow>[]> => Promise.resolve([row]),
			findFirst: (): Promise<ReturnType<typeof buildRewardRow>> => Promise.resolve(row),
		},
	});
	const runner: RlsTransactionRunner<Prisma.TransactionClient> = {
		withRlsContext: async <TResult>(_scope: RlsTransactionScope, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> => {
			open = true;
			try {
				return await handler(db);
			} finally {
				open = false;
			}
		},
	};
	return { runner, isOpen: (): boolean => open };
}

/** The tenants context's reader, noting whether a reward transaction was still open when it was asked. */
function recordingTenants(isOpen: () => boolean): { readonly tenants: TenantReadPort; readonly askedWhileOpen: boolean[] } {
	const askedWhileOpen: boolean[] = [];
	return {
		askedWhileOpen,
		tenants: {
			getDisplayData: (): Promise<ReadonlyMap<string, TenantDisplayData>> => {
				askedWhileOpen.push(isOpen());
				return Promise.resolve(new Map());
			},
			listOwnerUserIds: (): Promise<readonly string[]> => Promise.resolve([]),
		},
	};
}

function repository(): { readonly reader: PrismaRewardReadRepository; readonly askedWhileOpen: readonly boolean[] } {
	const { runner, isOpen } = recordingRunner(buildRewardRow());
	const { tenants, askedWhileOpen } = recordingTenants(isOpen);
	return { reader: new PrismaRewardReadRepository(new RewardsReadSession(runner), new TenantDisplayAdapter(tenants), TEST_RESOLVE_PUBLIC_URL), askedWhileOpen };
}

describe("PrismaRewardReadRepository", () => {
	// The merchants' display read is a transaction (a pooled connection) of its own: opened while a reward read
	// still held its connection, concurrent requests used up the pool and the reads expired (GET /rewards → 500).
	it.each([
		["the marketplace", (reader: PrismaRewardReadRepository): Promise<object> => reader.listMarketplace(ACTOR, PAGE_QUERY)],
		["the admin review queue", (reader: PrismaRewardReadRepository): Promise<object> => reader.listPendingReview(ACTOR, PAGE_QUERY)],
		["one published reward", (reader: PrismaRewardReadRepository): Promise<object | null> => reader.findPublished(ACTOR, "reward-1")],
		["one reward under review", (reader: PrismaRewardReadRepository): Promise<object | null> => reader.findConsumerForReview(ACTOR, "reward-1")],
	])("reads the merchants' names and logos for %s only after its reward transaction has closed", async (_name, read) => {
		const { reader, askedWhileOpen } = repository();

		await read(reader);

		expect(askedWhileOpen).toEqual([false]);
	});
});
