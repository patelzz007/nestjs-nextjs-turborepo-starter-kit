// ============================================
// notifications/application/ports/broadcast-store.port.ts — broadcasts, audiences and reports (ADR 073)
// ============================================
// Bound to one unit-of-work transaction (the notifications scope). Status changes are optimistic: a move
// names the statuses it may leave from, so two staff members (or a sender job and a cancel) never both win.

import type {
	BroadcastAudience,
	BroadcastChannel,
	BroadcastDraftInput,
	BroadcastListQuery,
	BroadcastReportEntry,
	BroadcastReportListQuery,
	BroadcastReportReason,
	BroadcastResults,
	BroadcastSendMode,
	BroadcastStatus,
	NotificationCategory,
	PaginatedServiceResult,
	PlatformBroadcastAudience,
	RichTextDocument,
	TenantBroadcastAudience,
	TenantCustomerEntry,
	TenantCustomerListQuery,
	TenantCustomerUnreachableReason,
} from "@workspace/shared";

export interface StoredBroadcast {
	readonly id: string;
	readonly tenantId: string | null;
	readonly authorUserId: string;
	readonly approverUserId: string | null;
	readonly status: BroadcastStatus;
	readonly category: NotificationCategory;
	readonly title: string;
	readonly body: RichTextDocument;
	readonly audience: BroadcastAudience;
	readonly channels: readonly BroadcastChannel[];
	readonly sendMode: BroadcastSendMode;
	readonly sendAt: number | null;
	readonly localSendAt: number | null;
	readonly startsAt: number | null;
	readonly sendingWeek: string | null;
	readonly audienceCount: number | null;
	readonly sendingStartedAt: number | null;
	readonly completedAt: number | null;
	readonly cancelledAt: number | null;
	readonly pausedAt: number | null;
	readonly pauseReason: string | null;
	readonly approvedAt: number | null;
	readonly createdAt: number;
	readonly updatedAt: number;
}

/** The fields a status move may set alongside the status. */
export interface BroadcastMoveFields {
	readonly approverUserId?: string;
	readonly approvedAt?: number;
	readonly startsAt?: number | null;
	readonly sendingWeek?: string;
	readonly sendingStartedAt?: number;
	readonly audienceCount?: number;
	readonly completedAt?: number;
	readonly cancelledAt?: number;
	readonly pausedAt?: number | null;
	readonly pauseReason?: string | null;
}

/** One person a broadcast goes to, and the time zone their local-time delivery is computed in. */
export interface BroadcastRecipient {
	readonly userId: string;
	readonly timeZone: string;
}

/** An audience: who receives it, how many the filters matched, and who was left out and why (counts only). */
export interface AudienceResolution {
	readonly recipients: readonly BroadcastRecipient[];
	readonly matched: number;
	readonly leftOut: ReadonlyMap<TenantCustomerUnreachableReason | "deleted", number>;
}

/** Whether a tenant may broadcast right now. */
export interface TenantBroadcastState {
	readonly displayName: string;
	readonly active: boolean;
	readonly broadcastsDisabledAt: number | null;
}

export interface BroadcastStore {
	create(tenantId: string | null, authorUserId: string, draft: BroadcastDraftInput, now: number): Promise<StoredBroadcast>;
	/** Rewrites a DRAFT (any other status: null). */
	updateDraft(broadcastId: string, draft: BroadcastDraftInput, now: number): Promise<StoredBroadcast | null>;
	find(broadcastId: string): Promise<StoredBroadcast | null>;
	/** One tenant's broadcasts, or every broadcast for platform staff (`tenantId` null = all). */
	list(tenantId: string | null, query: BroadcastListQuery): Promise<PaginatedServiceResult<StoredBroadcast>>;
	/** Moves to `to` only from one of `from`; false when the broadcast was not in one of them (someone else moved it). */
	move(broadcastId: string, from: readonly BroadcastStatus[], to: BroadcastStatus, fields: BroadcastMoveFields, now: number): Promise<boolean>;
	/** Tenant broadcasts whose sending started in `week` (cancelled before sending never started, so never counts). */
	startedInWeek(tenantId: string, week: string): Promise<number>;
	/** SCHEDULED broadcasts whose start time has come, oldest first. */
	dueToStart(now: number, limit: number): Promise<readonly string[]>;
	tenantAudience(tenantId: string, audience: TenantBroadcastAudience, now: number): Promise<AudienceResolution>;
	platformAudience(audience: PlatformBroadcastAudience): Promise<AudienceResolution>;
	tenantState(tenantId: string): Promise<TenantBroadcastState | null>;
	/** Per-channel delivery counts of a sent broadcast. */
	results(broadcastId: string): Promise<readonly BroadcastResults[]>;
	openReportCounts(broadcastIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
	/** Whether the person received this broadcast in an inbox (only a recipient may report it). */
	receivedBy(broadcastId: string, userId: string): Promise<boolean>;
	/** One report per person per broadcast; false when they had already reported it. */
	addReport(broadcastId: string, tenantId: string | null, reporterUserId: string, reason: BroadcastReportReason, note: string | null, now: number): Promise<boolean>;
	/** Reports newest first, each with its tenant's upheld strikes in the current window (as of `now`). */
	listReports(query: BroadcastReportListQuery, now: number): Promise<PaginatedServiceResult<BroadcastReportEntry>>;
	/** The broadcast a report is about, with its tenant. */
	reportTarget(reportId: string): Promise<{ readonly broadcastId: string; readonly tenantId: string | null } | null>;
	/** Closes every open report of a broadcast as `status`. */
	closeReports(broadcastId: string, status: "DISMISSED" | "UPHELD", reviewedBy: string, now: number): Promise<void>;
	addStrike(tenantId: string, broadcastId: string, issuedBy: string, now: number): Promise<void>;
	strikesSince(tenantId: string, since: number): Promise<number>;
	disableTenantBroadcasting(tenantId: string, now: number): Promise<void>;
	/** Pauses the tenant's other SCHEDULED broadcasts (a report threshold or a strike). */
	pauseScheduledOfTenant(tenantId: string, reason: string, now: number): Promise<number>;
	customers(tenantId: string, query: TenantCustomerListQuery): Promise<PaginatedServiceResult<TenantCustomerEntry>>;
}
