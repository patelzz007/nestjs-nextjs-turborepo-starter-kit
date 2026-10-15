import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

// ---------------------------------------------------------------------------
// GitHub live updates (ADR 052) — development scenario.
//
// The states the API itself leaves behind, all turned off again (soft-deleted):
//   - the Admin turned live updates on for `octo-demo/hello-world` three days
//     ago and off again half an hour ago;
//   - the SuperAdmin turned them on for `octo-demo/old-site`, then off again;
//   - two deliveries recorded while `hello-world` was on: GitHub's `ping` when
//     the hook was made (no pull request), and a pull-request event.
// No subscription is seeded live: a live one stands for a webhook that exists
// on GitHub, and these repositories and hook ids are placeholders — `pnpm
// dev:tunnel` re-points every live hook, and a made-up one could only fail.
// Turn live updates on from a real pull request in the app instead.
// Idempotent: upserted by repository and by delivery id.
// ---------------------------------------------------------------------------

const SUBSCRIPTION_NAMESPACE = "seed.github_webhook_subscription";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const HALF_HOUR_MS = HOUR_MS / 2;

/** Placeholder GitHub hook ids (any positive integers — never called, as no seeded subscription is live). */
const DEMO_HOOK_IDS = { helloWorld: 500_000_001n, oldSite: 500_000_002n };

export interface GithubWebhookSeedActors {
	readonly adminId: string;
	readonly superAdminId: string;
}

export interface GithubWebhookSeedSummary {
	readonly subscriptions: number;
	readonly deliveries: number;
}

export async function seedGithubWebhooks(actors: GithubWebhookSeedActors, nowMs: number): Promise<GithubWebhookSeedSummary> {
	const helloWorldSince = BigInt(nowMs - 3 * DAY_MS);
	const helloWorldUntil = BigInt(nowMs - HALF_HOUR_MS);
	const helloWorld = { owner: "octo-demo", repository: "hello-world" };
	const helloWorldTurnedOff = {
		githubHookId: DEMO_HOOK_IDS.helloWorld,
		createdBy: actors.adminId,
		isDeleted: true,
		deletedAt: helloWorldUntil,
		deletedBy: actors.adminId,
		updatedAt: helloWorldUntil,
	};
	await prisma.githubWebhookSubscription.upsert({
		where: { owner_repository: helloWorld },
		create: { id: deterministicUuid(SUBSCRIPTION_NAMESPACE, "hello-world"), ...helloWorld, ...helloWorldTurnedOff, createdAt: helloWorldSince },
		update: helloWorldTurnedOff,
	});

	const oldSiteSince = BigInt(nowMs - 10 * DAY_MS);
	const oldSiteUntil = BigInt(nowMs - DAY_MS);
	const oldSite = { owner: "octo-demo", repository: "old-site" };
	const oldSiteTurnedOff = {
		githubHookId: DEMO_HOOK_IDS.oldSite,
		createdBy: actors.superAdminId,
		isDeleted: true,
		deletedAt: oldSiteUntil,
		deletedBy: actors.superAdminId,
		updatedAt: oldSiteUntil,
	};
	await prisma.githubWebhookSubscription.upsert({
		where: { owner_repository: oldSite },
		create: { id: deterministicUuid(SUBSCRIPTION_NAMESPACE, "old-site"), ...oldSite, ...oldSiteTurnedOff, createdAt: oldSiteSince },
		update: oldSiteTurnedOff,
	});

	const deliveries = [
		{ deliveryId: "seed-delivery-ping", event: "ping", pullRequestNumber: null, receivedAt: helloWorldSince },
		{ deliveryId: "seed-delivery-pull-request", event: "pull_request", pullRequestNumber: 1, receivedAt: BigInt(nowMs - HOUR_MS) },
	];
	for (const delivery of deliveries) {
		await prisma.githubWebhookDelivery.upsert({
			where: { deliveryId: delivery.deliveryId },
			create: { ...helloWorld, ...delivery },
			update: { receivedAt: delivery.receivedAt },
		});
	}
	return { subscriptions: 2, deliveries: deliveries.length };
}
