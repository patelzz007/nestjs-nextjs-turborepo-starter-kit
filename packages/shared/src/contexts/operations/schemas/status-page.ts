import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

// ── The public status page and its incidents (enhancement 4.5) ──────────────────────────────────
// Customers and merchants see each part of the service as working or not, fed by the operations monitor,
// and the incidents staff post. Never internal details: no latencies, errors, hosts or who posted.

/** The parts of the service the public page names, in display order. */
export const StatusComponentKeySchema = z.enum(["api", "database", "background-jobs"]);
export type StatusComponentKey = z.output<typeof StatusComponentKeySchema>;
export const STATUS_COMPONENT_KEYS: readonly StatusComponentKey[] = StatusComponentKeySchema.options;

/** What each part is called on the page. */
export const STATUS_COMPONENT_LABELS: Readonly<Record<StatusComponentKey, string>> = {
	api: "Website, apps and API",
	database: "Accounts and data",
	"background-jobs": "Emails, notifications and background work",
};

/** How a part (or the whole service) is doing, least to most serious. UNKNOWN: no recent check. */
export const PublicStatusSchema = z.enum(["OPERATIONAL", "UNKNOWN", "DEGRADED", "PARTIAL_OUTAGE", "MAJOR_OUTAGE"]);
export type PublicStatus = z.output<typeof PublicStatusSchema>;

export const StatusIncidentImpactSchema = z.enum(["MINOR", "MAJOR", "CRITICAL"]);
export type StatusIncidentImpact = z.output<typeof StatusIncidentImpactSchema>;
export const StatusIncidentStateSchema = z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]);
export type StatusIncidentState = z.output<typeof StatusIncidentStateSchema>;

/** The words customers read for each state; staff see the same, so what they post is what is shown. */
export const STATUS_INCIDENT_STATE_LABELS: Readonly<Record<StatusIncidentState, string>> = {
	INVESTIGATING: "Investigating",
	IDENTIFIED: "Cause found",
	MONITORING: "Fixed, watching",
	RESOLVED: "Resolved",
};

/** How a part, or the whole service, reads on the public page. */
export const PUBLIC_STATUS_LABELS: Readonly<Record<PublicStatus, string>> = {
	OPERATIONAL: "Working",
	UNKNOWN: "No recent check",
	DEGRADED: "Slower than usual",
	PARTIAL_OUTAGE: "Partly down",
	MAJOR_OUTAGE: "Down",
};

/** How long a resolved incident stays on the public page. */
export const STATUS_RECENT_INCIDENT_DAYS = 7;
/** How many incidents the staff list shows (newest first). */
export const STATUS_INCIDENTS_LISTED = 50;

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 160;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;

export const PublicStatusIncidentUpdateSchema = z.object({ state: StatusIncidentStateSchema, message: z.string(), postedAt: EpochMsSchema });
export type PublicStatusIncidentUpdate = z.output<typeof PublicStatusIncidentUpdateSchema>;

export const PublicStatusIncidentSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	impact: StatusIncidentImpactSchema,
	state: StatusIncidentStateSchema,
	components: z.array(StatusComponentKeySchema),
	startedAt: EpochMsSchema,
	resolvedAt: EpochMsSchema.nullable(),
	/** Newest first. */
	updates: z.array(PublicStatusIncidentUpdateSchema),
});
export type PublicStatusIncident = z.output<typeof PublicStatusIncidentSchema>;

export const PublicStatusComponentSchema = z.object({ key: StatusComponentKeySchema, label: z.string(), status: PublicStatusSchema });
export type PublicStatusComponent = z.output<typeof PublicStatusComponentSchema>;

/** The public status page in one read. */
export const PublicStatusPageSchema = z.object({
	overall: PublicStatusSchema,
	/** When the monitor last checked; null before its first check. */
	checkedAt: EpochMsSchema.nullable(),
	components: z.array(PublicStatusComponentSchema),
	/** Unresolved incidents, newest first. */
	open: z.array(PublicStatusIncidentSchema),
	/** Incidents resolved in the last {@link STATUS_RECENT_INCIDENT_DAYS} days, newest first. */
	recent: z.array(PublicStatusIncidentSchema),
});
export type PublicStatusPage = z.output<typeof PublicStatusPageSchema>;

// ── Staff ────────────────────────────────────────────────────────────────────────────────────────

export const StatusIncidentUpdateSchema = PublicStatusIncidentUpdateSchema.extend({ id: z.uuid(), postedByName: z.string().nullable() });
export type StatusIncidentUpdate = z.output<typeof StatusIncidentUpdateSchema>;

export const StatusIncidentSchema = PublicStatusIncidentSchema.extend({ openedByName: z.string().nullable(), updates: z.array(StatusIncidentUpdateSchema) });
export type StatusIncident = z.output<typeof StatusIncidentSchema>;

export const StatusIncidentListSchema = z.object({ incidents: z.array(StatusIncidentSchema) });
export type StatusIncidentList = z.output<typeof StatusIncidentListSchema>;

export const StatusIncidentPathSchema = z.object({ incidentId: z.uuid() }).strict();
export type StatusIncidentPath = z.output<typeof StatusIncidentPathSchema>;

const MessageSchema = z.string().trim().min(MESSAGE_MIN_LENGTH).max(MESSAGE_MAX_LENGTH);

/** Opening an incident: what customers read first. */
export const CreateStatusIncidentSchema = z
	.object({
		title: z.string().trim().min(TITLE_MIN_LENGTH).max(TITLE_MAX_LENGTH),
		impact: StatusIncidentImpactSchema,
		components: z
			.array(StatusComponentKeySchema)
			.min(1)
			.refine((keys) => new Set(keys).size === keys.length, { message: "List each part once" }),
		/** The first update; the incident starts as INVESTIGATING. */
		message: MessageSchema,
	})
	.strict();
export type CreateStatusIncidentInput = z.output<typeof CreateStatusIncidentSchema>;

/** An update; RESOLVED ends the incident and nothing can be posted after it. */
export const PostStatusIncidentUpdateSchema = z.object({ state: StatusIncidentStateSchema, message: MessageSchema }).strict();
export type PostStatusIncidentUpdateInput = z.output<typeof PostStatusIncidentUpdateSchema>;

/** Posting an update as the contract takes it: the incident and the update. */
export const PostStatusIncidentUpdateInputSchema = StatusIncidentPathSchema.extend(PostStatusIncidentUpdateSchema.shape);
