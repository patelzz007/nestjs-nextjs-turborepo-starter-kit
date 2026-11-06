import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { epochMs, type OpsAlert } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { OperationsScope } from "../src/contexts/operations/application/operations-scope";
import { OPS_MONITOR_COLLECT_OPERATION, OPS_UNIT_OF_WORK } from "../src/contexts/operations/application/ports/operations.tokens";
import { alertAudienceOf, OpsAlertNotifier } from "../src/contexts/operations/application/services/ops-alert-notifier";
import { systemActor } from "../src/platform/application/actor-context";
import type { UnitOfWork } from "../src/platform/application/unit-of-work.port";
import { createE2eApp } from "./e2e-helpers";

/**
 * The operations alerts reach the admin panel's people through notify() (ADR 068, 070): the monitor's own
 * system operation reads who they are (the SuperAdmin flag or role, Admin, Platform Developer) and writes
 * their notifications, against the real schema and its row-level security.
 */

const STAFF = ["superadmin@example.com", "admin@example.com", "manager@example.com", "developer@example.com", "david.lee@example.com"];
const NOT_STAFF = ["user@example.com", "alice.johnson@example.com"];

/** The fan-out runs after commit, on the queue: it is waited for, so nothing is left running when the app closes. */
const FAN_OUT_TIMEOUT_MS = 15_000;
const FAN_OUT_POLL_MS = 100;

const NotificationRowSchema = z.object({ userId: z.string(), typeKey: z.string(), category: z.string(), dedupeKey: z.string() });

describe("operations alerts → notifications (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	const alertIds: string[] = [];

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
	});

	afterAll(async () => {
		for (const alertId of alertIds) {
			const keys = [`ops-alert:${alertId}:open`, `ops-alert:${alertId}:resolve`];
			await pool.query(`DELETE FROM public."NotificationDelivery" WHERE "notificationId" IN (SELECT id FROM public."Notification" WHERE "dedupeKey" = ANY($1))`, [keys]);
			await pool.query(`DELETE FROM public."InAppNotification" WHERE "notificationId" IN (SELECT id FROM public."Notification" WHERE "dedupeKey" = ANY($1))`, [keys]);
			await pool.query(`DELETE FROM public."Notification" WHERE "dedupeKey" = ANY($1)`, [keys]);
			await pool.query(`DELETE FROM public."OpsAlert" WHERE id = $1`, [alertId]);
		}
		await pool.end();
		await app.close();
	});

	function inMonitor<Result>(work: (scope: OperationsScope) => Promise<Result>): Promise<Result> {
		const uow = app.get<UnitOfWork<OperationsScope>>(OPS_UNIT_OF_WORK);
		return uow.runSystemOperation(OPS_MONITOR_COLLECT_OPERATION, systemActor(OPS_MONITOR_COLLECT_OPERATION, "job", null, "e2e: an operations alert", null), work);
	}

	async function emailsOf(userIds: readonly string[]): Promise<readonly string[]> {
		const result = await pool.query<{ email: string }>(`SELECT email FROM public."User" WHERE id = ANY($1) ORDER BY email`, [userIds]);
		return result.rows.map((row) => row.email);
	}

	it("finds every SuperAdmin, Admin and Platform Developer, and nobody else", async () => {
		const recipients = await inMonitor((scope) => scope.recipients.alertRecipients());
		const emails = await emailsOf(recipients.map((recipient) => recipient.userId));

		expect(emails).toEqual(expect.arrayContaining(STAFF));
		for (const email of NOT_STAFF) {
			expect(emails).not.toContain(email);
		}
		expect(recipients.map((recipient) => recipient.email.toLowerCase())).toEqual(emails.map((email) => email.toLowerCase()));
	});

	it("writes one operations-alert notification per person, in the monitor's transaction", async () => {
		const now = epochMs(Date.now());
		const { alert, people } = await inMonitor(async (scope) => {
			const opened: OpsAlert = await scope.alerts.open(
				{
					subjectKind: "INSTANCE",
					subjectId: `e2e-${String(now)}`,
					subjectName: "api on e2e",
					rule: "SILENT",
					value: null,
					threshold: null,
					message: "Instance api on e2e stopped reporting",
				},
				now,
			);
			const audience = alertAudienceOf(await scope.recipients.alertRecipients(), []);
			await new OpsAlertNotifier("https://admin.example.com").notify(scope, opened, "open", audience, now);
			return { alert: opened, people: audience.people };
		});
		alertIds.push(alert.id);

		const rows = await pool.query(
			`SELECT "recipientUserId" AS "userId", "typeKey", category::text AS category, "dedupeKey" FROM public."Notification" WHERE "dedupeKey" = $1`,
			[`ops-alert:${alert.id}:open`],
		);
		const notifications = z.array(NotificationRowSchema).parse(rows.rows);
		expect(notifications.map((row) => row.userId).toSorted()).toEqual(people.map((person) => person.userId).toSorted());
		expect(new Set(notifications.map((row) => `${row.typeKey}/${row.category}`))).toEqual(new Set(["operations.alert/OPERATIONS"]));
		const marked = await pool.query<{ openNotifiedAt: string | null }>(`SELECT "openNotifiedAt" FROM public."OpsAlert" WHERE id = $1`, [alert.id]);
		expect(marked.rows.at(0)?.openNotifiedAt).not.toBeNull();

		// After commit the fan-out puts it in the admin panel's inbox and the phone app's (ADMIN and CUSTOMER).
		const superAdmin = await pool.query<{ id: string }>(`SELECT id FROM public."User" WHERE email = 'superadmin@example.com'`);
		const superAdminId = z.string().parse(superAdmin.rows.at(0)?.id);
		await vi.waitFor(
			async (): Promise<void> => {
				const inbox = await pool.query<{ surface: string }>(
					`SELECT surface::text AS surface FROM public."InAppNotification" WHERE "userId" = $1 AND "notificationId" IN (SELECT id FROM public."Notification" WHERE "dedupeKey" = $2) ORDER BY surface`,
					[superAdminId, `ops-alert:${alert.id}:open`],
				);
				expect(inbox.rows.map((row) => row.surface)).toEqual(["ADMIN", "CUSTOMER"]);
			},
			{ timeout: FAN_OUT_TIMEOUT_MS, interval: FAN_OUT_POLL_MS },
		);
	});
});
