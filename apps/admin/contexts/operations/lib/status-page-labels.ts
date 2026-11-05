import { STATUS_COMPONENT_LABELS, STATUS_INCIDENT_STATE_LABELS, type StatusComponentKey, type StatusIncidentImpact, type StatusIncidentState } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";

/** How each impact reads, and how serious it looks. */
export const IMPACT_LABELS: Readonly<Record<StatusIncidentImpact, string>> = {
	MINOR: "Minor: slower, or one feature",
	MAJOR: "Major: a main part not working",
	CRITICAL: "Critical: the service down",
};
export const IMPACT_TONES: Readonly<Record<StatusIncidentImpact, StatusTone>> = { MINOR: "warning", MAJOR: "danger", CRITICAL: "danger" };
export const IMPACT_SHORT_LABELS: Readonly<Record<StatusIncidentImpact, string>> = { MINOR: "Minor", MAJOR: "Major", CRITICAL: "Critical" };

/** How each state reads: the same words customers see. */
export const STATE_LABELS: Readonly<Record<StatusIncidentState, string>> = STATUS_INCIDENT_STATE_LABELS;
export const STATE_TONES: Readonly<Record<StatusIncidentState, StatusTone>> = { INVESTIGATING: "danger", IDENTIFIED: "warning", MONITORING: "info", RESOLVED: "success" };

export function impactLabel(impact: StatusIncidentImpact): string {
	return IMPACT_LABELS[impact];
}

export function stateLabel(state: StatusIncidentState): string {
	return STATE_LABELS[state];
}

export function componentLabel(key: StatusComponentKey): string {
	return STATUS_COMPONENT_LABELS[key];
}

/** The parts an incident names, as people read them ("Accounts and data, Website, apps and API"). */
export function componentsSummary(keys: readonly StatusComponentKey[]): string {
	return keys.map(componentLabel).join("; ");
}
