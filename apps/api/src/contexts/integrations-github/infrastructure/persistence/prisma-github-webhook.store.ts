// ============================================
// prisma-github-webhook.store.ts - Live-update subscriptions and webhook deliveries (ADR 052)
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
import type { GithubRepositoryParams } from "@workspace/shared";
import { z } from "zod";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { GithubWebhookDeliveryInput, GithubWebhookStorePort, GithubWebhookSubscriptionRecord } from "../../application/ports/github-live-updates.port";
import { GITHUB_WEBHOOK_DELIVERIES_OPERATION } from "../../application/ports/github.tokens";

export const GITHUB_WEBHOOK_SUBSCRIPTIONS_OPERATION = "github.webhook.subscriptions";

/** The PostgreSQL channel each recorded delivery's change is announced on — every API instance listens. */
export const GITHUB_PULL_REQUEST_CHANNEL = "github_pull_requests";

/** A repository, as the tables key it. */
type WebhookRepositoryKey = GithubRepositoryParams;

const ClaimedRowsSchema = z.array(z.object({ id: z.string() }));
const RecordedRowsSchema = z.array(z.object({ deliveryId: z.string() }));
const DeletedCountSchema = z.number().int().nonnegative();

function keyOf(repository: WebhookRepositoryKey): WebhookRepositoryKey {
	return { owner: repository.owner.toLowerCase(), repository: repository.repository.toLowerCase() };
}

@Injectable()
export class PrismaGithubWebhookStore implements GithubWebhookStorePort {
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
					INSERT INTO public."GithubWebhookSubscription" (id, owner, repository, "githubHookId", "createdBy")
					VALUES (uuidv7()::text, ${key.owner}, ${key.repository}, ${githubHookId}, ${actorUserId})
					ON CONFLICT (owner, repository) DO UPDATE
						SET "githubHookId" = EXCLUDED."githubHookId",
							"createdBy" = EXCLUDED."createdBy",
							"isDeleted" = false,
							"deletedAt" = NULL,
							"deletedBy" = NULL,
							"createdAt" = ((EXTRACT(epoch FROM now()) * 1000)::bigint),
							"updatedAt" = ((EXTRACT(epoch FROM now()) * 1000)::bigint)
						WHERE "GithubWebhookSubscription"."isDeleted"
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
						INSERT INTO public."GithubWebhookDelivery" ("deliveryId", event, owner, repository, "pullRequestNumber", "receivedAt")
						VALUES (${delivery.deliveryId}, ${delivery.event}, ${key.owner}, ${key.repository}, ${delivery.pullRequestNumber}, ${BigInt(delivery.receivedAt)})
						ON CONFLICT ("deliveryId") DO NOTHING
						RETURNING "deliveryId"`),
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
