// ============================================
// notifications/application/services/broadcast-service.ts — tenants and staff writing to people (ADR 073)
// ============================================
// The riskiest path in notifications, so every rule is checked here, on the server, every time:
// - who may send what: a tenant writes marketing to its own customers only (all of them, a filtered
//   part, or people it picked by hand); staff write product or account notices to users;
// - links (https only, no shorteners, no blocked domains) on save AND again on send;
// - the weekly allowance (5 per tenant per ISO week unless an override raises it), tenant lifecycle and a
//   tenant's broadcasting switch (strikes);
// - four eyes for a platform notice to every user;
// - reports that pause, upheld reports that strike, and three strikes that stop a tenant broadcasting.
// Sending freezes the audience: one notification per recipient is written when sending starts (each due
// at the recipient's own local time when asked), and the ADR 070 fan-out delivers it.

import {
	BROADCAST_STRIKES_TO_DISABLE,
	epochMs,
	BroadcastWeeklyAllowanceSchema,
	instantOfWallClock,
	MERCHANT_CAPABILITY,
	TENANT_BROADCASTS_PER_WEEK,
	type BroadcastAudience,
	type BroadcastAudiencePreview,
	type BroadcastDraftInput,
	type BroadcastListQuery,
	type BroadcastReportEntry,
	type BroadcastReportListQuery,
	type BroadcastResponse,
	type BroadcastWeeklyAllowance,
	type MerchantCapability,
	type PaginatedServiceResult,
	type ReportBroadcastInput,
	type ReviewBroadcastReportInput,
	type TenantCustomerEntry,
	type TenantCustomerListQuery,
	imageFileIdsOf,
	withImageSources,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "../../../../platform/application/errors/app-error";
import type { MerchantAccessPort } from "../../../../platform/application/ports/authorization.port";
import type { TenantRateLimitOverridesPort } from "../../../../platform/application/ports/tenant-rate-limit-overrides.port";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import {
	broadcastLinkProblems,
	broadcastStartsAt,
	broadcastStatusesBefore,
	BROADCAST_STRIKE_WINDOW_MS,
	isoWeek,
	reportPauseThreshold,
} from "../../domain/broadcasts/broadcast-policy";
import { BROADCAST_MESSAGE_NOTIFICATION } from "../../domain/catalog/types/platform.types";
import { renderRichTextPreview } from "../../domain/rich-text/render-rich-text";
import type { NotificationsScope } from "../notifications-scope";
import type { AudienceResolution, BroadcastRecipient, StoredBroadcast } from "../ports/broadcast-store.port";

export const BROADCASTS_WRITE_OPERATION: SystemOperationName = "broadcasts.write";
export const BROADCASTS_AUDIENCE_OPERATION: SystemOperationName = "broadcasts.audience";
export const BROADCASTS_SEND_OPERATION: SystemOperationName = "broadcasts.send";
export const BROADCASTS_REPORTS_OPERATION: SystemOperationName = "broadcasts.reports";

/** Recipients written per transaction while sending (each a notification row and its outbox event). */
export const BROADCAST_SEND_BATCH = 500;
/** Broadcasts started per scheduler run. */
const DUE_PER_RUN = 20;
/** Every surface a platform notice can reach: one to all of them needs a second staff member. */
const ALL_SURFACE_COUNT = 3;

/** Who writes a broadcast: a tenant (its owners and managers) or platform staff. */
export type BroadcastSender = { readonly kind: "tenant"; readonly tenantId: string } | { readonly kind: "platform" };

/** Hands a broadcast to the sending queue (`broadcasts.send`). */
export interface BroadcastQueue {
	start(broadcastId: string): Promise<void>;
}

export interface BroadcastServiceDependencies {
	readonly uow: UnitOfWork<NotificationsScope>;
	readonly clock: Clock;
	readonly queue: BroadcastQueue;
	readonly merchantAccess: MerchantAccessPort;
	readonly overrides: TenantRateLimitOverridesPort;
	readonly blockedLinkDomains: readonly string[];
	readonly platformName: string;
}

function userIdOf(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthorizationError({ message: "Broadcasts are written by signed-in people" });
	}
	return actor.userId;
}

/** A platform notice to every surface with no narrowing filter: the "all users" case that needs four eyes. */
export function needsSecondApproval(audience: BroadcastAudience): boolean {
	return audience.kind === "platform-users" && audience.surfaces.length === ALL_SURFACE_COUNT && audience.signedUpAfter === null && audience.tenantStates === null;
}

export class BroadcastService {
	public constructor(private readonly deps: BroadcastServiceDependencies) {}

	// ── Authoring ────────────────────────────────────────────────────────────────────────────────────

	public async create(actor: ActorContext, sender: BroadcastSender, draft: BroadcastDraftInput): Promise<BroadcastResponse> {
		const authorUserId = userIdOf(actor);
		await this.authorize(actor, sender, MERCHANT_CAPABILITY.manageBroadcasts);
		this.assertDraftFits(sender, draft);
		const { stored, sources } = await this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, async (scope) => {
			if (sender.kind === "tenant") {
				await this.assertTenantMayBroadcast(scope, sender.tenantId);
			}
			await scope.broadcastImages.lockUsable(sender, imageFileIdsOf(draft.body));
			return this.withSources(scope, await scope.broadcasts.create(sender.kind === "tenant" ? sender.tenantId : null, authorUserId, draft, this.deps.clock.now()));
		});
		return this.toResponse(stored, [], 0, sources);
	}

	public async update(actor: ActorContext, sender: BroadcastSender, broadcastId: string, draft: BroadcastDraftInput): Promise<BroadcastResponse> {
		await this.authorize(actor, sender, MERCHANT_CAPABILITY.manageBroadcasts);
		this.assertDraftFits(sender, draft);
		const { stored, sources } = await this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, async (scope) => {
			await this.ownBroadcast(scope, sender, broadcastId);
			await scope.broadcastImages.lockUsable(sender, imageFileIdsOf(draft.body));
			const updated = await scope.broadcasts.updateDraft(broadcastId, draft, this.deps.clock.now());
			if (updated === null) {
				throw new ConflictError({ message: "Only a draft can be edited; move it back to draft first" });
			}
			return this.withSources(scope, updated);
		});
		return this.toResponse(stored, [], 0, sources);
	}

	public async get(actor: ActorContext, sender: BroadcastSender, broadcastId: string): Promise<BroadcastResponse> {
		await this.authorize(actor, sender, MERCHANT_CAPABILITY.manageBroadcasts);
		return this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, async (scope) => {
			const stored = await this.ownBroadcast(scope, sender, broadcastId);
			const [results, reports, sources] = await Promise.all([
				scope.broadcasts.results(broadcastId),
				scope.broadcasts.openReportCounts([broadcastId]),
				scope.broadcastImages.sources(imageFileIdsOf(stored.body)),
			]);
			return this.toResponse(stored, [...results], reports.get(broadcastId) ?? 0, sources);
		});
	}

	public async list(actor: ActorContext, sender: BroadcastSender, query: BroadcastListQuery): Promise<PaginatedServiceResult<BroadcastResponse>> {
		await this.authorize(actor, sender, MERCHANT_CAPABILITY.manageBroadcasts);
		return this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, async (scope) => {
			const page = await scope.broadcasts.list(sender.kind === "tenant" ? sender.tenantId : null, query);
			const [reports, sources] = await Promise.all([
				scope.broadcasts.openReportCounts(page.items.map((broadcast) => broadcast.id)),
				scope.broadcastImages.sources(page.items.flatMap((broadcast) => imageFileIdsOf(broadcast.body))),
			]);
			return { ...page, items: page.items.map((broadcast) => this.toResponse(broadcast, [], reports.get(broadcast.id) ?? 0, sources)) };
		});
	}

	/** The live count while the sender edits the filters: never names, only how many and why some are left out. */
	public async previewAudience(actor: ActorContext, sender: BroadcastSender, audience: BroadcastAudience): Promise<BroadcastAudiencePreview> {
		await this.authorize(actor, sender, MERCHANT_CAPABILITY.manageBroadcasts);
		this.assertAudienceFits(sender, audience);
		const resolution = await this.deps.uow.runSystemOperation(BROADCASTS_AUDIENCE_OPERATION, actor, (scope) => this.resolveAudience(scope, sender, audience));
		return {
			eligible: resolution.recipients.length,
			linked: resolution.matched,
			leftOut: [...resolution.leftOut.entries()].map(([reason, count]) => ({ reason, count })),
		};
	}

	/** The tenant's customers, to pick recipients by hand (masked contact details, ADR 073). */
	public async customers(actor: ActorContext, tenantId: string, query: TenantCustomerListQuery): Promise<PaginatedServiceResult<TenantCustomerEntry>> {
		await this.authorize(actor, { kind: "tenant", tenantId }, MERCHANT_CAPABILITY.manageBroadcasts);
		return this.deps.uow.runSystemOperation(BROADCASTS_AUDIENCE_OPERATION, actor, (scope) => scope.broadcasts.customers(tenantId, query));
	}

	public async allowance(actor: ActorContext, tenantId: string): Promise<BroadcastWeeklyAllowance> {
		await this.authorize(actor, { kind: "tenant", tenantId }, MERCHANT_CAPABILITY.manageBroadcasts);
		return this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, (scope) => this.weeklyAllowance(scope, tenantId, this.deps.clock.now()));
	}

	// ── The lifecycle ────────────────────────────────────────────────────────────────────────────────

	/** Schedules a draft (or asks for a second staff member's approval first, for a notice to every user). */
	public async schedule(actor: ActorContext, sender: BroadcastSender, broadcastId: string): Promise<BroadcastResponse> {
		await this.authorize(actor, sender, MERCHANT_CAPABILITY.publishBroadcasts);
		const now = this.deps.clock.now();
		const { stored, sources } = await this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, async (scope) => {
			const broadcast = await this.ownBroadcast(scope, sender, broadcastId);
			this.assertLinksAllowed(broadcast);
			if (sender.kind === "tenant") {
				await this.assertTenantMayBroadcast(scope, sender.tenantId);
				await this.assertAllowanceLeft(scope, sender.tenantId, broadcastStartsAt(broadcast.sendMode, broadcast.sendAt, broadcast.localSendAt, now));
			}
			const to = needsSecondApproval(broadcast.audience) ? "PENDING_APPROVAL" : "SCHEDULED";
			const startsAt = broadcastStartsAt(broadcast.sendMode, broadcast.sendAt, broadcast.localSendAt, now);
			if (!(await scope.broadcasts.move(broadcastId, ["DRAFT"], to, { startsAt }, now))) {
				throw new ConflictError({ message: "Only a draft can be scheduled" });
			}
			const scheduled: StoredBroadcast = { ...broadcast, status: to, startsAt };
			return this.withSources(scope, scheduled);
		});
		return this.toResponse(stored, [], 0, sources);
	}

	/** The second pair of eyes: another staff member approves a notice to every user. */
	public async approve(actor: ActorContext, broadcastId: string): Promise<BroadcastResponse> {
		const approverUserId = userIdOf(actor);
		const now = this.deps.clock.now();
		const { stored, sources } = await this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, async (scope) => {
			const broadcast = await this.ownBroadcast(scope, { kind: "platform" }, broadcastId);
			if (broadcast.authorUserId === approverUserId) {
				throw new AuthorizationError({ message: "Someone other than the author must approve a notice to every user" });
			}
			this.assertLinksAllowed(broadcast);
			if (!(await scope.broadcasts.move(broadcastId, ["PENDING_APPROVAL"], "SCHEDULED", { approverUserId, approvedAt: now }, now))) {
				throw new ConflictError({ message: "Only a broadcast waiting for approval can be approved" });
			}
			const scheduled: StoredBroadcast = { ...broadcast, status: "SCHEDULED", approverUserId, approvedAt: now };
			return this.withSources(scope, scheduled);
		});
		return this.toResponse(stored, [], 0, sources);
	}

	public async cancel(actor: ActorContext, sender: BroadcastSender, broadcastId: string): Promise<BroadcastResponse> {
		await this.authorize(actor, sender, MERCHANT_CAPABILITY.publishBroadcasts);
		const now = this.deps.clock.now();
		const { stored, sources } = await this.deps.uow.runSystemOperation(BROADCASTS_WRITE_OPERATION, actor, async (scope) => {
			const broadcast = await this.ownBroadcast(scope, sender, broadcastId);
			if (!(await scope.broadcasts.move(broadcastId, broadcastStatusesBefore("CANCELLED"), "CANCELLED", { cancelledAt: now }, now))) {
				throw new ConflictError({ message: "A broadcast that is sending or sent cannot be cancelled" });
			}
			const cancelled: StoredBroadcast = { ...broadcast, status: "CANCELLED", cancelledAt: now };
			return this.withSources(scope, cancelled);
		});
		return this.toResponse(stored, [], 0, sources);
	}

	// ── Sending ──────────────────────────────────────────────────────────────────────────────────────

	/** Every scheduled broadcast whose time has come goes to the sending queue (the minute scheduler). */
	public async startDue(actor: ActorContext): Promise<number> {
		const due = await this.deps.uow.runSystemOperation(BROADCASTS_SEND_OPERATION, actor, (scope) => scope.broadcasts.dueToStart(this.deps.clock.now(), DUE_PER_RUN));
		for (const broadcastId of due) {
			await this.deps.queue.start(broadcastId);
		}
		return due.length;
	}

	/**
	 * Starts sending one broadcast: re-checks everything that may have changed since it was scheduled,
	 * freezes the audience, and writes one notification per recipient in batches. A broadcast another run
	 * already started (or one cancelled meanwhile) is left alone.
	 */
	public async send(actor: ActorContext, broadcastId: string): Promise<void> {
		const now = this.deps.clock.now();
		const started = await this.deps.uow.runSystemOperation(BROADCASTS_SEND_OPERATION, actor, async (scope) => {
			const broadcast = await scope.broadcasts.find(broadcastId);
			if (broadcast?.status !== "SCHEDULED") {
				return null;
			}
			const refusal = await this.sendRefusal(scope, broadcast, now);
			if (refusal !== null) {
				await scope.broadcasts.move(broadcastId, ["SCHEDULED"], refusal.status, refusal.status === "PAUSED" ? { pausedAt: now, pauseReason: refusal.reason } : {}, now);
				return null;
			}
			const audience = await this.resolveAudience(
				scope,
				broadcast.tenantId === null ? { kind: "platform" } : { kind: "tenant", tenantId: broadcast.tenantId },
				broadcast.audience,
			);
			const moved = await scope.broadcasts.move(
				broadcastId,
				["SCHEDULED"],
				"SENDING",
				{ sendingWeek: isoWeek(now), sendingStartedAt: now, audienceCount: audience.recipients.length },
				now,
			);
			if (!moved) {
				return null;
			}
			const senderName =
				broadcast.tenantId === null ? this.deps.platformName : ((await scope.broadcasts.tenantState(broadcast.tenantId))?.displayName ?? this.deps.platformName);
			return { broadcast, recipients: audience.recipients, senderName };
		});
		if (started === null) {
			return;
		}
		const preview = renderRichTextPreview(started.broadcast.body);
		for (let offset = 0; offset < started.recipients.length; offset += BROADCAST_SEND_BATCH) {
			const batch = started.recipients.slice(offset, offset + BROADCAST_SEND_BATCH);
			await this.deps.uow.runSystemOperation(BROADCASTS_SEND_OPERATION, actor, async (scope) => {
				for (const recipient of batch) {
					await scope.notify.notify({
						type: BROADCAST_MESSAGE_NOTIFICATION,
						recipient: { kind: "user", userId: recipient.userId },
						payload: { broadcastId, title: started.broadcast.title, preview, senderName: started.senderName, senderLogoUrl: null },
						// One notification per recipient however often a retry runs this batch.
						dedupeKey: `broadcast:${broadcastId}`,
						tenantId: started.broadcast.tenantId,
						category: started.broadcast.category,
						broadcastId,
						...this.notBeforeFor(started.broadcast, recipient, now),
					});
				}
			});
		}
		await this.deps.uow.runSystemOperation(BROADCASTS_SEND_OPERATION, actor, (scope) =>
			scope.broadcasts.move(broadcastId, ["SENDING"], "SENT", { completedAt: this.deps.clock.now() }, this.deps.clock.now()),
		);
	}

	// ── Reports ──────────────────────────────────────────────────────────────────────────────────────

	/** A recipient reports a broadcast from their inbox; enough reports pause it and the tenant's other scheduled ones. */
	public async report(actor: ActorContext, broadcastId: string, input: ReportBroadcastInput): Promise<void> {
		const reporterUserId = userIdOf(actor);
		const now = this.deps.clock.now();
		await this.deps.uow.runSystemOperation(BROADCASTS_REPORTS_OPERATION, actor, async (scope) => {
			const broadcast = await scope.broadcasts.find(broadcastId);
			if (broadcast === null || !(await scope.broadcasts.receivedBy(broadcastId, reporterUserId))) {
				throw new NotFoundError({ message: "Broadcast not found" });
			}
			await scope.broadcasts.addReport(broadcastId, broadcast.tenantId, reporterUserId, input.reason, input.note, now);
			const open = (await scope.broadcasts.openReportCounts([broadcastId])).get(broadcastId) ?? 0;
			if (open < reportPauseThreshold(broadcast.audienceCount ?? 0)) {
				return;
			}
			const reason = `Paused after ${String(open)} report(s)`;
			await scope.broadcasts.move(broadcastId, broadcastStatusesBefore("PAUSED"), "PAUSED", { pausedAt: now, pauseReason: reason }, now);
			if (broadcast.tenantId !== null) {
				await scope.broadcasts.pauseScheduledOfTenant(broadcast.tenantId, reason, now);
			}
		});
	}

	public listReports(actor: ActorContext, query: BroadcastReportListQuery): Promise<PaginatedServiceResult<BroadcastReportEntry>> {
		return this.deps.uow.runSystemOperation(BROADCASTS_REPORTS_OPERATION, actor, (scope) => scope.broadcasts.listReports(query, this.deps.clock.now()));
	}

	/**
	 * Staff decide on a report: dismiss (its open reports close; the broadcast resumes), uphold (the
	 * broadcast stops for good and its tenant takes a strike; three strikes in 90 days stop the tenant
	 * broadcasting) or resume (the broadcast continues; the reports stay open).
	 */
	public async reviewReport(actor: ActorContext, reportId: string, input: ReviewBroadcastReportInput): Promise<void> {
		const reviewer = userIdOf(actor);
		const now = this.deps.clock.now();
		await this.deps.uow.runSystemOperation(BROADCASTS_REPORTS_OPERATION, actor, async (scope) => {
			const target = await scope.broadcasts.reportTarget(reportId);
			const broadcast = target === null ? null : await scope.broadcasts.find(target.broadcastId);
			if (target === null || broadcast === null) {
				throw new NotFoundError({ message: "Report not found" });
			}
			if (input.decision === "uphold") {
				await scope.broadcasts.closeReports(broadcast.id, "UPHELD", reviewer, now);
				await scope.broadcasts.move(broadcast.id, broadcastStatusesBefore("CANCELLED"), "CANCELLED", { cancelledAt: now }, now);
				if (broadcast.tenantId !== null) {
					await scope.broadcasts.addStrike(broadcast.tenantId, broadcast.id, reviewer, now);
					if ((await scope.broadcasts.strikesSince(broadcast.tenantId, now - BROADCAST_STRIKE_WINDOW_MS)) >= BROADCAST_STRIKES_TO_DISABLE) {
						await scope.broadcasts.disableTenantBroadcasting(broadcast.tenantId, now);
						await scope.broadcasts.pauseScheduledOfTenant(broadcast.tenantId, "Broadcasting turned off after repeated upheld reports", now);
					}
				}
				return;
			}
			if (input.decision === "dismiss") {
				await scope.broadcasts.closeReports(broadcast.id, "DISMISSED", reviewer, now);
			}
			await scope.broadcasts.move(broadcast.id, ["PAUSED"], broadcast.sendingStartedAt === null ? "SCHEDULED" : "SENDING", { pausedAt: null, pauseReason: null }, now);
		});
	}

	// ── Rules ────────────────────────────────────────────────────────────────────────────────────────

	private async authorize(actor: ActorContext, sender: BroadcastSender, capability: MerchantCapability): Promise<void> {
		if (sender.kind === "tenant") {
			await this.deps.merchantAccess.assertCapability(actor, { tenantId: sender.tenantId, capability });
		}
		// Platform staff are authorized per route (`@RequirePermission(…, "BROADCAST")`).
	}

	/** A tenant writes marketing to its own customers; staff write product or account notices to users. */
	private assertDraftFits(sender: BroadcastSender, draft: BroadcastDraftInput): void {
		this.assertAudienceFits(sender, draft.audience);
		if (sender.kind === "tenant" && draft.category !== "MARKETING") {
			throw new ValidationError({ message: "A business's broadcast is marketing", details: { category: draft.category } });
		}
		if (sender.kind === "platform" && draft.category === "MARKETING") {
			throw new ValidationError({ message: "A platform notice is product or account news", details: { category: draft.category } });
		}
		const problems = broadcastLinkProblems(draft.body, this.deps.blockedLinkDomains);
		if (problems.length > 0) {
			throw new ValidationError({ message: "Some links may not be sent", details: { links: problems.map((problem) => ({ href: problem.href, problem: problem.problem })) } });
		}
	}

	private assertAudienceFits(sender: BroadcastSender, audience: BroadcastAudience): void {
		const expected = sender.kind === "tenant" ? "tenant-customers" : "platform-users";
		if (audience.kind !== expected) {
			throw new ValidationError({
				message: sender.kind === "tenant" ? "A business writes only to its own customers" : "A platform notice goes to users",
				details: { audience: audience.kind },
			});
		}
	}

	private assertLinksAllowed(broadcast: StoredBroadcast): void {
		const problems = broadcastLinkProblems(broadcast.body, this.deps.blockedLinkDomains);
		if (problems.length > 0) {
			throw new ValidationError({ message: "Some links may not be sent", details: { links: problems.map((problem) => ({ href: problem.href, problem: problem.problem })) } });
		}
	}

	private async assertTenantMayBroadcast(scope: NotificationsScope, tenantId: string): Promise<void> {
		const state = await scope.broadcasts.tenantState(tenantId);
		if (state === null || !state.active) {
			throw new ConflictError({ message: "Only an active business can broadcast" });
		}
		if (state.broadcastsDisabledAt !== null) {
			throw new ConflictError({ message: "Broadcasting is turned off for this business after repeated upheld reports; contact support" });
		}
	}

	private async weeklyAllowance(scope: NotificationsScope, tenantId: string, at: number): Promise<BroadcastWeeklyAllowance> {
		const [used, override, state] = await Promise.all([
			scope.broadcasts.startedInWeek(tenantId, isoWeek(at)),
			this.deps.overrides.allowanceFor(tenantId, "TENANT_BROADCASTS"),
			scope.broadcasts.tenantState(tenantId),
		]);
		return BroadcastWeeklyAllowanceSchema.parse({
			used,
			limit: override?.limit ?? TENANT_BROADCASTS_PER_WEEK,
			broadcastingEnabled: state !== null && state.active && state.broadcastsDisabledAt === null,
		});
	}

	private async assertAllowanceLeft(scope: NotificationsScope, tenantId: string, startsAt: number): Promise<void> {
		const allowance = await this.weeklyAllowance(scope, tenantId, startsAt);
		if (allowance.used >= allowance.limit) {
			throw new ConflictError({
				message: `This business has used its ${String(allowance.limit)} broadcasts for that week`,
				details: { used: allowance.used, limit: allowance.limit },
			});
		}
	}

	/** Why a scheduled broadcast may not start now: paused (it can resume) or failed (it cannot). */
	private async sendRefusal(
		scope: NotificationsScope,
		broadcast: StoredBroadcast,
		now: number,
	): Promise<{ readonly status: "PAUSED" | "FAILED"; readonly reason: string } | null> {
		if (broadcastLinkProblems(broadcast.body, this.deps.blockedLinkDomains).length > 0) {
			return { status: "FAILED", reason: "A link became blocked" };
		}
		if (broadcast.tenantId === null) {
			return null;
		}
		const state = await scope.broadcasts.tenantState(broadcast.tenantId);
		if (state === null || !state.active) {
			return { status: "FAILED", reason: "The business is no longer active" };
		}
		if (state.broadcastsDisabledAt !== null) {
			return { status: "PAUSED", reason: "Broadcasting is turned off for this business" };
		}
		const allowance = await this.weeklyAllowance(scope, broadcast.tenantId, now);
		return allowance.used >= allowance.limit ? { status: "PAUSED", reason: "The weekly allowance is used up" } : null;
	}

	private resolveAudience(scope: NotificationsScope, sender: BroadcastSender, audience: BroadcastAudience): Promise<AudienceResolution> {
		if (sender.kind === "tenant" && audience.kind === "tenant-customers") {
			return scope.broadcasts.tenantAudience(sender.tenantId, audience, this.deps.clock.now());
		}
		if (sender.kind === "platform" && audience.kind === "platform-users") {
			return scope.broadcasts.platformAudience(audience);
		}
		throw new ValidationError({ message: "The audience does not belong to this sender" });
	}

	/** The broadcast's sender may only see its own broadcasts; staff see platform ones. */
	private async ownBroadcast(scope: NotificationsScope, sender: BroadcastSender, broadcastId: string): Promise<StoredBroadcast> {
		const broadcast = await scope.broadcasts.find(broadcastId);
		const owned = broadcast !== null && (sender.kind === "tenant" ? broadcast.tenantId === sender.tenantId : broadcast.tenantId === null);
		if (broadcast === null || !owned) {
			throw new NotFoundError({ message: "Broadcast not found" });
		}
		return broadcast;
	}

	/** RECIPIENT_LOCAL_TIME: due at the wall-clock time in the recipient's own zone (never in the past). */
	private notBeforeFor(broadcast: StoredBroadcast, recipient: BroadcastRecipient, now: number): { readonly notBefore?: number } {
		if (broadcast.sendMode !== "RECIPIENT_LOCAL_TIME" || broadcast.localSendAt === null) {
			return {};
		}
		const due = instantOfWallClock(broadcast.localSendAt, recipient.timeZone);
		return due > now ? { notBefore: due } : {};
	}

	/** A stored broadcast with its pictures' public addresses, read on the same transaction. */
	private async withSources(scope: NotificationsScope, stored: StoredBroadcast): Promise<{ readonly stored: StoredBroadcast; readonly sources: ReadonlyMap<string, string> }> {
		return { stored, sources: await scope.broadcastImages.sources(imageFileIdsOf(stored.body)) };
	}

	private toResponse(broadcast: StoredBroadcast, results: BroadcastResponse["results"], openReports: number, sources: ReadonlyMap<string, string>): BroadcastResponse {
		return toBroadcastResponse({ ...broadcast, body: withImageSources(broadcast.body, sources) }, results, openReports);
	}
}

/** The API shape of a stored broadcast. */
export function toBroadcastResponse(broadcast: StoredBroadcast, results: BroadcastResponse["results"], openReports: number): BroadcastResponse {
	return {
		id: broadcast.id,
		tenantId: broadcast.tenantId,
		status: broadcast.status,
		title: broadcast.title,
		body: broadcast.body,
		audience: broadcast.audience,
		channels: [...broadcast.channels],
		category: broadcast.category,
		sendMode: broadcast.sendMode,
		sendAt: broadcast.sendAt === null ? null : epochMs(broadcast.sendAt),
		localSendAt: broadcast.localSendAt === null ? null : epochMs(broadcast.localSendAt),
		audienceCount: broadcast.audienceCount,
		authorUserId: broadcast.authorUserId,
		approverUserId: broadcast.approverUserId,
		sendingStartedAt: broadcast.sendingStartedAt === null ? null : epochMs(broadcast.sendingStartedAt),
		completedAt: broadcast.completedAt === null ? null : epochMs(broadcast.completedAt),
		cancelledAt: broadcast.cancelledAt === null ? null : epochMs(broadcast.cancelledAt),
		pausedAt: broadcast.pausedAt === null ? null : epochMs(broadcast.pausedAt),
		pauseReason: broadcast.pauseReason,
		results: [...results],
		openReports,
		createdAt: epochMs(broadcast.createdAt),
		updatedAt: epochMs(broadcast.updatedAt),
		isDeleted: false,
		deletedAt: null,
	};
}
