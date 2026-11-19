import {
	EmailPreviewSchema,
	EmailTemplateKeySchema,
	PilotCitySchema,
	type AdminLocationRequestListQuery,
	type AdminLocationRequestResponse,
	type AdminMerchantDetailResponse,
	type AdminMerchantInvitePreviewQuery,
	type AdminMerchantListQuery,
	type EmailPreview,
	type MerchantTenantResponse,
	type OwnMembershipListQuery,
	type PaginatedServiceResult,
	type TenantContextResponse,
	type TenantLifecycleResponse,
	type TenantRewardMembershipResponse,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError, NotFoundError } from "../../../../platform/application/errors/app-error";
import type { MerchantAdminReadPort } from "../ports/merchant-admin-read.port";
import type { TenantContextReadPort } from "../ports/tenant-context-read.port";
import type { MerchantInviteEmailPreviewPort } from "../ports/tenant-emails.port";
import type { TenantLifecycleReadPort } from "../ports/tenant-lifecycle-read.port";
import { MerchantAdminApplicationService } from "../services/merchant-admin.application-service";
import { MerchantInviteApplicationService } from "../services/merchant-invite.application-service";
import { TenantContextApplicationService } from "../services/tenant-context.application-service";
import { TenantLifecycleApplicationService } from "../services/tenant-lifecycle.application-service";

const REQUEST = { requestId: "corr-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
const MEMBER: ActorContext = {
	kind: "user",
	userId: "user-1",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};
const ANONYMOUS: ActorContext = { kind: "anonymous", tenantId: null, request: REQUEST };
const TENANT_ID = "0193f2c4-0000-7000-8000-00000000a001";
const LIST_QUERY = { page: 1, limit: 20 };

function emptyPage<TItem>(): PaginatedServiceResult<TItem> {
	return { items: [], total: 0, page: 1, limit: LIST_QUERY.limit, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
}

/** The read model answered for a record the spec does not build: the call is what is checked. */
class ReadReached extends Error {}

describe("MerchantAdminApplicationService", () => {
	class RecordingMerchants implements MerchantAdminReadPort {
		public readonly asked: string[] = [];

		public listMerchants(_actor: ActorContext, _query: AdminMerchantListQuery): Promise<PaginatedServiceResult<MerchantTenantResponse>> {
			this.asked.push("merchants");
			return Promise.resolve(emptyPage());
		}

		public getMerchantDetail(_actor: ActorContext, tenantId: string): Promise<AdminMerchantDetailResponse | null> {
			this.asked.push(`detail:${tenantId}`);
			return tenantId === TENANT_ID ? Promise.reject(new ReadReached()) : Promise.resolve(null);
		}

		public listLocationRequests(_actor: ActorContext, _query: AdminLocationRequestListQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
			this.asked.push("location-requests");
			return Promise.resolve(emptyPage());
		}
	}

	it("lists merchants and location requests, and reads one merchant; an unknown one is MERCHANT_NOT_FOUND", async () => {
		const reads = new RecordingMerchants();
		const merchants = new MerchantAdminApplicationService(reads);

		await expect(merchants.listMerchants(MEMBER, LIST_QUERY)).resolves.toMatchObject({ items: [] });
		await expect(merchants.listLocationRequests(MEMBER, LIST_QUERY)).resolves.toMatchObject({ items: [] });
		await expect(merchants.getMerchantDetail(MEMBER, { tenantId: TENANT_ID })).rejects.toBeInstanceOf(ReadReached);
		await expect(merchants.getMerchantDetail(MEMBER, { tenantId: "unknown" })).rejects.toMatchObject({ code: "MERCHANT_NOT_FOUND" });
		expect(reads.asked).toEqual(["merchants", "location-requests", `detail:${TENANT_ID}`, "detail:unknown"]);
	});
});

describe("MerchantInviteApplicationService", () => {
	const [templateKey] = EmailTemplateKeySchema.options;
	const city = PilotCitySchema.parse("MELAKA");
	const PREVIEW: EmailPreview = EmailPreviewSchema.parse({
		key: templateKey,
		label: "Merchant invite",
		description: "Invites a business",
		subject: "You are invited",
		to: "owner@example.com",
		previewText: "You are invited",
		html: "<p>You are invited</p>",
		text: "You are invited",
		props: {},
	});

	class RecordingPreviews implements MerchantInviteEmailPreviewPort {
		public readonly asked: AdminMerchantInvitePreviewQuery[] = [];

		public previewMerchantInvite(query: AdminMerchantInvitePreviewQuery): EmailPreview {
			this.asked.push(query);
			return PREVIEW;
		}
	}

	it("reports whether this deployment may provision another tenant, from the provisioning gate", () => {
		const previews = new RecordingPreviews();

		expect(new MerchantInviteApplicationService({ isProvisioningAllowed: (): boolean => false }, previews).availability()).toEqual({ available: false });
		expect(new MerchantInviteApplicationService({ isProvisioningAllowed: (): boolean => true }, previews).availability()).toEqual({ available: true });
	});

	it("renders the invite email for the typed business and city, without sending it", () => {
		const previews = new RecordingPreviews();
		const query: AdminMerchantInvitePreviewQuery = { businessName: "Kopi Corner", city };

		expect(new MerchantInviteApplicationService({ isProvisioningAllowed: (): boolean => true }, previews).previewInviteEmail(query)).toBe(PREVIEW);
		expect(previews.asked).toEqual([query]);
	});
});

describe("TenantContextApplicationService", () => {
	class RecordingContexts implements TenantContextReadPort {
		public readonly asked: string[] = [];

		public getContext(actor: ActorContext, routeKey: string): Promise<TenantContextResponse> {
			this.asked.push(`context:${routeKey}:${actor.kind}`);
			return Promise.reject(new ReadReached());
		}

		public listMembershipsForUser(actor: ActorContext, _query: OwnMembershipListQuery): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>> {
			this.asked.push(`memberships:${actor.kind}`);
			return Promise.resolve(emptyPage());
		}
	}

	it("reads the tenant the route names and the caller's own memberships, for a signed-in user", async () => {
		const reads = new RecordingContexts();
		const contexts = new TenantContextApplicationService(reads);

		await expect(contexts.getContext(MEMBER, { tenantSlug: "kopi-corner" })).rejects.toBeInstanceOf(ReadReached);
		await expect(contexts.listMyMemberships(MEMBER, LIST_QUERY)).resolves.toMatchObject({ items: [] });
		expect(reads.asked).toEqual(["context:kopi-corner:user", "memberships:user"]);
	});

	it("refuses anyone who is not signed in before reading anything", async () => {
		const reads = new RecordingContexts();
		const contexts = new TenantContextApplicationService(reads);

		await expect(contexts.getContext(ANONYMOUS, { tenantSlug: "kopi-corner" })).rejects.toBeInstanceOf(AuthenticationError);
		await expect(contexts.listMyMemberships(ANONYMOUS, LIST_QUERY)).rejects.toBeInstanceOf(AuthenticationError);
		expect(reads.asked).toEqual([]);
	});
});

describe("TenantLifecycleApplicationService", () => {
	const LIFECYCLE: TenantLifecycleResponse = { tenantId: TENANT_ID, lifecycleState: "ACTIVE", deletionGraceEndsAt: null, suspension: null, ban: null, appeals: [] };

	/** One tenant, `kopi-corner`, whose only member is `user-1`. */
	class OneTenant implements TenantLifecycleReadPort {
		public findMemberTenantId(routeKey: string, userId: string): Promise<string | null> {
			return Promise.resolve(routeKey === "kopi-corner" && userId === "user-1" ? TENANT_ID : null);
		}

		public findLifecycle(tenantId: string): Promise<TenantLifecycleResponse | null> {
			return Promise.resolve(tenantId === TENANT_ID ? LIFECYCLE : null);
		}
	}

	it("shows a member their tenant's lifecycle; any other tenant is the uniform 404", async () => {
		const lifecycles = new TenantLifecycleApplicationService(new OneTenant());

		await expect(lifecycles.getForMember(MEMBER, { tenantSlug: "kopi-corner" })).resolves.toBe(LIFECYCLE);
		await expect(lifecycles.getForMember(MEMBER, { tenantSlug: "someone-elses" })).rejects.toBeInstanceOf(NotFoundError);
		await expect(lifecycles.getForMember(ANONYMOUS, { tenantSlug: "kopi-corner" })).rejects.toBeInstanceOf(AuthenticationError);
	});

	it("shows the platform any tenant's lifecycle by id; an unknown id is a 404", async () => {
		const lifecycles = new TenantLifecycleApplicationService(new OneTenant());

		await expect(lifecycles.getForPlatform({ tenantId: TENANT_ID })).resolves.toBe(LIFECYCLE);
		await expect(lifecycles.getForPlatform({ tenantId: "0193f2c4-0000-7000-8000-00000000a999" })).rejects.toBeInstanceOf(NotFoundError);
	});
});
