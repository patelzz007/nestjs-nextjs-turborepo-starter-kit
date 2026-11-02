// TEST-ONLY real in-memory implementation of `BroadcastStore` (the Prisma store's semantics: optimistic
// status moves, one report per person per broadcast, a frozen audience from the customers it holds).
import {
	PLATFORM_DISPLAY_REGION,
	type BroadcastDraftInput,
	type BroadcastListQuery,
	type BroadcastReportEntry,
	type BroadcastReportReason,
	type BroadcastResults,
	type BroadcastStatus,
	type PaginatedServiceResult,
	type PlatformBroadcastAudience,
	type TenantBroadcastAudience,
	type TenantCustomerEntry,
	type TenantCustomerUnreachableReason,
} from "@workspace/shared";

import type { AudienceResolution, BroadcastMoveFields, BroadcastRecipient, BroadcastStore, StoredBroadcast, TenantBroadcastState } from "../../ports/broadcast-store.port";

const DAY_MS = 86_400_000;

/** A tenant's customer as the audience query sees them. */
export interface FakeCustomer {
	readonly tenantId: string;
	readonly userId: string;
	readonly lastClaimedAt: number;
	readonly redeemed: boolean;
	readonly timeZone: string | null;
	readonly unreachable: TenantCustomerUnreachableReason | null;
}

export interface FakeReport {
	readonly id: string;
	readonly broadcastId: string;
	readonly tenantId: string | null;
	readonly reporterUserId: string;
	readonly reason: BroadcastReportReason;
	status: "OPEN" | "DISMISSED" | "UPHELD";
}

function page<T>(items: readonly T[], limit: number): PaginatedServiceResult<T> {
	return { items: [...items.slice(0, limit)], limit, total: items.length, page: 1, totalPages: 1, nextCursor: null, hasNext: items.length > limit, hasPrevious: false };
}

export class InMemoryBroadcastStore implements BroadcastStore {
	public readonly broadcasts = new Map<string, StoredBroadcast>();
	public readonly customerRows: FakeCustomer[] = [];
	public readonly platformUsers: BroadcastRecipient[] = [];
	public readonly tenants = new Map<string, TenantBroadcastState>();
	public readonly reports: FakeReport[] = [];
	public readonly strikes: { readonly tenantId: string; readonly issuedAt: number }[] = [];
	/** Who received each broadcast in an inbox (the report precondition). */
	public readonly received = new Set<string>();
	private nextId = 1;

	public create(tenantId: string | null, authorUserId: string, draft: BroadcastDraftInput, now: number): Promise<StoredBroadcast> {
		const id = `0193f2c4-0000-7000-8000-${String(this.nextId).padStart(12, "0")}`;
		this.nextId += 1;
		const stored: StoredBroadcast = {
			id,
			tenantId,
			authorUserId,
			approverUserId: null,
			status: "DRAFT",
			category: draft.category,
			title: draft.title,
			body: draft.body,
			audience: draft.audience,
			channels: [...draft.channels],
			sendMode: draft.sendMode,
			sendAt: draft.sendAt,
			localSendAt: draft.localSendAt,
			startsAt: null,
			sendingWeek: null,
			audienceCount: null,
			sendingStartedAt: null,
			completedAt: null,
			cancelledAt: null,
			pausedAt: null,
			pauseReason: null,
			approvedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		this.broadcasts.set(id, stored);
		return Promise.resolve(stored);
	}

	public updateDraft(broadcastId: string, draft: BroadcastDraftInput, now: number): Promise<StoredBroadcast | null> {
		const existing = this.broadcasts.get(broadcastId);
		if (existing?.status !== "DRAFT") {
			return Promise.resolve(null);
		}
		const updated: StoredBroadcast = {
			...existing,
			title: draft.title,
			body: draft.body,
			audience: draft.audience,
			channels: [...draft.channels],
			category: draft.category,
			updatedAt: now,
		};
		this.broadcasts.set(broadcastId, updated);
		return Promise.resolve(updated);
	}

	public find(broadcastId: string): Promise<StoredBroadcast | null> {
		return Promise.resolve(this.broadcasts.get(broadcastId) ?? null);
	}

	public list(tenantId: string | null, query: BroadcastListQuery): Promise<PaginatedServiceResult<StoredBroadcast>> {
		return Promise.resolve(
			page(
				[...this.broadcasts.values()].filter((broadcast) => tenantId === null || broadcast.tenantId === tenantId),
				query.limit,
			),
		);
	}

	public move(broadcastId: string, from: readonly BroadcastStatus[], to: BroadcastStatus, fields: BroadcastMoveFields, now: number): Promise<boolean> {
		const existing = this.broadcasts.get(broadcastId);
		if (existing === undefined || !from.includes(existing.status)) {
			return Promise.resolve(false);
		}
		this.broadcasts.set(broadcastId, { ...existing, ...fields, status: to, updatedAt: now });
		return Promise.resolve(true);
	}

	public startedInWeek(tenantId: string, week: string): Promise<number> {
		return Promise.resolve(
			[...this.broadcasts.values()].filter((broadcast) => broadcast.tenantId === tenantId && broadcast.sendingWeek === week && broadcast.sendingStartedAt !== null).length,
		);
	}

	public dueToStart(now: number, limit: number): Promise<readonly string[]> {
		return Promise.resolve(
			[...this.broadcasts.values()]
				.filter((broadcast) => broadcast.status === "SCHEDULED" && broadcast.startsAt !== null && broadcast.startsAt <= now)
				.slice(0, limit)
				.map((broadcast) => broadcast.id),
		);
	}

	public tenantAudience(tenantId: string, audience: TenantBroadcastAudience, now: number): Promise<AudienceResolution> {
		const matched = this.customerRows.filter(
			(customer) =>
				customer.tenantId === tenantId &&
				customer.lastClaimedAt >= now - audience.claimedWithinDays * DAY_MS &&
				(audience.redeemed === "any" || (audience.redeemed === "redeemed") === customer.redeemed) &&
				(audience.customerIds === null || audience.customerIds.includes(customer.userId)),
		);
		const leftOut = new Map<TenantCustomerUnreachableReason | "deleted", number>();
		for (const customer of matched.filter((candidate) => candidate.unreachable !== null)) {
			const reason = customer.unreachable ?? "no-consent";
			leftOut.set(reason, (leftOut.get(reason) ?? 0) + 1);
		}
		return Promise.resolve({
			recipients: matched
				.filter((customer) => customer.unreachable === null)
				.map((customer) => ({ userId: customer.userId, timeZone: customer.timeZone ?? PLATFORM_DISPLAY_REGION.timeZone })),
			matched: matched.length,
			leftOut,
		});
	}

	public platformAudience(_audience: PlatformBroadcastAudience): Promise<AudienceResolution> {
		return Promise.resolve({ recipients: [...this.platformUsers], matched: this.platformUsers.length, leftOut: new Map() });
	}

	public tenantState(tenantId: string): Promise<TenantBroadcastState | null> {
		return Promise.resolve(this.tenants.get(tenantId) ?? null);
	}

	public results(): Promise<readonly BroadcastResults[]> {
		return Promise.resolve([]);
	}

	public openReportCounts(broadcastIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
		return Promise.resolve(
			new Map(broadcastIds.map((id): [string, number] => [id, this.reports.filter((report) => report.broadcastId === id && report.status === "OPEN").length])),
		);
	}

	public receivedBy(broadcastId: string, userId: string): Promise<boolean> {
		return Promise.resolve(this.received.has(`${broadcastId}:${userId}`));
	}

	public addReport(broadcastId: string, tenantId: string | null, reporterUserId: string, reason: BroadcastReportReason): Promise<boolean> {
		if (this.reports.some((report) => report.broadcastId === broadcastId && report.reporterUserId === reporterUserId)) {
			return Promise.resolve(false);
		}
		this.reports.push({ id: `report-${String(this.reports.length + 1)}`, broadcastId, tenantId, reporterUserId, reason, status: "OPEN" });
		return Promise.resolve(true);
	}

	public listReports(): Promise<PaginatedServiceResult<BroadcastReportEntry>> {
		return Promise.resolve(page([], 20));
	}

	public reportTarget(reportId: string): Promise<{ readonly broadcastId: string; readonly tenantId: string | null } | null> {
		const report = this.reports.find((candidate) => candidate.id === reportId);
		return Promise.resolve(report === undefined ? null : { broadcastId: report.broadcastId, tenantId: report.tenantId });
	}

	public closeReports(broadcastId: string, status: "DISMISSED" | "UPHELD"): Promise<void> {
		for (const report of this.reports.filter((candidate) => candidate.broadcastId === broadcastId && candidate.status === "OPEN")) {
			report.status = status;
		}
		return Promise.resolve();
	}

	public addStrike(tenantId: string, _broadcastId: string, _issuedBy: string, now: number): Promise<void> {
		this.strikes.push({ tenantId, issuedAt: now });
		return Promise.resolve();
	}

	public strikesSince(tenantId: string, since: number): Promise<number> {
		return Promise.resolve(this.strikes.filter((strike) => strike.tenantId === tenantId && strike.issuedAt >= since).length);
	}

	public disableTenantBroadcasting(tenantId: string, now: number): Promise<void> {
		const state = this.tenants.get(tenantId);
		if (state !== undefined) {
			this.tenants.set(tenantId, { ...state, broadcastsDisabledAt: now });
		}
		return Promise.resolve();
	}

	public pauseScheduledOfTenant(tenantId: string, reason: string, now: number): Promise<number> {
		let paused = 0;
		for (const broadcast of [...this.broadcasts.values()].filter((candidate) => candidate.tenantId === tenantId && candidate.status === "SCHEDULED")) {
			this.broadcasts.set(broadcast.id, { ...broadcast, status: "PAUSED", pausedAt: now, pauseReason: reason });
			paused += 1;
		}
		return Promise.resolve(paused);
	}

	public customers(): Promise<PaginatedServiceResult<TenantCustomerEntry>> {
		return Promise.resolve(page([], 20));
	}
}
