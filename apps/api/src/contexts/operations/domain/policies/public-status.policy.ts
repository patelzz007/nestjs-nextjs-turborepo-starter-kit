import {
	PublicStatusSchema,
	STATUS_COMPONENT_KEYS,
	STATUS_COMPONENT_LABELS,
	type EpochMs,
	type OpsDependency,
	type OpsHealth,
	type PublicStatus,
	type PublicStatusComponent,
	type StatusComponentKey,
	type StatusIncidentImpact,
} from "@workspace/shared";

/** A monitor check older than this says nothing about now: the part reads UNKNOWN. */
export const STATUS_CHECK_STALE_MS = 5 * 60_000;

/** Which monitored dependencies each public part rests on (the worst of them counts). */
const COMPONENT_DEPENDENCIES: Readonly<Record<StatusComponentKey, readonly OpsDependency[]>> = {
	api: ["ENDPOINTS"],
	database: ["POSTGRES"],
	"background-jobs": ["QUEUES", "REDIS"],
};

const HEALTH_STATUS: Readonly<Record<OpsHealth, PublicStatus>> = { UP: "OPERATIONAL", DEGRADED: "DEGRADED", DOWN: "MAJOR_OUTAGE", UNKNOWN: "UNKNOWN" };
const IMPACT_STATUS: Readonly<Record<StatusIncidentImpact, PublicStatus>> = { MINOR: "DEGRADED", MAJOR: "PARTIAL_OUTAGE", CRITICAL: "MAJOR_OUTAGE" };

/** The monitor's latest word on one dependency. */
export interface MonitoredDependency {
	readonly dependency: OpsDependency;
	readonly health: OpsHealth;
	readonly configured: boolean;
	readonly checkedAt: EpochMs;
}

/** An unresolved incident, as far as the parts' status is concerned. */
export interface OpenIncidentImpact {
	readonly impact: StatusIncidentImpact;
	readonly components: readonly StatusComponentKey[];
}

function severity(status: PublicStatus): number {
	return PublicStatusSchema.options.indexOf(status);
}

/** The more serious of the statuses (OPERATIONAL when there are none). */
export function worstStatus(statuses: readonly PublicStatus[]): PublicStatus {
	return statuses.reduce((worst: PublicStatus, status: PublicStatus): PublicStatus => (severity(status) > severity(worst) ? status : worst), "OPERATIONAL");
}

function monitoredStatus(key: StatusComponentKey, dependencies: readonly MonitoredDependency[], now: EpochMs): PublicStatus {
	const relevant = dependencies.filter((entry) => entry.configured && COMPONENT_DEPENDENCIES[key].includes(entry.dependency));
	if (relevant.length === 0) {
		return "UNKNOWN";
	}
	return worstStatus(relevant.map((entry): PublicStatus => (now - entry.checkedAt > STATUS_CHECK_STALE_MS ? "UNKNOWN" : HEALTH_STATUS[entry.health])));
}

/**
 * Each public part's status: the worse of what the monitor last saw (stale or missing → UNKNOWN) and the
 * impact of any open incident naming it. An incident can only make a part look worse than the monitor
 * says, never better: a part the monitor sees down stays down whatever was posted.
 */
export function publicComponentStatuses(
	dependencies: readonly MonitoredDependency[],
	openIncidents: readonly OpenIncidentImpact[],
	now: EpochMs,
): readonly PublicStatusComponent[] {
	return STATUS_COMPONENT_KEYS.map((key): PublicStatusComponent => {
		const incidentStatuses = openIncidents.filter((incident) => incident.components.includes(key)).map((incident) => IMPACT_STATUS[incident.impact]);
		return { key, label: STATUS_COMPONENT_LABELS[key], status: worstStatus([monitoredStatus(key, dependencies, now), ...incidentStatuses]) };
	});
}

/** The whole service: its worst part, except that a part with no recent check doesn't hide the others' outage. */
export function overallStatus(components: readonly PublicStatusComponent[]): PublicStatus {
	return worstStatus(components.map((component) => component.status));
}
