// ============================================
// github-webhook-tunnel.ts - Live pull-request updates through a quick tunnel (development)
// ============================================
// `pnpm --filter @workspace/api github:webhook-tunnel <https://….trycloudflare.com>`
// — run by `start-tunnel.py` (root: `pnpm dev:tunnel`) once its tunnel is up.
// GitHub delivers webhooks only to a public https address, so on a laptop they
// come through a Cloudflare quick tunnel, whose address changes on every run.
// This wires each new address:
//   1. `GITHUB_WEBHOOK_SECRET` — kept, or generated into apps/api/.env;
//   2. `GITHUB_WEBHOOK_URL` = <tunnel>/api/v1/github/webhook in apps/api/.env
//      (the API reads it at start: restart `pnpm dev` afterwards);
//   3. every repository already turned on is re-pointed to it on GitHub, with
//      the token of the admin who turned it on; a hook deleted on GitHub meanwhile
//      is turned off here too, so the app offers "Turn on" again.
// Development only: refused when NODE_ENV=production. Nothing is fatal — what
// could not be done is printed with what to do instead.

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { GithubAccountLinkStatus, PrismaClient } from "@prisma/client";

import { ApiEnvSchema } from "../src/config/api-config.schema";
import { TypedConfigService } from "../src/config/typed-config.service";
import { GithubHttpTransport, GLOBAL_GITHUB_FETCH } from "../src/modules/github/github-http.transport";
import { GithubWebhooksClient } from "../src/modules/github/live-updates/github-webhooks.client";
import { GithubCredentialCipher } from "../src/modules/github/pull-requests/github-credential.cipher";
import { envValue, webhookUrlFor, withEnvValue } from "./github-webhook-tunnel.lib";

const API_ENV_PATH = resolve(import.meta.dirname, "..", ".env");
/** 32 random bytes as hex: 64 characters, well past the 32 the API requires. */
const SECRET_BYTES = 32;
const SECRET_MIN_LENGTH = 32;
const EXIT_OK = 0;
const EXIT_REFUSED = 1;

function log(message: string): void {
	process.stdout.write(`[github-webhook-tunnel] ${message}\n`);
}

/** Sets the two webhook settings in apps/api/.env (and in this process, so the API config parses with them). */
function writeWebhookSettings(webhookUrl: string): string {
	let envText = readFileSync(API_ENV_PATH, "utf8");
	let secret = envValue(envText, "GITHUB_WEBHOOK_SECRET");
	if (secret === null || secret.length < SECRET_MIN_LENGTH) {
		secret = randomBytes(SECRET_BYTES).toString("hex");
		envText = withEnvValue(envText, "GITHUB_WEBHOOK_SECRET", secret);
		log("Generated GITHUB_WEBHOOK_SECRET in apps/api/.env");
	}
	envText = withEnvValue(envText, "GITHUB_WEBHOOK_URL", webhookUrl);
	writeFileSync(API_ENV_PATH, envText, "utf8");
	process.env.GITHUB_WEBHOOK_SECRET = secret;
	process.env.GITHUB_WEBHOOK_URL = webhookUrl;
	log(`GITHUB_WEBHOOK_URL=${webhookUrl} written to apps/api/.env`);
	return secret;
}

/** Re-points every live repository hook to the new address, each with the token of the admin who turned it on. */
async function repointLiveHooks(webhookUrl: string, secret: string): Promise<void> {
	const config = new TypedConfigService(ApiEnvSchema.parse(process.env));
	const cipher = new GithubCredentialCipher(config);
	if (!cipher.isEnabled()) {
		log("GITHUB_CREDENTIAL_ENCRYPTION_KEYS is not set: pull requests are off, nothing to re-point.");
		return;
	}
	const webhooks = new GithubWebhooksClient(new GithubHttpTransport(config, GLOBAL_GITHUB_FETCH));
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.database.url, application_name: "github-webhook-tunnel" }) });
	try {
		const subscriptions = await prisma.githubWebhookSubscription.findMany({ where: { isDeleted: false } });
		if (subscriptions.length === 0) {
			log("No repository has live updates yet — turn them on from a pull request in the app.");
			return;
		}
		for (const subscription of subscriptions) {
			const name = `${subscription.owner}/${subscription.repository}`;
			const link = await prisma.githubAccountLink.findFirst({ where: { userId: subscription.createdBy, isDeleted: false } });
			if (link === null || link.status === GithubAccountLinkStatus.REJECTED) {
				log(`${name}: the admin who turned it on has no working token linked — turn live updates off and on again in the app.`);
				continue;
			}
			try {
				const token = cipher.decrypt({ ciphertext: link.tokenCiphertext, keyVersion: link.tokenKeyVersion }, subscription.createdBy);
				const repository = { owner: subscription.owner, repository: subscription.repository };
				const exists = await webhooks.repointHook({ source: "linked", token }, repository, subscription.githubHookId, { url: webhookUrl, secret });
				if (exists) {
					log(`${name}: hook re-pointed to the tunnel.`);
					continue;
				}
				const nowMs = BigInt(Date.now());
				await prisma.githubWebhookSubscription.update({
					where: { id: subscription.id },
					data: { isDeleted: true, deletedAt: nowMs, deletedBy: subscription.createdBy, updatedAt: nowMs },
				});
				log(`${name}: its hook was deleted on GitHub — turned live updates off here; turn them on again in the app.`);
			} catch (error: unknown) {
				log(`${name}: could not re-point its hook (${error instanceof Error ? error.message : "unknown error"}) — turn live updates off and on again in the app.`);
			}
		}
	} finally {
		await prisma.$disconnect();
	}
}

async function main(): Promise<number> {
	if (process.env.NODE_ENV === "production") {
		log("Refused: quick tunnels are for development. In production set GITHUB_WEBHOOK_URL to the API's own https address.");
		return EXIT_REFUSED;
	}
	const [tunnelUrl] = process.argv.slice(2);
	if (tunnelUrl === undefined) {
		log("Usage: github-webhook-tunnel <https://<name>.trycloudflare.com>");
		return EXIT_REFUSED;
	}
	const webhookUrl = webhookUrlFor(tunnelUrl);
	const secret = writeWebhookSettings(webhookUrl);
	await repointLiveHooks(webhookUrl, secret);
	log("Restart the API (pnpm dev) so it reads the new address; then turn live updates on from a pull request in the app.");
	return EXIT_OK;
}

main()
	.then((code: number): void => {
		process.exitCode = code;
	})
	.catch((error: unknown): void => {
		log(`Failed: ${error instanceof Error ? error.message : "unknown error"}`);
		process.exitCode = EXIT_REFUSED;
	});
