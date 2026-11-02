import { epochMs, type EmailSendResult, type JsonObject, type OpsAlert } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type {
	BaseEmailProps,
	BaseEmailTemplate,
	EmailRequestTransactionalPort,
	NotifyRequest,
	NotifyResult,
	NotifyTransactionalPort,
} from "../../../../notifications/public-api";
import type { OperationsScope } from "../../operations-scope";
import type { OpsAlertRepository } from "../../ports/operations-repositories.port";
import { FakeOperationsUnitOfWork } from "../../__tests__/fakes/operations.fakes";
import { alertAudienceOf, alertDedupeKey, OpsAlertNotifier, type OpsAlertChange } from "../ops-alert-notifier";

const NOW = epochMs(Date.UTC(2026, 10, 1, 3, 12));
const MINUTE_MS = 60_000;
const SEVEN = 7;
const ADMIN_URL = "https://admin.example.com";
const SILENT_AFTER_MINUTES = 5;
const PEAK_SILENT_MINUTES = 9;
const ALERT: OpsAlert = {
	id: "0193f2c4-0000-7000-8000-00000000a1e7",
	subjectKind: "INSTANCE",
	subjectId: "api-4242",
	subjectName: "api on web-1",
	rule: "SILENT",
	openedAt: epochMs(NOW - SEVEN * MINUTE_MS),
	resolvedAt: null,
	thresholdValue: SILENT_AFTER_MINUTES,
	peakValue: PEAK_SILENT_MINUTES,
	lastValue: SEVEN,
	message: "Instance api on web-1 (pid 4242) stopped reporting",
};
const DETAILS = { subjectKind: "INSTANCE", subjectName: "api on web-1", rule: "SILENT", thresholdValue: SILENT_AFTER_MINUTES };
const RESOLVED: OpsAlert = { ...ALERT, resolvedAt: NOW };
const OWNER = { userId: "0193f2c4-0000-7000-8000-0000000000e1", email: "Owner@Example.com" };
const DEVELOPER = { userId: "0193f2c4-0000-7000-8000-0000000000e2", email: "dev@example.com" };

interface Notified {
	readonly typeKey: string;
	readonly userId: string | null;
	readonly dedupeKey: string;
	readonly tenantId: string | null;
	readonly payload: JsonObject;
}

class RecordingNotify implements NotifyTransactionalPort {
	public readonly requests: Notified[] = [];

	public notify<TPayload>(request: NotifyRequest<TPayload>): Promise<NotifyResult> {
		this.requests.push({
			typeKey: request.type.key,
			userId: request.recipient.kind === "user" ? request.recipient.userId : null,
			dedupeKey: request.dedupeKey,
			tenantId: request.tenantId,
			payload: request.type.declaration.toJson(request.payload),
		});
		return Promise.resolve({ duplicate: false, notificationId: "0193f2c4-0000-7000-8000-0000000000f1" });
	}
}

class RecordingEmails implements EmailRequestTransactionalPort {
	public readonly sent: { readonly to: string; readonly key: string; readonly subject: string }[] = [];

	public request<TProps extends BaseEmailProps>(template: BaseEmailTemplate<TProps>): Promise<EmailSendResult> {
		this.sent.push({ to: template.props.to, key: template.key, subject: template.subject });
		return Promise.resolve({ ok: true, id: "0193f2c4-0000-7000-8000-0000000000f2", mode: "queued" });
	}
}

class RecordingAlerts implements Pick<OpsAlertRepository, "markNotified"> {
	public readonly marked: { readonly alertId: string; readonly kind: OpsAlertChange; readonly now: number }[] = [];

	public markNotified(alertId: string, kind: OpsAlertChange, now: number): Promise<void> {
		this.marked.push({ alertId, kind, now });
		return Promise.resolve();
	}
}

function scopeOf(): { readonly scope: OperationsScope; readonly notify: RecordingNotify; readonly emails: RecordingEmails; readonly alerts: RecordingAlerts } {
	const base = new FakeOperationsUnitOfWork().scope;
	const notify = new RecordingNotify();
	const emails = new RecordingEmails();
	const alerts = new RecordingAlerts();
	return { scope: { ...base, notifications: notify, emails, alerts: { ...base.alerts, markNotified: alerts.markNotified.bind(alerts) } }, notify, emails, alerts };
}

describe("alertAudienceOf", () => {
	it("keeps the extra addresses that are nobody's account, once each, lower-cased", () => {
		expect(alertAudienceOf([OWNER, DEVELOPER], ["owner@example.com", "OnCall@Example.com", "oncall@example.com"])).toEqual({
			people: [OWNER, DEVELOPER],
			extraEmails: ["oncall@example.com"],
		});
	});
});

describe("OpsAlertNotifier", () => {
	it("notifies every person of an opened alert (bell, phone, email) with what broke and its value now, and marks it notified", async () => {
		const { scope, notify, emails, alerts } = scopeOf();

		await new OpsAlertNotifier(ADMIN_URL).notify(scope, ALERT, "open", alertAudienceOf([OWNER, DEVELOPER], []), NOW);

		expect(notify.requests).toEqual(
			[OWNER, DEVELOPER].map((person) => ({
				typeKey: "operations.alert",
				userId: person.userId,
				dedupeKey: alertDedupeKey(ALERT, "open"),
				tenantId: null,
				payload: { alertId: ALERT.id, kind: "open", message: ALERT.message, openedAt: ALERT.openedAt, resolvedAt: null, ...DETAILS, peakValue: SEVEN },
			})),
		);
		expect(emails.sent).toEqual([]);
		expect(alerts.marked).toEqual([{ alertId: ALERT.id, kind: "open", now: NOW }]);
	});

	it("says when it resolved, with the worst value it reached, under its own retry key", async () => {
		const { scope, notify } = scopeOf();

		await new OpsAlertNotifier(ADMIN_URL).notify(scope, RESOLVED, "resolve", alertAudienceOf([OWNER], []), NOW);

		expect(notify.requests.map((request) => request.dedupeKey)).toEqual([`ops-alert:${ALERT.id}:resolve`]);
		expect(notify.requests.map((request) => request.payload)).toEqual([
			{ alertId: ALERT.id, kind: "resolve", message: ALERT.message, openedAt: ALERT.openedAt, resolvedAt: NOW, ...DETAILS, peakValue: PEAK_SILENT_MINUTES },
		]);
	});

	it("emails the extra addresses the alert alone, with how long it lasted once resolved", async () => {
		const { scope, emails } = scopeOf();

		await new OpsAlertNotifier(ADMIN_URL).notify(scope, RESOLVED, "resolve", alertAudienceOf([OWNER], ["oncall@example.com"]), NOW);

		expect(emails.sent).toEqual([{ to: "oncall@example.com", key: "admin-alert", subject: "[Admin] Recovered: Stopped reporting on api on web-1" }]);
	});
});
