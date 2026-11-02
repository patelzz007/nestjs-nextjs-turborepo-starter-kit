import { OpsAlertRuleSchema, OpsAlertSubjectKindSchema, type JsonObject, type NotificationSurface, type OpsAlertRule } from "@workspace/shared";
import { z } from "zod";

import { defineNotificationType, type TypedNotificationType } from "../notification-type";

/**
 * An operations alert reaches the people who run the platform wherever they are signed in: the admin
 * panel's bell, and the phone app (whose inbox and push devices are the customer surface's).
 */
const OPERATIONS_SURFACES: readonly NotificationSurface[] = ["ADMIN", "CUSTOMER"];

const MAX_ALERT_MESSAGE_LENGTH = 500;
const MS_PER_MINUTE = 60_000;

const OperationsAlertPayloadSchema = z
	.object({
		/** The alert row (OpsAlert): one notification per alert opening and one per its resolving. */
		alertId: z.uuid(),
		/** `open`: something broke. `resolve`: it is fine again. */
		kind: z.enum(["open", "resolve"]),
		/** What the alert rule saw ("Instance api on web-1 (pid 4242) stopped reporting"). */
		message: z.string().min(1).max(MAX_ALERT_MESSAGE_LENGTH),
		openedAt: z.number().int().nonnegative(),
		resolvedAt: z.number().int().nonnegative().nullable(),
		/**
		 * What broke and by how much, so the notice names it without opening the panel. Without a rule or
		 * a subject the notice falls back to the message alone; without figures it leaves them out.
		 */
		subjectKind: OpsAlertSubjectKindSchema.nullable(),
		subjectName: z.string().min(1).max(MAX_ALERT_MESSAGE_LENGTH).nullable(),
		rule: OpsAlertRuleSchema.nullable(),
		thresholdValue: z.number().nullable(),
		peakValue: z.number().nullable(),
	})
	.strict();
type OperationsAlertPayload = z.output<typeof OperationsAlertPayloadSchema>;

/** How long a resolved alert lasted, in whole minutes (at least one). */
export function alertMinutes(payload: OperationsAlertPayload): number | null {
	return payload.resolvedAt === null ? null : Math.max(1, Math.round((payload.resolvedAt - payload.openedAt) / MS_PER_MINUTE));
}

/** What each rule means, as a headline. */
const RULE_HEADLINES: Readonly<Record<OpsAlertRule, string>> = {
	CPU_HIGH: "High CPU",
	MEMORY_HIGH: "High memory",
	DISK_HIGH: "Disk almost full",
	SILENT: "Stopped reporting",
	DEPENDENCY_DOWN: "Dependency down",
	ENDPOINT_DOWN: "Endpoint not answering",
	TLS_EXPIRING: "Certificate expiring",
};

/** The unit of each rule's value ("" for the rules that have no value). */
const RULE_UNITS: Readonly<Record<OpsAlertRule, string>> = {
	CPU_HIGH: "%",
	MEMORY_HIGH: "%",
	DISK_HIGH: "%",
	SILENT: " min",
	DEPENDENCY_DOWN: "",
	ENDPOINT_DOWN: "",
	TLS_EXPIRING: " days",
};

const VALUE_DECIMALS = 1;

function valueOf(value: number, rule: OpsAlertRule): string {
	return `${String(Number(value.toFixed(VALUE_DECIMALS)))}${RULE_UNITS[rule]}`;
}

/** "High CPU on web-01" / "Recovered: High CPU on web-01"; a notice from before carries only the message. */
export function alertTitleOf(payload: OperationsAlertPayload): string {
	if (payload.rule === null || payload.subjectName === null) {
		return payload.kind === "open" ? `Alert: ${payload.message}` : `Resolved: ${payload.message}`;
	}
	const headline = `${RULE_HEADLINES[payload.rule]} on ${payload.subjectName}`;
	return payload.kind === "open" ? headline : `Recovered: ${headline}`;
}

/** The figures: the limit and the worst seen ("Limit 80%, peak 93%."), or nothing when the rule has none. */
export function alertFiguresOf(payload: OperationsAlertPayload): string | null {
	const { rule, thresholdValue, peakValue } = payload;
	if (rule === null || thresholdValue === null || peakValue === null) {
		return null;
	}
	return `Limit ${valueOf(thresholdValue, rule)}, ${payload.kind === "open" ? "now" : "peak"} ${valueOf(peakValue, rule)}.`;
}

/** The notice's lines: what the rule saw, its figures, and how long it lasted once resolved. */
export function alertDetailLinesOf(payload: OperationsAlertPayload): readonly string[] {
	const minutes = alertMinutes(payload);
	const figures = alertFiguresOf(payload);
	return [
		`${payload.message}.`,
		...(figures === null ? [] : [figures]),
		...(payload.kind === "resolve" && minutes !== null ? [`It lasted ${String(minutes)} minute${minutes === 1 ? "" : "s"}.`] : []),
	];
}

const OPEN_HINT = "Open Operations → Alerts to see what is affected.";

/** The operations monitor opened or resolved an alert (ADR 068): to every SuperAdmin, Admin and Platform Developer. */
export const OPERATIONS_ALERT_NOTIFICATION: TypedNotificationType<OperationsAlertPayload> = defineNotificationType({
	key: "operations.alert",
	description: "The operations monitor opened or resolved an alert (an instance stopped reporting, a dependency is down, …)",
	category: "OPERATIONS",
	surfaces: OPERATIONS_SURFACES,
	channels: ["IN_APP", "EMAIL", "PUSH"],
	// An outage does not wait for quiet hours or a digest.
	urgency: "immediate",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: OperationsAlertPayloadSchema,
	toJson: (payload: OperationsAlertPayload): JsonObject => ({ ...payload }),
	samplePayload: {
		alertId: "0193f2c4-0000-7000-8000-00000000a1e7",
		kind: "open",
		message: "Instance api on web-1 (pid 4242) stopped reporting 6 minutes ago",
		openedAt: 1_793_318_400_000,
		resolvedAt: null,
		subjectKind: "INSTANCE",
		subjectName: "api on web-1 (pid 4242)",
		rule: "SILENT",
		thresholdValue: 5,
		peakValue: 6,
	},
	renderers: {
		en: {
			inApp: (payload, context) => ({
				title: alertTitleOf(payload),
				body: [...alertDetailLinesOf(payload), ...(payload.kind === "open" ? [OPEN_HINT] : [])].join(" "),
				link: `${context.adminUrl}/operations/alerts`,
				icon: "siren",
			}),
			email: (payload, context) => ({
				subject: `[Admin] ${alertTitleOf(payload)}`,
				eyebrow: "Operations alert",
				heading: alertTitleOf(payload),
				paragraphs: [...alertDetailLinesOf(payload), ...(payload.kind === "open" ? [OPEN_HINT] : [])],
				action: { label: "Open the alerts", url: `${context.adminUrl}/operations/alerts` },
			}),
			// One fact per line: an expanded phone notification shows them all.
			push: (payload, context) => ({ title: alertTitleOf(payload), body: alertDetailLinesOf(payload).join("\n"), link: `${context.adminUrl}/operations/alerts` }),
		},
	},
});
