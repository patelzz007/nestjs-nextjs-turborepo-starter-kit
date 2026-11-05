import {
	epochMs,
	TENANT_BROADCASTS_PER_WEEK,
	type BroadcastDraftInput,
	type EpochMs,
	type MerchantCapability,
	type RateLimitAllowance,
	type RichTextDocument,
	type SetTenantRateLimitOverrideInput,
	type TenantRateLimitOverride,
	type TenantBroadcastAudience,
	type TenantRateLimitPolicyName,
} from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "../../../../platform/application/errors/app-error";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../../../../platform/application/ports/authorization.port";
import type { TenantRateLimitOverridesPort } from "../../../../platform/application/ports/tenant-rate-limit-overrides.port";
import { isoWeek } from "../../domain/broadcasts/broadcast-policy";
import {
	BroadcastService,
	BROADCASTS_SEND_OPERATION,
	BROADCASTS_WRITE_OPERATION,
	needsSecondApproval,
	type BroadcastQueue,
	type BroadcastSender,
} from "../services/broadcast-service";
import { InMemoryBroadcastStore } from "./fakes/in-memory-broadcast.store";
import { InMemoryBroadcastImages, InMemoryEmailLogs, notificationsScope, RecordingNotificationsUnitOfWork, RecordingNotify } from "./fakes/notifications.fakes";

const NOW = Date.UTC(2026, 9, 30, 10);
const HOUR = 3_600_000;
const TENANT = "0193f2c4-0000-7000-8000-0000000000f1";
const AUTHOR = "0193f2c4-0000-7000-8000-0000000000f2";
const SECOND_STAFF = "0193f2c4-0000-7000-8000-0000000000f3";
const ALICE = "0193f2c4-0000-7000-8000-0000000000a1";
const BOB = "0193f2c4-0000-7000-8000-0000000000a2";
const CAROL = "0193f2c4-0000-7000-8000-0000000000a3";

class FixedClock implements Clock {
	public now(): EpochMs {
		return epochMs(NOW);
	}
}

/** The capability gate: grants what it holds, refuses the rest (as `MerchantAccessPort` does). */
class FixedMerchantAccess implements MerchantAccessPort {
	public constructor(private readonly granted: readonly MerchantCapability[]) {}

	public assertCapability(_actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		if (!this.granted.some((capability) => capability === request.capability)) {
			return Promise.reject(new AuthorizationError({ message: "capability denied" }));
		}
		const grant: MerchantAccessGrant = { tenantId: request.tenantId, locationScope: "ALL_LOCATIONS", locationIds: [] };
		return Promise.resolve(grant);
	}
}

class FixedOverrides implements TenantRateLimitOverridesPort {
	public constructor(private readonly allowance: RateLimitAllowance | null = null) {}

	public allowanceFor(_tenantId: string, _policyName: TenantRateLimitPolicyName): Promise<RateLimitAllowance | null> {
		return Promise.resolve(this.allowance);
	}
	public list(): Promise<readonly TenantRateLimitOverride[]> {
		return Promise.resolve([]);
	}
	public set(_input: SetTenantRateLimitOverrideInput): Promise<TenantRateLimitOverride> {
		return Promise.reject(new Error("not used"));
	}
	public remove(): Promise<boolean> {
		return Promise.resolve(false);
	}
}

class RecordingQueue implements BroadcastQueue {
	public readonly started: string[] = [];

	public start(broadcastId: string): Promise<void> {
		this.started.push(broadcastId);
		return Promise.resolve();
	}
}

function user(userId: string): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	};
}

const BODY: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Two-for-one coffee all weekend." }] }] };

function tenantDraft(overrides: Partial<BroadcastDraftInput> = {}): BroadcastDraftInput {
	return {
		title: "Weekend offer",
		body: BODY,
		audience: { kind: "tenant-customers", claimedWithinDays: 60, redeemed: "any", locationId: null, customerIds: null },
		channels: ["IN_APP", "PUSH"],
		category: "MARKETING",
		sendMode: "INSTANT",
		sendAt: null,
		localSendAt: null,
		...overrides,
	};
}

function platformDraft(surfaces: ("CUSTOMER" | "MERCHANT" | "ADMIN")[]): BroadcastDraftInput {
	return { ...tenantDraft(), category: "PRODUCT", audience: { kind: "platform-users", surfaces, signedUpAfter: null, tenantStates: null } };
}

let store: InMemoryBroadcastStore;
let notify: RecordingNotify;
let queue: RecordingQueue;
let uow: RecordingNotificationsUnitOfWork;

function service(
	capabilities: readonly MerchantCapability[] = ["merchant:manage_broadcasts", "merchant:publish_broadcasts"],
	allowance: RateLimitAllowance | null = null,
): BroadcastService {
	return new BroadcastService({
		uow,
		clock: new FixedClock(),
		queue,
		merchantAccess: new FixedMerchantAccess(capabilities),
		overrides: new FixedOverrides(allowance),
		blockedLinkDomains: ["evil.example"],
		platformName: "Rewards",
	});
}

const TENANT_SENDER: BroadcastSender = { kind: "tenant", tenantId: TENANT };

beforeEach(() => {
	store = new InMemoryBroadcastStore();
	notify = new RecordingNotify();
	queue = new RecordingQueue();
	uow = new RecordingNotificationsUnitOfWork(notificationsScope(new InMemoryEmailLogs(), undefined, undefined, undefined, store, notify));
	store.tenants.set(TENANT, { displayName: "Sunrise Cafe", active: true, broadcastsDisabledAt: null });
	store.customerRows.push(
		{ tenantId: TENANT, userId: ALICE, lastClaimedAt: NOW - HOUR, redeemed: true, timeZone: "Asia/Kuala_Lumpur", unreachable: null },
		{ tenantId: TENANT, userId: BOB, lastClaimedAt: NOW - HOUR, redeemed: false, timeZone: "Europe/London", unreachable: null },
		{ tenantId: TENANT, userId: CAROL, lastClaimedAt: NOW - HOUR, redeemed: false, timeZone: null, unreachable: "no-consent" },
	);
});

describe("writing a broadcast", () => {
	it("lets a tenant write marketing to its own customers, as a draft", async () => {
		const created = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());

		expect(created).toMatchObject({ status: "DRAFT", tenantId: TENANT, category: "MARKETING" });
		expect(uow.operations).toEqual([BROADCASTS_WRITE_OPERATION]);
	});

	it("refuses a tenant writing anything but marketing, or to anyone but its customers", async () => {
		await expect(service().create(user(AUTHOR), TENANT_SENDER, tenantDraft({ category: "PRODUCT" }))).rejects.toBeInstanceOf(ValidationError);
		await expect(service().create(user(AUTHOR), TENANT_SENDER, platformDraft(["CUSTOMER"]))).rejects.toBeInstanceOf(ValidationError);
	});

	it("names every link that may not be sent", async () => {
		const body: RichTextDocument = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "Menu", marks: [{ type: "link", attrs: { href: "https://bit.ly/menu" } }] }] }],
		};

		await expect(service().create(user(AUTHOR), TENANT_SENDER, tenantDraft({ body }))).rejects.toMatchObject({
			details: { links: [{ href: "https://bit.ly/menu", problem: "shortener" }] },
		});
	});

	it("needs the broadcast capability, and an active tenant whose broadcasting is on", async () => {
		await expect(service([]).create(user(AUTHOR), TENANT_SENDER, tenantDraft())).rejects.toBeInstanceOf(AuthorizationError);
		store.tenants.set(TENANT, { displayName: "Sunrise Cafe", active: true, broadcastsDisabledAt: NOW });
		await expect(service().create(user(AUTHOR), TENANT_SENDER, tenantDraft())).rejects.toBeInstanceOf(ConflictError);
	});

	it("never shows one tenant's broadcast to another", async () => {
		const created = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());

		await expect(service().get(user(AUTHOR), { kind: "tenant", tenantId: "0193f2c4-0000-7000-8000-0000000000ff" }, created.id)).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("pictures in a broadcast (enhancement 5.4)", () => {
	const PICTURE = "0193f2c4-0000-7000-8000-00000000aaaa";
	const withPicture = (fileId: string): BroadcastDraftInput =>
		tenantDraft({ body: { type: "doc", content: [{ type: "image", attrs: { fileId, alt: "The new menu" } }, ...BODY.content] } });

	it("checks the picture is the sender's and ready, then answers with its address", async () => {
		const images = new InMemoryBroadcastImages(new Map([[PICTURE, "https://cdn.example.com/menu.webp"]]));
		uow = new RecordingNotificationsUnitOfWork(notificationsScope(new InMemoryEmailLogs(), undefined, undefined, undefined, store, notify, images));

		const created = await service().create(user(AUTHOR), TENANT_SENDER, withPicture(PICTURE));
		expect(images.locked).toStrictEqual([{ owner: TENANT_SENDER, fileIds: [PICTURE] }]);
		expect(created.body.content.at(0)).toStrictEqual({ type: "image", attrs: { fileId: PICTURE, alt: "The new menu", src: "https://cdn.example.com/menu.webp" } });
		const read = await service().get(user(AUTHOR), TENANT_SENDER, created.id);
		expect(read.body.content.at(0)).toMatchObject({ attrs: { src: "https://cdn.example.com/menu.webp" } });
	});

	it("refuses a picture that isn't one of the sender's ready images, writing nothing", async () => {
		uow = new RecordingNotificationsUnitOfWork(notificationsScope(new InMemoryEmailLogs(), undefined, undefined, undefined, store, notify, new InMemoryBroadcastImages()));
		await expect(service().create(user(AUTHOR), TENANT_SENDER, withPicture(PICTURE))).rejects.toBeInstanceOf(ValidationError);
		await expect(service().list(user(AUTHOR), TENANT_SENDER, { page: 1, limit: 20 })).resolves.toMatchObject({ items: [] });
	});
});

describe("choosing who receives it", () => {
	it("counts the customers it reaches and who it leaves out, never naming them", async () => {
		const preview = await service().previewAudience(user(AUTHOR), TENANT_SENDER, tenantDraft().audience);

		expect(preview).toEqual({ eligible: 2, linked: 3, leftOut: [{ reason: "no-consent", count: 1 }] });
	});

	it("reaches only the people the tenant picked, and still only those who may hear from it", async () => {
		const picked: TenantBroadcastAudience = { kind: "tenant-customers", claimedWithinDays: 60, redeemed: "any", locationId: null, customerIds: [ALICE, CAROL] };
		const preview = await service().previewAudience(user(AUTHOR), TENANT_SENDER, picked);

		expect(preview).toEqual({ eligible: 1, linked: 2, leftOut: [{ reason: "no-consent", count: 1 }] });
	});
});

describe("scheduling", () => {
	it("schedules a tenant's draft to start now, within the weekly allowance", async () => {
		const created = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());

		const scheduled = await service().schedule(user(AUTHOR), TENANT_SENDER, created.id);

		expect(scheduled.status).toBe("SCHEDULED");
		expect(store.broadcasts.get(created.id)?.startsAt).toBe(NOW);
	});

	it("refuses once the week's allowance is used, unless an override raises it", async () => {
		for (let sent = 0; sent < TENANT_BROADCASTS_PER_WEEK; sent += 1) {
			const done = await store.create(TENANT, AUTHOR, tenantDraft(), NOW);
			await store.move(done.id, ["DRAFT"], "SENT", { sendingWeek: isoWeek(NOW), sendingStartedAt: NOW }, NOW);
		}
		const created = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());

		await expect(service().schedule(user(AUTHOR), TENANT_SENDER, created.id)).rejects.toBeInstanceOf(ConflictError);
		await expect(
			service(undefined, { limit: TENANT_BROADCASTS_PER_WEEK + 1, windowMs: 7 * 24 * HOUR }).schedule(user(AUTHOR), TENANT_SENDER, created.id),
		).resolves.toMatchObject({ status: "SCHEDULED" });
	});

	it("needs the publish capability to schedule (writing is not enough)", async () => {
		const created = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());

		await expect(service(["merchant:manage_broadcasts"]).schedule(user(AUTHOR), TENANT_SENDER, created.id)).rejects.toBeInstanceOf(AuthorizationError);
	});

	it("holds a platform notice to every user for a second staff member, who must not be its author", async () => {
		const created = await service().create(user(AUTHOR), { kind: "platform" }, platformDraft(["CUSTOMER", "MERCHANT", "ADMIN"]));
		expect(needsSecondApproval(created.audience)).toBe(true);

		await expect(service().schedule(user(AUTHOR), { kind: "platform" }, created.id)).resolves.toMatchObject({ status: "PENDING_APPROVAL" });
		await expect(service().approve(user(AUTHOR), created.id)).rejects.toBeInstanceOf(AuthorizationError);
		await expect(service().approve(user(SECOND_STAFF), created.id)).resolves.toMatchObject({ status: "SCHEDULED", approverUserId: SECOND_STAFF });
	});

	it("schedules a narrower platform notice without approval", async () => {
		const created = await service().create(user(AUTHOR), { kind: "platform" }, platformDraft(["MERCHANT"]));

		await expect(service().schedule(user(AUTHOR), { kind: "platform" }, created.id)).resolves.toMatchObject({ status: "SCHEDULED" });
	});

	it("cancels before sending, and refuses once sending started", async () => {
		const created = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());
		await service().cancel(user(AUTHOR), TENANT_SENDER, created.id);
		expect(store.broadcasts.get(created.id)?.status).toBe("CANCELLED");

		const sending = await store.create(TENANT, AUTHOR, tenantDraft(), NOW);
		await store.move(sending.id, ["DRAFT"], "SENDING", {}, NOW);
		await expect(service().cancel(user(AUTHOR), TENANT_SENDER, sending.id)).rejects.toBeInstanceOf(ConflictError);
	});
});

describe("sending", () => {
	async function scheduled(draft: BroadcastDraftInput): Promise<string> {
		const created = await service().create(user(AUTHOR), TENANT_SENDER, draft);
		await service().schedule(user(AUTHOR), TENANT_SENDER, created.id);
		return created.id;
	}

	it("hands due broadcasts to the queue", async () => {
		const id = await scheduled(tenantDraft());

		await expect(service().startDue(user(AUTHOR))).resolves.toBe(1);
		expect(queue.started).toEqual([id]);
	});

	it("freezes the audience and writes one marketing notification per recipient, once", async () => {
		const id = await scheduled(tenantDraft());

		await service().send(user(AUTHOR), id);
		await service().send(user(AUTHOR), id);

		expect(notify.requests.map((request) => [request.recipientUserId, request.broadcastId, request.category])).toEqual([
			[ALICE, id, "MARKETING"],
			[BOB, id, "MARKETING"],
		]);
		expect(store.broadcasts.get(id)).toMatchObject({ status: "SENT", audienceCount: 2, sendingWeek: isoWeek(NOW) });
		expect(uow.operations).toContain(BROADCASTS_SEND_OPERATION);
	});

	it("makes each recipient's copy due at their own local time", async () => {
		const tomorrowNineUtcWallClock = Date.UTC(2026, 9, 31, 9);
		const id = await scheduled(tenantDraft({ sendMode: "RECIPIENT_LOCAL_TIME", localSendAt: epochMs(tomorrowNineUtcWallClock) }));

		await service().send(user(AUTHOR), id);

		// 09:00 in Kuala Lumpur (UTC+8) is 01:00 UTC; 09:00 in London (UTC+0 on 31 Oct) is 09:00 UTC.
		expect(notify.requests.map((request) => [request.recipientUserId, request.notBefore])).toEqual([
			[ALICE, Date.UTC(2026, 9, 31, 1)],
			[BOB, Date.UTC(2026, 9, 31, 9)],
		]);
	});

	it("pauses instead of sending when broadcasting was turned off after scheduling", async () => {
		const id = await scheduled(tenantDraft());
		store.tenants.set(TENANT, { displayName: "Sunrise Cafe", active: true, broadcastsDisabledAt: NOW });

		await service().send(user(AUTHOR), id);

		expect(notify.requests).toEqual([]);
		expect(store.broadcasts.get(id)?.status).toBe("PAUSED");
	});
});

describe("reports", () => {
	async function sent(): Promise<string> {
		const created = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());
		await service().schedule(user(AUTHOR), TENANT_SENDER, created.id);
		await service().send(user(AUTHOR), created.id);
		store.received.add(`${created.id}:${ALICE}`);
		return created.id;
	}

	it("only takes a report from someone who received it", async () => {
		const id = await sent();

		await expect(service().report(user(BOB), id, { reason: "SPAM", note: null })).rejects.toBeInstanceOf(NotFoundError);
	});

	it("pauses the broadcast, and the tenant's other scheduled ones, once reports reach the threshold", async () => {
		const id = await sent();
		const next = await service().create(user(AUTHOR), TENANT_SENDER, tenantDraft());
		await service().schedule(user(AUTHOR), TENANT_SENDER, next.id);

		await service().report(user(ALICE), id, { reason: "SCAM", note: null });

		expect(store.broadcasts.get(id)?.status).toBe("PAUSED");
		expect(store.broadcasts.get(next.id)?.status).toBe("PAUSED");
	});

	it("strikes the tenant when a report is upheld, and turns its broadcasting off at the third strike", async () => {
		store.strikes.push({ tenantId: TENANT, issuedAt: NOW - HOUR }, { tenantId: TENANT, issuedAt: NOW - 2 * HOUR });
		const id = await sent();
		await service().report(user(ALICE), id, { reason: "SCAM", note: null });
		const [report] = store.reports;

		await service().reviewReport(user(SECOND_STAFF), report?.id ?? "", { decision: "uphold", note: null });

		expect(store.broadcasts.get(id)?.status).toBe("CANCELLED");
		expect(store.tenants.get(TENANT)?.broadcastsDisabledAt).toBe(NOW);
	});

	it("resumes a paused broadcast when its report is dismissed", async () => {
		const id = await sent();
		await service().report(user(ALICE), id, { reason: "SPAM", note: null });
		const [report] = store.reports;

		await service().reviewReport(user(SECOND_STAFF), report?.id ?? "", { decision: "dismiss", note: null });

		expect(store.broadcasts.get(id)?.status).toBe("SENDING");
		expect(report?.status).toBe("DISMISSED");
	});
});
