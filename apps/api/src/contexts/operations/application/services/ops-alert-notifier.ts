// ============================================
// application/services/ops-alert-notifier.ts — telling people an alert opened or resolved
// ============================================
// The people who run the platform (every SuperAdmin, Admin and Platform Developer) are told through
// `notify()` (ADR 070): the admin panel's bell, the phone app's inbox and a push, and an email. The
// extra addresses in the alert settings belong to no account, so they keep getting the alert email
// alone. Everything is requested in the monitor's transaction: it commits with the alert row.

import { epochMs, type EpochMs, type OpsAlert } from "@workspace/shared";

import { AdminAlertEmailTemplate, OPERATIONS_ALERT_NOTIFICATION, operationsAlertDetailLinesOf, operationsAlertTitleOf } from "../../../notifications/public-api";
import type { OperationsScope } from "../operations-scope";
import type { OpsAlertRecipient } from "../ports/operations-repositories.port";

export type OpsAlertChange = "open" | "resolve";

/** Who hears of an alert: people with an account, and the extra addresses that are not one of theirs. */
export interface OpsAlertAudience {
	readonly people: readonly OpsAlertRecipient[];
	readonly extraEmails: readonly string[];
}

/** The settings' extra addresses, lower-cased, once each, leaving out anyone already told as a person. */
export function alertAudienceOf(people: readonly OpsAlertRecipient[], extraRecipients: readonly string[]): OpsAlertAudience {
	const peopleEmails = new Set(people.map((person: OpsAlertRecipient): string => person.email.toLowerCase()));
	const extraEmails = [...new Set(extraRecipients.map((email: string): string => email.toLowerCase()))].filter((email: string): boolean => !peopleEmails.has(email));
	return { people, extraEmails };
}

/** The retry key of one person's notification: an alert opens once and resolves once. */
export function alertDedupeKey(alert: OpsAlert, change: OpsAlertChange): string {
	return `ops-alert:${alert.id}:${change}`;
}

export class OpsAlertNotifier {
	public constructor(private readonly adminAppUrl: string) {}

	/** Tells the audience that `alert` opened or resolved, then marks it notified — all in `scope`'s transaction. */
	public async notify(scope: OperationsScope, alert: OpsAlert, change: OpsAlertChange, audience: OpsAlertAudience, now: EpochMs): Promise<void> {
		const payload = {
			alertId: alert.id,
			kind: change,
			message: alert.message,
			openedAt: alert.openedAt,
			resolvedAt: change === "resolve" ? alert.resolvedAt : null,
			subjectKind: alert.subjectKind,
			subjectName: alert.subjectName,
			rule: alert.rule,
			thresholdValue: alert.thresholdValue,
			// While it is open, the value now; once resolved, the worst it reached.
			peakValue: change === "resolve" ? alert.peakValue : alert.lastValue,
		};
		for (const person of audience.people) {
			await scope.notifications.notify({
				type: OPERATIONS_ALERT_NOTIFICATION,
				recipient: { kind: "user", userId: person.userId },
				payload,
				dedupeKey: alertDedupeKey(alert, change),
				tenantId: null,
			});
		}
		for (const to of audience.extraEmails) {
			await scope.emails.request(
				new AdminAlertEmailTemplate({
					to,
					title: operationsAlertTitleOf(payload),
					message: operationsAlertDetailLinesOf(payload).join("\n\n"),
					action: { label: "Open the alerts", url: `${this.adminAppUrl}/operations/alerts` },
				}),
			);
		}
		await scope.alerts.markNotified(alert.id, change, epochMs(now));
	}
}
