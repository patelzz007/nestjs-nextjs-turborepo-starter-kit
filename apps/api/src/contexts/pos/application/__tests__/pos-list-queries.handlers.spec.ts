import {
	MerchantApiKeyListQuerySchema,
	MerchantRedemptionListQuerySchema,
	type MerchantApiKeySummary,
	type MerchantRedemptionListItem,
	type MerchantTerminalStatusSummary,
	type MerchantTerminalSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { FakeMerchantAccessPort } from "../../../../platform/application/__tests__/fakes/fake-merchant-access.port";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import { AuthorizationDeniedError } from "../../../../platform/domain/errors/authorization-denied.error";
import type { ApiKeyReadPort, RedemptionReadPort, TerminalReadPort } from "../ports/pos-read.port";
import { GetTerminalSummaryQuery } from "../queries/get-terminal-summary/get-terminal-summary.query";
import { GetTerminalSummaryHandler } from "../queries/get-terminal-summary/get-terminal-summary.handler";
import { ListApiKeysQuery } from "../queries/list-api-keys/list-api-keys.query";
import { ListApiKeysHandler } from "../queries/list-api-keys/list-api-keys.handler";
import { ListTenantRedemptionsQuery } from "../queries/list-tenant-redemptions/list-tenant-redemptions.query";
import { ListTenantRedemptionsHandler } from "../queries/list-tenant-redemptions/list-tenant-redemptions.handler";
import { apiKeyActor, member, NOW, TENANT_ID, STORE_A, STORE_B } from "./fakes/pos.fakes";

/** One call a read port received: who asked, within which grant, with which query. */
interface ReadCall<TQuery> {
	readonly actor: ActorContext;
	readonly grant: MerchantAccessGrant;
	readonly query: TQuery;
}

/** A page of `items` as the list would answer page `page` of size `limit` with `total` rows. */
function page<TItem>(items: readonly TItem[], total: number, pageNumber: number, limit: number): PaginatedServiceResult<TItem> {
	const totalPages = Math.ceil(total / limit);
	return { items: [...items], total, page: pageNumber, limit, totalPages, nextCursor: null, hasNext: pageNumber < totalPages, hasPrevious: pageNumber > 1 };
}

const KEY: MerchantApiKeySummary = {
	id: "8a1b5f3e-4c2d-4e8f-9a7b-1c2d3e4f5a6b",
	name: "Front till",
	locationId: null,
	locationName: null,
	scope: "POS",
	revokedAt: null,
	createdAt: NOW,
	updatedAt: NOW,
	isDeleted: false,
	deletedAt: null,
};

const REDEMPTION: MerchantRedemptionListItem = {
	redemptionId: "1f2e3d4c-5b6a-4789-8a9b-0c1d2e3f4a5b",
	rewardTitle: "Free latte",
	redeemedAt: NOW,
	terminalId: "TERM-AAAA2222",
	redemptionMethod: "SCAN",
	customerBanned: false,
};

class RecordingApiKeyReads implements ApiKeyReadPort {
	public readonly calls: ReadCall<ListApiKeysQuery["input"]>[] = [];

	public list(actor: ActorContext, grant: MerchantAccessGrant, query: ListApiKeysQuery["input"]): Promise<PaginatedServiceResult<MerchantApiKeySummary>> {
		this.calls.push({ actor, grant, query });
		return Promise.resolve(page([KEY], 6, query.page, query.limit));
	}
}

class RecordingRedemptionReads implements RedemptionReadPort {
	public readonly calls: ReadCall<ListTenantRedemptionsQuery["input"]>[] = [];

	public list(actor: ActorContext, grant: MerchantAccessGrant, query: ListTenantRedemptionsQuery["input"]): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		this.calls.push({ actor, grant, query });
		return Promise.resolve(page([REDEMPTION], 1, query.page, query.limit));
	}
}

class RecordingTerminalSummaries implements TerminalReadPort {
	public readonly calls: ReadCall<number>[] = [];

	public list(): Promise<PaginatedServiceResult<MerchantTerminalSummary>> {
		return Promise.reject(new Error("not used"));
	}

	public summary(actor: ActorContext, grant: MerchantAccessGrant, now: number): Promise<MerchantTerminalStatusSummary> {
		this.calls.push({ actor, grant, query: now });
		return Promise.resolve({ total: 3, byStatus: { AWAITING_PAIRING: 1, ACTIVE: 1, UNPAIRED: 1 }, storesWithTerminals: 2 });
	}

	public find(): Promise<MerchantTerminalSummary | null> {
		return Promise.resolve(null);
	}
}

describe("ListApiKeysHandler", () => {
	it("pages the tenant's keys within the member's grant, read in the tenant's RLS session", async () => {
		const reads = new RecordingApiKeyReads();
		const input = { ...MerchantApiKeyListQuerySchema.parse({ page: "2", limit: "5" }), tenantId: TENANT_ID };

		await expect(new ListApiKeysHandler(new FakeMerchantAccessPort(), reads).execute(new ListApiKeysQuery(member(), input))).resolves.toMatchObject({
			items: [KEY],
			page: 2,
			limit: 5,
			total: 6,
			totalPages: 2,
			hasNext: false,
			hasPrevious: true,
		});

		expect(reads.calls).toEqual([
			{ actor: { ...member(), tenantId: TENANT_ID }, grant: { tenantId: TENANT_ID, locationScope: "ALL_LOCATIONS", locationIds: [] }, query: input },
		]);
	});

	it("narrows to a requested store, and reads nothing for a store outside a store-limited member's grant", async () => {
		const reads = new RecordingApiKeyReads();
		const handler = new ListApiKeysHandler(new FakeMerchantAccessPort().grantLocations([STORE_A]), reads);
		const query = (locationId: string): ListApiKeysQuery => new ListApiKeysQuery(member(), { ...MerchantApiKeyListQuerySchema.parse({}), locationId, tenantId: TENANT_ID });

		await handler.execute(query(STORE_A));
		await expect(handler.execute(query(STORE_B))).rejects.toBeInstanceOf(AuthorizationDeniedError);

		expect(reads.calls.map((call) => call.grant)).toEqual([{ tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: [STORE_A] }]);
	});

	it("reads nothing without the capability", async () => {
		const reads = new RecordingApiKeyReads();

		await expect(
			new ListApiKeysHandler(new FakeMerchantAccessPort().deny("merchant:manage_api_keys"), reads).execute(
				new ListApiKeysQuery(member(), { ...MerchantApiKeyListQuerySchema.parse({}), tenantId: TENANT_ID }),
			),
		).rejects.toBeInstanceOf(AuthorizationDeniedError);
		expect(reads.calls).toEqual([]);
	});
});

describe("ListTenantRedemptionsHandler", () => {
	it("pages the history for a member, bound to the tenant", async () => {
		const reads = new RecordingRedemptionReads();
		const input = { ...MerchantRedemptionListQuerySchema.parse({ limit: "10" }), tenantId: TENANT_ID };

		await expect(new ListTenantRedemptionsHandler(new FakeMerchantAccessPort(), reads).execute(new ListTenantRedemptionsQuery(member(), input))).resolves.toEqual(
			page([REDEMPTION], 1, 1, 10),
		);
		expect(reads.calls).toEqual([
			{ actor: { ...member(), tenantId: TENANT_ID }, grant: { tenantId: TENANT_ID, locationScope: "ALL_LOCATIONS", locationIds: [] }, query: input },
		]);
	});

	it("reads a key's history as the key itself (already bound to its tenant), with the view capability", async () => {
		const reads = new RecordingRedemptionReads();
		const access = new FakeMerchantAccessPort();

		await new ListTenantRedemptionsHandler(access, reads).execute(
			new ListTenantRedemptionsQuery(apiKeyActor(), { ...MerchantRedemptionListQuerySchema.parse({}), tenantId: TENANT_ID }),
		);

		expect(access.requests.map((recorded) => recorded.request)).toEqual([{ tenantId: TENANT_ID, capability: "merchant:view_redemptions", locationId: null }]);
		expect(reads.calls.map((call) => call.actor)).toEqual([apiKeyActor()]);
	});

	it("reads nothing without the capability", async () => {
		const reads = new RecordingRedemptionReads();

		await expect(
			new ListTenantRedemptionsHandler(new FakeMerchantAccessPort().deny("merchant:view_redemptions"), reads).execute(
				new ListTenantRedemptionsQuery(member(), { ...MerchantRedemptionListQuerySchema.parse({}), tenantId: TENANT_ID }),
			),
		).rejects.toBeInstanceOf(AuthorizationDeniedError);
		expect(reads.calls).toEqual([]);
	});
});

describe("GetTerminalSummaryHandler", () => {
	it("counts the tills within the member's grant at the clock's time", async () => {
		const reads = new RecordingTerminalSummaries();

		await expect(
			new GetTerminalSummaryHandler(new FakeMerchantAccessPort(), reads, new FixedClock(NOW)).execute(
				new GetTerminalSummaryQuery(member(), { tenantId: TENANT_ID, locationId: STORE_A }),
			),
		).resolves.toEqual({ total: 3, byStatus: { AWAITING_PAIRING: 1, ACTIVE: 1, UNPAIRED: 1 }, storesWithTerminals: 2 });
		expect(reads.calls).toEqual([
			{ actor: { ...member(), tenantId: TENANT_ID }, grant: { tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: [STORE_A] }, query: NOW },
		]);
	});

	it("counts nothing without the capability", async () => {
		const reads = new RecordingTerminalSummaries();

		await expect(
			new GetTerminalSummaryHandler(new FakeMerchantAccessPort().deny("merchant:manage_api_keys"), reads, new FixedClock(NOW)).execute(
				new GetTerminalSummaryQuery(member(), { tenantId: TENANT_ID }),
			),
		).rejects.toBeInstanceOf(AuthorizationDeniedError);
		expect(reads.calls).toEqual([]);
	});
});
