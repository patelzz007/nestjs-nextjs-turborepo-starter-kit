import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EMAIL_LOG_ID_TAG } from "../src/modules/notifications/email/email-sender.service";
import { createE2eApp, uniqueClientIp, type InjectResponse } from "./e2e-helpers";
import { signResendWebhook } from "./support/resend-webhook-signature";

/**
 * Real HTTP → real signature verification → real Postgres proof of the Resend
 * delivery webhook: events are matched by the `email_log_id` tag, recorded
 * once per webhook id (history), applied in provider-time order, and a late
 * older event never overrides a newer outcome.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const WEBHOOK_URL = "/notifications/email-webhook";
const MS_PER_MINUTE = 60_000;

describe("Resend delivery webhook (e2e)", () => {
	const emailLogId = randomUUID();
	const resendId = randomUUID();
	const unknownResendId = randomUUID();
	const sentAt = Date.parse("2026-10-02T10:00:00.000Z");
	let app: NestFastifyApplication;
	let verifier: Pool;

	async function deliver(
		webhookId: string,
		type: string,
		occurredAtMs: number,
		extra: Readonly<Record<string, object>> = {},
		emailId: string = resendId,
	): Promise<InjectResponse> {
		const body = JSON.stringify({ type, created_at: new Date(occurredAtMs).toISOString(), data: { email_id: emailId, tags: { [EMAIL_LOG_ID_TAG]: emailLogId }, ...extra } });
		return app.inject({ method: "POST", url: WEBHOOK_URL, headers: { ...signResendWebhook(body, { webhookId }), "x-forwarded-for": uniqueClientIp() }, payload: body });
	}

	async function emailLog(): Promise<{ status: string; resendId: string | null; lastEventAt: string | null; error: string | null }> {
		const result = await verifier.query<{ status: string; resendId: string | null; lastEventAt: string | null; error: string | null }>(
			'SELECT status, resend_id AS "resendId", last_event_at::text AS "lastEventAt", error FROM public.email_logs WHERE id = $1',
			[emailLogId],
		);
		const row = result.rows.at(0);
		if (row === undefined) {
			throw new Error("fixture email log row is missing");
		}
		return row;
	}

	async function outcomes(): Promise<{ webhookId: string; outcome: string }[]> {
		const result = await verifier.query<{ webhookId: string; outcome: string }>(
			'SELECT webhook_id AS "webhookId", outcome FROM public.email_delivery_events WHERE resend_id = ANY($1::text[]) ORDER BY created_at, webhook_id',
			[[resendId, unknownResendId]],
		);
		return result.rows;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		// Superuser pool — fixtures, verification and cleanup only (bypasses RLS).
		verifier = new Pool({ connectionString: DATABASE_URL });
		// The row exactly as the sender writes it before calling the provider: pending, no provider id yet.
		await verifier.query(
			`INSERT INTO public.email_logs (id, template_key, "to", subject, status, metadata) VALUES ($1, 'welcome', 'webhook-e2e@example.com', 'Webhook e2e', 'pending', '{"mode":"send"}'::jsonb)`,
			[emailLogId],
		);
	});

	afterAll(async () => {
		await verifier.query("DELETE FROM public.email_delivery_events WHERE resend_id = ANY($1::text[])", [[resendId, unknownResendId]]);
		await verifier.query("DELETE FROM public.email_logs WHERE id = $1", [emailLogId]);
		await verifier.end();
		await app.close();
	});

	it("matches a pending row by its email_log_id tag, before the provider id was stored", async () => {
		const response = await deliver(`msg_${randomUUID()}`, "email.sent", sentAt);

		expect(response.statusCode, response.body).toBe(200);
		expect(await emailLog()).toMatchObject({ status: "sent", resendId, lastEventAt: String(sentAt) });
	});

	it("moves the row forward and keeps every event as history", async () => {
		const response = await deliver(`msg_${randomUUID()}`, "email.delivered", sentAt + 2 * MS_PER_MINUTE);

		expect(response.statusCode, response.body).toBe(200);
		expect(await emailLog()).toMatchObject({ status: "delivered", lastEventAt: String(sentAt + 2 * MS_PER_MINUTE) });
		expect((await outcomes()).map((event) => event.outcome)).toEqual(["applied", "applied"]);
	});

	it("records but does not apply a late event the provider observed BEFORE the current outcome", async () => {
		const webhookId = `msg_${randomUUID()}`;
		const response = await deliver(webhookId, "email.bounced", sentAt + MS_PER_MINUTE, { bounce: { bounce_type: "transient", message: "mailbox full" } });

		expect(response.statusCode, response.body).toBe(200);
		expect(await emailLog()).toMatchObject({ status: "delivered", error: null });
		expect((await outcomes()).filter((event) => event.webhookId === webhookId).map((event) => event.outcome)).toEqual(["stale"]);
	});

	it("applies a redelivered webhook id only once", async () => {
		const webhookId = `msg_${randomUUID()}`;
		const complainedAt = sentAt + 5 * MS_PER_MINUTE;

		const first = await deliver(webhookId, "email.complained", complainedAt, { complaint: { complaint_type: "abuse" } });
		const again = await deliver(webhookId, "email.complained", complainedAt, { complaint: { complaint_type: "abuse" } });

		expect([first.statusCode, again.statusCode]).toEqual([200, 200]);
		expect((await outcomes()).filter((event) => event.webhookId === webhookId)).toHaveLength(1);
		expect(await emailLog()).toMatchObject({ status: "complained", error: "abuse" });
	});

	it("records an event for an email this system never sent as unmatched, touching no row", async () => {
		const body = JSON.stringify({ type: "email.delivered", created_at: new Date(sentAt).toISOString(), data: { email_id: unknownResendId } });
		const response = await app.inject({
			method: "POST",
			url: WEBHOOK_URL,
			headers: { ...signResendWebhook(body, { webhookId: `msg_${randomUUID()}` }), "x-forwarded-for": uniqueClientIp() },
			payload: body,
		});

		expect(response.statusCode, response.body).toBe(200);
		const result = await verifier.query<{ outcome: string; emailLogId: string | null }>(
			'SELECT outcome, email_log_id AS "emailLogId" FROM public.email_delivery_events WHERE resend_id = $1',
			[unknownResendId],
		);
		expect(result.rows).toEqual([{ outcome: "unmatched", emailLogId: null }]);
	});

	it("rejects a tampered delivery with 403 and records nothing", async () => {
		const webhookId = `msg_${randomUUID()}`;
		const body = JSON.stringify({ type: "email.failed", created_at: new Date(sentAt).toISOString(), data: { email_id: resendId } });
		const response = await app.inject({
			method: "POST",
			url: WEBHOOK_URL,
			headers: { ...signResendWebhook(body, { webhookId }), "x-forwarded-for": uniqueClientIp() },
			payload: body.replace("email.failed", "email.delivered"),
		});

		expect(response.statusCode).toBe(403);
		expect((await outcomes()).filter((event) => event.webhookId === webhookId)).toHaveLength(0);
	});
});
