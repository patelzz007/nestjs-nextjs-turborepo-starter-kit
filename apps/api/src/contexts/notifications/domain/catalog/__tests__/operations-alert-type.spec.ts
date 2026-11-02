import { describe, expect, it } from "vitest";

import { findNotificationType } from "../notification-catalog";
import type { NotificationRenderContext } from "../notification-type";
import { alertDetailLinesOf, alertFiguresOf, alertMinutes, alertTitleOf, OPERATIONS_ALERT_NOTIFICATION } from "../types/operations.types";

const CONTEXT: NotificationRenderContext = {
	appName: "Starter",
	webUrl: "https://app.example.com",
	merchantUrl: "https://merchant.example.com",
	adminUrl: "https://admin.example.com",
	groupCount: 1,
};
const OPENED_AT = 1_793_318_400_000;
const MINUTE_MS = 60_000;
const SEVEN = 7;
const ALERT_ID = "0193f2c4-0000-7000-8000-00000000a1e7";

type AlertPayload = Parameters<typeof alertMinutes>[0];

const CPU_LIMIT = 80;
const CPU_NOW = 93.46;
const CPU_PEAK = 97;

const OPENED: AlertPayload = {
	alertId: ALERT_ID,
	kind: "open",
	message: "web-01 CPU has been above 80% for 5 minutes",
	openedAt: OPENED_AT,
	resolvedAt: null,
	subjectKind: "SERVER",
	subjectName: "web-01",
	rule: "CPU_HIGH",
	thresholdValue: CPU_LIMIT,
	peakValue: CPU_NOW,
};
const RESOLVED: AlertPayload = { ...OPENED, kind: "resolve", resolvedAt: OPENED_AT + SEVEN * MINUTE_MS, peakValue: CPU_PEAK };
/** A notice that carries only the message (no rule, subject or figures). */
const BARE: AlertPayload = {
	...OPENED,
	message: "Instance api on web-1 (pid 4242) stopped reporting",
	subjectKind: null,
	subjectName: null,
	rule: null,
	thresholdValue: null,
	peakValue: null,
};

describe("operations.alert", () => {
	it("is in the catalog: an operations alert, always pushed at once, to the admin panel and the phone app", () => {
		const type = findNotificationType("operations.alert");
		expect(type?.category).toBe("OPERATIONS");
		expect(type?.urgency).toBe("immediate");
		expect(type?.digestible).toBe(false);
		expect(type?.surfaces).toEqual(["ADMIN", "CUSTOMER"]);
		expect(type?.channels).toEqual(["IN_APP", "EMAIL", "PUSH"]);
	});

	it("names what broke and by how much, and points to the alerts in the admin panel", () => {
		expect(OPERATIONS_ALERT_NOTIFICATION.renderInApp(OPENED, "en", CONTEXT)).toEqual({
			title: "High CPU on web-01",
			body: "web-01 CPU has been above 80% for 5 minutes. Limit 80%, now 93.5%. Open Operations → Alerts to see what is affected.",
			link: "https://admin.example.com/operations/alerts",
			icon: "siren",
		});
		expect(OPERATIONS_ALERT_NOTIFICATION.renderPush(OPENED, "en", CONTEXT)).toEqual({
			title: "High CPU on web-01",
			body: "web-01 CPU has been above 80% for 5 minutes.\nLimit 80%, now 93.5%.",
			link: "https://admin.example.com/operations/alerts",
		});
	});

	it("says it recovered, its peak and how long it lasted", () => {
		expect(OPERATIONS_ALERT_NOTIFICATION.renderPush(RESOLVED, "en", CONTEXT)).toEqual({
			title: "Recovered: High CPU on web-01",
			body: "web-01 CPU has been above 80% for 5 minutes.\nLimit 80%, peak 97%.\nIt lasted 7 minutes.",
			link: "https://admin.example.com/operations/alerts",
		});
		const email = OPERATIONS_ALERT_NOTIFICATION.renderEmail(RESOLVED, "en", CONTEXT);
		expect(email?.subject).toBe("[Admin] Recovered: High CPU on web-01");
		expect(email?.paragraphs).toEqual(["web-01 CPU has been above 80% for 5 minutes.", "Limit 80%, peak 97%.", "It lasted 7 minutes."]);
		expect(email?.action).toEqual({ label: "Open the alerts", url: "https://admin.example.com/operations/alerts" });
	});

	it("falls back to the message alone without a rule or subject, and leaves out missing figures", () => {
		expect(alertTitleOf(BARE)).toBe("Alert: Instance api on web-1 (pid 4242) stopped reporting");
		expect(alertTitleOf({ ...BARE, kind: "resolve" })).toBe("Resolved: Instance api on web-1 (pid 4242) stopped reporting");
		expect(alertFiguresOf(BARE)).toBeNull();
		expect(alertFiguresOf({ ...OPENED, rule: "DEPENDENCY_DOWN", thresholdValue: null, peakValue: null })).toBeNull();
		expect(alertDetailLinesOf(BARE)).toEqual(["Instance api on web-1 (pid 4242) stopped reporting."]);
	});

	it("writes each rule's figures in its unit", () => {
		expect(alertFiguresOf({ ...OPENED, rule: "SILENT", thresholdValue: 5, peakValue: 6 })).toBe("Limit 5 min, now 6 min.");
		expect(alertFiguresOf({ ...OPENED, rule: "TLS_EXPIRING", thresholdValue: 14, peakValue: 9 })).toBe("Limit 14 days, now 9 days.");
		expect(alertTitleOf({ ...OPENED, rule: "SILENT", subjectName: "api on web-1 (pid 4242)" })).toBe("Stopped reporting on api on web-1 (pid 4242)");
	});

	it("counts a resolved alert as at least a minute, and an open one as not yet over", () => {
		expect(alertMinutes({ ...RESOLVED, kind: "resolve", resolvedAt: OPENED_AT + 1 })).toBe(1);
		expect(alertMinutes({ ...RESOLVED, kind: "resolve", resolvedAt: OPENED_AT + MINUTE_MS })).toBe(1);
		expect(alertMinutes(OPENED)).toBeNull();
		expect(OPERATIONS_ALERT_NOTIFICATION.renderPush({ ...BARE, kind: "resolve", resolvedAt: OPENED_AT + MINUTE_MS }, "en", CONTEXT)?.body).toBe(
			"Instance api on web-1 (pid 4242) stopped reporting.\nIt lasted 1 minute.",
		);
	});

	it("refuses a payload that is not an alert", () => {
		expect(OPERATIONS_ALERT_NOTIFICATION.isValidPayload(OPENED)).toBe(true);
		expect(OPERATIONS_ALERT_NOTIFICATION.isValidPayload({ ...OPENED, kind: "maybe" })).toBe(false);
		expect(OPERATIONS_ALERT_NOTIFICATION.isValidPayload({ ...OPENED, message: "" })).toBe(false);
	});
});
