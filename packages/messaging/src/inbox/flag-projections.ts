import { EXPERIMENT_METRIC_REGISTRY, ExperimentMetricKeySchema, type PlatformEventMessage } from "@workspace/shared";

// ── Feature flag projections (ADR 087) ───────────────────────────────────────────────────────────
// The analytics row of a platform event keeps no content, so the facts experiments need are projected beside it,
// in the same inbox transaction: each exposure of a `feature_flag.exposure` batch, and each occurrence of a declared
// experiment metric (a claim, a redemption, a successful sign-in) with the person it belongs to.

/** One exposure row, keyed by its event and its place in the batch (a redelivery inserts nothing twice). */
export interface FlagExposureRow {
	readonly eventId: string;
	readonly position: number;
	readonly kind: "FLAG" | "CONFIG";
	readonly key: string;
	readonly app: string;
	readonly subjectUnit: string;
	readonly subjectId: string;
	readonly source: string;
	readonly revision: number | null;
	readonly ruleId: string | null;
	readonly value: string;
	readonly experimentId: string | null;
	readonly variant: string | null;
	readonly occurredAt: number;
}

/** One occurrence of an experiment metric for one person. */
export interface MetricEventRow {
	readonly eventId: string;
	readonly metric: string;
	readonly userId: string;
	readonly occurredAt: number;
}

/** A flag exposure's value as it is stored and summed; a config's is its value name, or `default`. */
export const FLAG_ON_VALUE = "on";
export const FLAG_OFF_VALUE = "off";
export const CONFIG_DEFAULT_VALUE = "default";

/** The exposure rows of a `feature_flag.exposure` event; none for any other event. */
export function exposureRowsOf(message: PlatformEventMessage): readonly FlagExposureRow[] {
	if (message.type !== "feature_flag.exposure") {
		return [];
	}
	return message.payload.exposures.map((exposure, position): FlagExposureRow => {
		const common = {
			eventId: message.eventId,
			position,
			key: exposure.key,
			app: message.payload.app,
			subjectUnit: exposure.subjectUnit,
			subjectId: exposure.subjectId,
			source: exposure.source,
			revision: exposure.revision,
			ruleId: exposure.ruleId,
			occurredAt: exposure.at,
		};
		return exposure.kind === "FLAG"
			? { ...common, kind: "FLAG", value: exposure.on ? FLAG_ON_VALUE : FLAG_OFF_VALUE, experimentId: null, variant: null }
			: { ...common, kind: "CONFIG", value: exposure.valueName ?? CONFIG_DEFAULT_VALUE, experimentId: exposure.experimentId, variant: exposure.variant };
	});
}

/** The person whose metric an event is, when the event is one a declared metric counts. */
function metricUserOf(message: PlatformEventMessage, eventType: string, eventName: string): string | null {
	if (message.type === "reward.platform" && eventType === "reward.platform") {
		return message.payload.event === eventName ? message.payload.actorUserId : null;
	}
	if (message.type === "auth.flow" && eventType === "auth.flow") {
		return message.payload.flow === eventName && message.payload.status === "succeeded" ? message.payload.userId : null;
	}
	return null;
}

/** The experiment metric occurrences an event carries (usually none, at most one per declared metric). */
export function metricRowsOf(message: PlatformEventMessage): readonly MetricEventRow[] {
	return ExperimentMetricKeySchema.options.flatMap((metric): MetricEventRow[] => {
		const definition = EXPERIMENT_METRIC_REGISTRY[metric];
		const userId = metricUserOf(message, definition.eventType, definition.eventName);
		return userId === null ? [] : [{ eventId: message.eventId, metric, userId, occurredAt: message.occurredAt }];
	});
}
