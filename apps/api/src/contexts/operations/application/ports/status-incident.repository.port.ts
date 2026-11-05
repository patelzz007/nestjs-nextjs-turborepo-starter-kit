import type { EpochMs, StatusComponentKey, StatusIncidentImpact, StatusIncidentState } from "@workspace/shared";

/** One posted update, newest first in its incident. `postedByName` is read only for staff. */
export interface StatusIncidentUpdateRecord {
	readonly id: string;
	readonly state: StatusIncidentState;
	readonly message: string;
	readonly postedById: string;
	readonly postedByName: string | null;
	readonly postedAt: EpochMs;
}

export interface StatusIncidentRecord {
	readonly id: string;
	readonly title: string;
	readonly impact: StatusIncidentImpact;
	readonly state: StatusIncidentState;
	readonly components: readonly StatusComponentKey[];
	readonly startedAt: EpochMs;
	readonly resolvedAt: EpochMs | null;
	readonly openedById: string;
	readonly openedByName: string | null;
	/** Newest first. */
	readonly updates: readonly StatusIncidentUpdateRecord[];
}

export interface NewStatusIncident {
	readonly title: string;
	readonly impact: StatusIncidentImpact;
	readonly components: readonly StatusComponentKey[];
	/** The first update (state INVESTIGATING). */
	readonly message: string;
	readonly openedById: string;
	readonly at: EpochMs;
}

export interface NewStatusIncidentUpdate {
	readonly state: StatusIncidentState;
	readonly message: string;
	readonly postedById: string;
	readonly at: EpochMs;
}

/** Whether a read may name the staff who posted (staff reads) or not (the public page). */
export type StatusIncidentAudience = "public" | "staff";

/** The status page's incidents (enhancement 4.5). */
export interface StatusIncidentRepository {
	/** Unresolved incidents and those resolved since `resolvedSince`, newest first: the public page's. */
	forPublicPage(resolvedSince: EpochMs): Promise<readonly StatusIncidentRecord[]>;
	/** The newest `limit` incidents, for staff. */
	list(limit: number): Promise<readonly StatusIncidentRecord[]>;
	find(id: string): Promise<StatusIncidentRecord | null>;
	open(incident: NewStatusIncident): Promise<StatusIncidentRecord>;
	/**
	 * Posts an update and moves the incident to its state (RESOLVED also stamps `resolvedAt`). The incident is
	 * checked and changed in one conditional write, so two people resolving at once can't both post: `null`
	 * when the incident is gone or already resolved.
	 */
	postUpdate(id: string, update: NewStatusIncidentUpdate): Promise<StatusIncidentRecord | null>;
}
