import {
	epochMs,
	STATUS_INCIDENTS_LISTED,
	STATUS_RECENT_INCIDENT_DAYS,
	type PublicStatusIncident,
	type PublicStatusPage,
	type StatusIncident,
	type StatusIncidentList,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { StatusIncidentNotFoundError } from "../../domain/errors/operations.errors";
import { overallStatus, publicComponentStatuses } from "../../domain/policies/public-status.policy";
import type { OpsLiveStore } from "../ports/ops-live-store.port";
import type { OperationsReads } from "../ports/operations-reads.port";
import { STATUS_READ_OPERATION } from "../ports/operations.tokens";
import type { PublicStatusReads } from "../ports/public-status-reads.port";
import type { StatusIncidentRecord } from "../ports/status-incident.repository.port";

const DAY_MS = 86_400_000;

/** An incident as the public page shows it: no ids of people, no names. */
export function toPublicIncident(record: StatusIncidentRecord): PublicStatusIncident {
	return {
		id: record.id,
		title: record.title,
		impact: record.impact,
		state: record.state,
		components: [...record.components],
		startedAt: record.startedAt,
		resolvedAt: record.resolvedAt,
		updates: record.updates.map((update) => ({ state: update.state, message: update.message, postedAt: update.postedAt })),
	};
}

/** An incident as staff see it: with who opened it and who posted each update. */
export function toStaffIncident(record: StatusIncidentRecord): StatusIncident {
	return {
		...toPublicIncident(record),
		openedByName: record.openedByName,
		updates: record.updates.map((update) => ({ id: update.id, state: update.state, message: update.message, postedAt: update.postedAt, postedByName: update.postedByName })),
	};
}

export interface StatusPageDeps {
	readonly live: Pick<OpsLiveStore, "dependencies">;
	readonly publicReads: PublicStatusReads;
	readonly reads: Pick<OperationsReads, "readAs">;
	readonly clock: Clock;
}

/**
 * The public status page (enhancement 4.5): each part of the service from the operations monitor's latest
 * checks and the open incidents, the incidents themselves, and the staff's view of them.
 */
export class StatusPageService {
	public constructor(private readonly deps: StatusPageDeps) {}

	public async publicPage(actor: ActorContext): Promise<PublicStatusPage> {
		const now = this.deps.clock.now();
		const [dependencies, incidents] = await Promise.all([
			this.deps.live.dependencies(),
			this.deps.publicReads.incidents(actor, epochMs(now - STATUS_RECENT_INCIDENT_DAYS * DAY_MS)),
		]);
		const open = incidents.filter((incident) => incident.resolvedAt === null);
		const components = publicComponentStatuses(dependencies, open, now);
		const checkedAt = dependencies.reduce((latest: number | null, entry): number => Math.max(latest ?? 0, entry.checkedAt), null);
		return {
			overall: overallStatus(components),
			checkedAt: checkedAt === null ? null : epochMs(checkedAt),
			components: [...components],
			open: open.map(toPublicIncident),
			recent: incidents.filter((incident) => incident.resolvedAt !== null).map(toPublicIncident),
		};
	}

	public async incidents(actor: ActorContext): Promise<StatusIncidentList> {
		const records = await this.deps.reads.readAs(STATUS_READ_OPERATION, actor, (scope) => scope.statusIncidents.list(STATUS_INCIDENTS_LISTED));
		return { incidents: records.map(toStaffIncident) };
	}

	public async incident(actor: ActorContext, incidentId: string): Promise<StatusIncident> {
		const record = await this.deps.reads.readAs(STATUS_READ_OPERATION, actor, (scope) => scope.statusIncidents.find(incidentId));
		if (record === null) {
			throw new StatusIncidentNotFoundError(incidentId);
		}
		return toStaffIncident(record);
	}
}
