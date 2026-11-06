// ============================================
// e2e/support/notification-rows.ts — read and remove ADR 070 notifications in e2e specs
// ============================================
// A spec finds the notifications its business change requested by a payload field (the producer's own
// id, e.g. `rewardId`) and removes them afterwards with their inbox rows and deliveries. Runs on the
// superuser pool (or a client with `app.rls_bypass` on): notifications are bypass-only for reads.

import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import { JsonObjectSchema } from "@workspace/shared";

export const NotificationRowSchema = z.object({ recipientUserId: z.string(), typeKey: z.string(), payload: JsonObjectSchema });
export type NotificationRow = z.output<typeof NotificationRowSchema>;

/** The notifications whose payload `field` is one of `values`, oldest first then by recipient. */
export async function notificationsByPayload(db: Pool | PoolClient, field: string, values: readonly string[]): Promise<NotificationRow[]> {
	const result = await db.query(
		`SELECT "recipientUserId" AS "recipientUserId", "typeKey" AS "typeKey", payload FROM public."Notification"
		 WHERE payload->>$1 = ANY($2::text[]) ORDER BY "createdAt", "recipientUserId"`,
		[field, [...values]],
	);
	return z.array(NotificationRowSchema).parse(result.rows);
}

/** Removes those notifications with their inbox rows and deliveries (a spec's teardown). */
export async function deleteNotificationsByPayload(db: Pool | PoolClient, field: string, values: readonly string[]): Promise<void> {
	const ids = `SELECT id FROM public."Notification" WHERE payload->>$1 = ANY($2::text[])`;
	const params = [field, [...values]];
	await db.query(`DELETE FROM public."InAppNotification" WHERE "notificationId" IN (${ids})`, params);
	await db.query(`DELETE FROM public."NotificationDelivery" WHERE "notificationId" IN (${ids})`, params);
	await db.query(`DELETE FROM public."Notification" WHERE id IN (${ids})`, params);
}

/** Runs `work` on one pooled connection with `app.rls_bypass` on (released afterwards, so the setting never leaks). */
export async function withRlsBypass<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
		return await work(client);
	} finally {
		await client.query("SELECT set_config('app.rls_bypass', 'false', false)");
		client.release();
	}
}
