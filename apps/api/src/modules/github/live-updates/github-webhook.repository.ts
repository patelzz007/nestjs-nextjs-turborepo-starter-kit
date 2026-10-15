// ============================================
// github-webhook.repository.ts - Live-update subscriptions and webhook deliveries (ADR 052)
// ============================================
// Both tables are bypass-only platform plumbing (prisma/rls.sql), reached only
// through allowlisted system operations: `github.webhook.subscriptions` after
// the caller's GITHUB_PULL_REQUEST check, `github.webhook.deliveries` after a
// delivery's signature is verified. Owner and repository are stored lower-case
// (GitHub matches them case-insensitively).
//
// Races are settled in one statement each: two admins turning a repository on
// at once both create a hook, but only one claims the row (the other deletes
// its hook); a delivery is recorded by its id once, and its change announced
// (pg_notify, delivered at commit) only by the request that recorded it.

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

export const GITHUB_WEBHOOK_SUBSCRIPTIONS_OPERATION = "github.webhook.subscriptions";
export const GITHUB_WEBHOOK_DELIVERIES_OPERATION = "github.webhook.deliveries";

/** The PostgreSQL channel each recorded delivery's change is announced on — every API instance listens. */
export const GITHUB_PULL_REQUEST_CHANNEL = "github_pull_requests";

/** A repository, as the tables key it. */
export interface WebhookRepositoryKey {
	readonly owner: string;
	readonly repository: string;
}

/** A repository's live subscription. */
export interface GithubWebhookSubscriptionRecord {
	readonly githubHookId: bigint;
	readonly createdAt: number;
}

/** One verified delivery to record. */
export interface GithubWebhookDeliveryInput extends WebhookRepositoryKey {
	readonly deliveryId: string;
	readonly event: string;
	readonly pullRequestNumber: number | null;
	readonly receivedAt: number;
	/** What to announce on {@link GITHUB_PULL_REQUEST_CHANNEL} once it is recorded. */
	readonly announcement: string;
}

const ClaimedRowsSchema = z.array(z.object({ id: z.string() }));
const RecordedRowsSchema = z.array(z.object({ delivery_id: z.string() }));
const DeletedCountSchema = z.number().int().nonnegative();

function keyOf(repository: WebhookRepositoryKey): WebhookRepositoryKey {
	return { owner: repository.owner.toLowerCase(), repository: repository.repository.toLowerCase() };
}

@Injectable()
export class GithubWebhookRepository {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async findLive(repository: WebhookRepositoryKey, actorUserId: string): Promise<GithubWebhookSubscriptionRecord | null> {
		const key = keyOf(repository);
		const row = await this.tenantTx.withSystemOperation(
			{ operation: GITHUB_WEBHOOK_SUBSCRIPTIONS_OPERATION, reason: "Read whether a repository has live updates", actorUserId },
			async (tx) => tx.githubWebhookSubscription.findFirst({ where: { ...key, isDeleted: false }, select: { githubHookId: true, createdAt: true } }),
		);
		return row === null ? null : { githubHookId: row.githubHookId, createdAt: Number(row.createdAt) };
	}

	/**
	 * Records `githubHookId` as the repository's live subscription — a new row,
	 * or the turned-off one restored. `false` when the repository already has a
	 * live one (someone else turned it on first): the caller deletes its hook.
	 */
	public async claim(repository: WebhookRepositoryKey, githubHookId: bigint, actorUserId: string): Promise<boolean> {
		const key = keyOf(repository);
		const rows = await this.tenantTx.withSystemOperation(
			{ operation: GITHUB_WEBHOOK_SUBSCRIPTIONS_OPERATION, reason: "Turn a repository's live updates on", actorUserId },
			async (tx) =>
				tx.$queryRaw(Prisma.sql`
					INSERT INTO public.github_webhook_subscriptions (id, owner, repository, github_hook_id, created_by)
					VALUES (gen_random_uuid()::text, ${key.owner}, ${key.repository}, ${githubHookId}, ${actorUserId})
					ON CONFLICT (owner, repository) DO UPDATE
						SET github_hook_id = EXCLUDED.github_hook_id,
							created_by = EXCLUDED.created_by,
							is_deleted = false,
							deleted_at = NULL,
							deleted_by = NULL,
							created_at = ((EXTRACT(epoch FROM now()) * 1000)::bigint),
							updated_at = ((EXTRACT(epoch FROM now()) * 1000)::bigint)
						WHERE github_webhook_subscriptions.is_deleted
					RETURNING id`),
		);
		return ClaimedRowsSchema.parse(rows).length > 0;
	}

	/** Turns the subscription off — only if it is still the hook the caller deleted (compare-and-set). */
	public async release(repository: WebhookRepositoryKey, githubHookId: bigint, actorUserId: string, nowMs: number): Promise<void> {
		const key = keyOf(repository);
		await this.tenantTx.withSystemOperation({ operation: GITHUB_WEBHOOK_SUBSCRIPTIONS_OPERATION, reason: "Turn a repository's live updates off", actorUserId }, async (tx) =>
			tx.githubWebhookSubscription.updateMany({
				where: { ...key, githubHookId, isDeleted: false },
				data: { isDeleted: true, deletedAt: BigInt(nowMs), deletedBy: actorUserId, updatedAt: BigInt(nowMs) },
			}),
		);
	}

	/**
	 * Records a delivery and announces its change — `false` (nothing announced)
	 * when GitHub redelivers one already recorded. The announcement is sent at
	 * commit, so it never runs ahead of the record.
	 */
	public async record(delivery: GithubWebhookDeliveryInput): Promise<boolean> {
		const key = keyOf(delivery);
		return this.tenantTx.withSystemOperation(
			{ operation: GITHUB_WEBHOOK_DELIVERIES_OPERATION, reason: "Record a verified GitHub webhook delivery", actorUserId: null },
			async (tx) => {
				const rows = RecordedRowsSchema.parse(
					await tx.$queryRaw(Prisma.sql`
						INSERT INTO public.github_webhook_deliveries (delivery_id, event, owner, repository, pull_request_number, received_at)
						VALUES (${delivery.deliveryId}, ${delivery.event}, ${key.owner}, ${key.repository}, ${delivery.pullRequestNumber}, ${BigInt(delivery.receivedAt)})
						ON CONFLICT (delivery_id) DO NOTHING
						RETURNING delivery_id`),
				);
				if (rows.length === 0) {
					return false;
				}
				await tx.$executeRaw(Prisma.sql`SELECT pg_notify(${GITHUB_PULL_REQUEST_CHANNEL}, ${delivery.announcement})`);
				return true;
			},
		);
	}

	/** Deletes deliveries received before `beforeMs` (they only guard against redeliveries); answers how many. */
	public async prune(beforeMs: number): Promise<number> {
		return this.tenantTx.withSystemOperation(
			{ operation: GITHUB_WEBHOOK_DELIVERIES_OPERATION, reason: "Prune GitHub webhook deliveries past their retention", actorUserId: null },
			async (tx) => DeletedCountSchema.parse((await tx.githubWebhookDelivery.deleteMany({ where: { receivedAt: { lt: BigInt(beforeMs) } } })).count),
		);
	}
}
