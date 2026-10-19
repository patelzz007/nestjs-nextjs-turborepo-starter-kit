import type { OutboxEventStatus, Prisma } from "@prisma/client";
import { JsonObjectSchema, PLATFORM_EVENT_TOPICS, PlatformEventEnvelopeSchema, type PlatformEventInput, DAY_MS } from "@workspace/shared";

import { resolvePartitionKey } from "../../src/platform/infrastructure/outbox/platform-outbox.service";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "./organizations";

// ---------------------------------------------------------------------------
// Platform records that no other seeder covers, so that after `db:seed` every
// table and every column — soft-delete fields, optional columns, operational
// ledgers — holds realistic, deterministic data:
//
//   OutboxEvent              one PUBLISHED and one dead-lettered (FAILED) event,
//                              built from the real event envelope + topic map
//   OrganizationSlugHistory  the KL merchant's previous slug, still reserved
//   SampleCategory / product  a soft-deleted category with its soft-deleted
//                              product (cascade, as the app deletes them), and a
//                              live, twice-edited product with an image
//
// Idempotent: every row is upserted on its id (deterministic) or its natural
// unique key, with an empty update — re-running never duplicates or rewrites.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.platform_records";

/** Fixed demo clock (2026-09-15T08:00:00Z) — byte-identical rows across runs. */
const BASE_EPOCH_MS = 1_789_459_200_000;
const ONE_MINUTE_MS = 60_000;
/** How long a released organization slug stays reserved for its former owner. */
const SLUG_RESERVATION_DAYS = 90;
/** Delivery attempts after which the outbox dispatcher dead-letters an event. */
const OUTBOX_DEAD_LETTER_ATTEMPTS = 5;

const at = (minutes: number): bigint => BigInt(BASE_EPOCH_MS + minutes * ONE_MINUTE_MS);
const id = (key: string): string => deterministicUuid(NAMESPACE, key);
const correlation = (key: string): string => `seed-${id(`correlation:${key}`)}`;

export interface PlatformRecordsActors {
	readonly superAdminId: string;
	readonly adminId: string;
	readonly userId: string;
}

export interface PlatformRecordsSummary {
	readonly outboxEvents: number;
	readonly slugHistory: number;
	readonly softDeletedCatalogRows: number;
}

/** An outbox row exactly as `PlatformOutboxService.buildRow` writes it, at a fixed time and id. */
function outboxRow(key: string, event: PlatformEventInput, minutes: number): Prisma.OutboxEventCreateInput & { readonly id: string } {
	const correlationId: string = correlation(key);
	const envelope = PlatformEventEnvelopeSchema.parse({ ...event, correlationId, occurredAt: BASE_EPOCH_MS + minutes * ONE_MINUTE_MS });
	return {
		id: id(key),
		topic: PLATFORM_EVENT_TOPICS[envelope.type],
		eventType: envelope.type,
		partitionKey: resolvePartitionKey(event),
		correlationId,
		payload: JsonObjectSchema.parse(JSON.parse(JSON.stringify(envelope))),
		createdAt: at(minutes),
	};
}

async function seedOutbox(actors: PlatformRecordsActors): Promise<number> {
	const published: OutboxEventStatus = "PUBLISHED";
	const failed: OutboxEventStatus = "FAILED";
	const rows: (Prisma.OutboxEventCreateInput & { readonly id: string })[] = [
		{
			...outboxRow(
				"outbox:published",
				{ type: "email.log.updated", payload: { templateKey: "welcome", status: "sent", resendId: "re_seed_0001", error: null, durationMs: 312 } },
				20,
			),
			status: published,
			attempts: 1,
			lastError: null,
			availableAt: at(20),
			publishedAt: at(21),
			updatedAt: at(21),
		},
		{
			// Keyed by the acting user (`resolvePartitionKey`), so one user's events stay ordered on one Kafka partition.
			...outboxRow(
				"outbox:published-login",
				{ type: "auth.flow", payload: { flow: "login", userId: actors.userId, clientType: "web", status: "succeeded", error: null, durationMs: 187 } },
				12,
			),
			status: published,
			attempts: 1,
			lastError: null,
			availableAt: at(12),
			publishedAt: at(13),
			updatedAt: at(13),
		},
		{
			...outboxRow(
				"outbox:published-session",
				{ type: "session.action", payload: { action: "refresh", userId: actors.userId, status: "succeeded", error: null, durationMs: 41 } },
				15,
			),
			status: published,
			attempts: 1,
			lastError: null,
			availableAt: at(15),
			publishedAt: at(16),
			updatedAt: at(16),
		},
		{
			// Tagged with its tenant, so the analytics row is partitioned by organization.
			...outboxRow(
				"outbox:published-reward",
				{
					type: "reward.platform",
					payload: { event: "reward.auto_published", actorUserId: null, organizationId: ORGANIZATION_SEED_IDS.klOrganization, metadata: { rewardCount: "2" } },
				},
				25,
			),
			status: published,
			attempts: 1,
			lastError: null,
			availableAt: at(25),
			publishedAt: at(26),
			updatedAt: at(26),
		},
		{
			...outboxRow(
				"outbox:failed",
				{
					type: "email.log.updated",
					payload: { templateKey: "password-reset", status: "failed", resendId: null, error: "Recipient mailbox rejected the message", durationMs: 845 },
				},
				30,
			),
			status: failed,
			attempts: OUTBOX_DEAD_LETTER_ATTEMPTS,
			lastError: "KafkaJSNumberOfRetriesExceeded: broker unavailable after 5 attempts",
			availableAt: at(62),
			publishedAt: null,
			updatedAt: at(62),
		},
	];
	for (const row of rows) {
		await prisma.outboxEvent.upsert({ where: { id: row.id }, create: row, update: {} });
	}
	return rows.length;
}

/** The KL merchant renamed its slug: the old one stays reserved for it (no one else can claim it). */
async function seedSlugHistory(): Promise<number> {
	const previousSlug = `${ORGANIZATION_SEED_SLUGS.kl}-cafe`;
	await prisma.organizationSlugHistory.upsert({
		where: { slug: previousSlug },
		create: {
			organizationId: ORGANIZATION_SEED_IDS.klOrganization,
			slug: previousSlug,
			reservedUntil: BigInt(Date.now() + SLUG_RESERVATION_DAYS * DAY_MS),
			createdAt: at(-30 * 24 * 60),
		},
		update: {},
	});
	return 1;
}

async function seedCatalog(): Promise<number> {
	const deletedAt: bigint = at(40);
	const categoryId: string = id("category:discontinued");
	await prisma.sampleCategory.upsert({
		where: { id: categoryId },
		create: {
			id: categoryId,
			name: "Seasonal Gifts (discontinued)",
			slug: "seasonal-gifts-discontinued",
			description: "Holiday gift sets — retired after the season and soft-deleted with its products.",
			isActive: false,
			sortOrder: 999,
			version: 3,
			deletedAt,
			createdAt: at(-90 * 24 * 60),
			updatedAt: deletedAt,
		},
		update: {},
	});
	await prisma.product.upsert({
		where: { id: id("product:discontinued") },
		create: {
			id: id("product:discontinued"),
			categoryId,
			name: "Festive Gift Hamper",
			slug: "festive-gift-hamper",
			sku: "GIFT-HAMPER-2025",
			brand: "BrewCraft",
			shortDescription: "Coffee, mug and biscuits in a gift box.",
			description: "A seasonal hamper sold during the 2025 holidays. Soft-deleted together with its category.",
			price: "89.90",
			compareAtPrice: "109.90",
			stockQuantity: 0,
			weightGrams: 1850,
			imageUrl: "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800",
			isActive: false,
			isFeatured: false,
			version: 4,
			deletedAt,
			createdAt: at(-90 * 24 * 60),
			updatedAt: deletedAt,
		},
		update: {},
	});
	const liveCategory = await prisma.sampleCategory.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } });
	if (liveCategory === null) {
		throw new Error("Seed row not found: a live sample category (run the sample-platform seeder first)");
	}
	await prisma.product.upsert({
		where: { id: id("product:featured-mug") },
		create: {
			id: id("product:featured-mug"),
			categoryId: liveCategory.id,
			name: "Stoneware Pour-Over Mug",
			slug: "stoneware-pour-over-mug",
			sku: "MUG-POUR-350",
			brand: "BrewCraft",
			shortDescription: "350 ml hand-glazed stoneware mug.",
			description: "Hand-glazed stoneware, dishwasher safe. Edited twice since launch (version 2).",
			price: "39.00",
			compareAtPrice: null,
			stockQuantity: 140,
			weightGrams: 420,
			imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800",
			isActive: true,
			isFeatured: true,
			version: 2,
			deletedAt: null,
			createdAt: at(-60 * 24 * 60),
			updatedAt: at(10),
		},
		update: {},
	});
	return 2;
}

export async function seedPlatformRecords(actors: PlatformRecordsActors): Promise<PlatformRecordsSummary> {
	return {
		outboxEvents: await seedOutbox(actors),
		slugHistory: await seedSlugHistory(),
		softDeletedCatalogRows: await seedCatalog(),
	};
}
