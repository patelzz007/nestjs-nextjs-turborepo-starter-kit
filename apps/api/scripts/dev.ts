// ============================================
// scripts/dev.ts — local development tooling, one command each (never for production)
// ============================================
//   tunnel                       pnpm dev:tunnel — detached Cloudflare quick tunnel to the API, webhooks re-pointed
//   github-webhook <tunnel-url>  pnpm --filter @workspace/api github:webhook-tunnel — re-point GitHub live updates only
//   mail [--to <email>] [--code] pnpm mail:latest — the newest email in the local Mailpit
//   webhook-signature            pnpm --filter @workspace/api webhook:test-signature — a signed + a tampered Resend event
//   email-previews               pnpm --filter @workspace/api email:previews — the docs gallery screenshots
// Run through the package scripts, which load apps/api/.env first.

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { GithubAccountLinkStatus, PrismaClient } from "@prisma/client";
import { CaughtValueSchema, EmailRenderContextSchema, HttpUrlEnvSchema } from "@workspace/shared";

import { ApiEnvSchema } from "../src/config/api-config.schema";
import { TypedConfigService } from "../src/config/typed-config.service";
import { GithubCredentialCipher } from "../src/contexts/integrations-github/infrastructure/adapters/github-credential.cipher";
import { GithubHttpTransport, GLOBAL_GITHUB_FETCH } from "../src/contexts/integrations-github/infrastructure/github-api/github-http.transport";
import { GithubWebhooksClient } from "../src/contexts/integrations-github/infrastructure/github-api/github-webhooks.client";
import { readCaughtErrorMessage } from "../src/platform/infrastructure/utils/caught-error";
import { EXIT_FAILED, EXIT_OK, PROCESS_OUTPUT, runCli, type CliCommand } from "./lib/cli";
import { lightPinnedHtml } from "./lib/email-preview";
import { extractVerificationCodes, formatMessage, MailpitMessageSchema, MailpitSearchResponseSchema, newestMessageToPath, parseInboxArgs } from "./lib/mailpit";
import { EMAIL_WEBHOOK_PATH, envValue, findEmailWebhookId, newestTunnelUrl, ResendWebhookListSchema, webhookUrlFor, withEnvValue } from "./lib/tunnel";
import { signStandardWebhook, standardWebhookHeaders } from "./lib/webhook-signature";

const { out, err } = PROCESS_OUTPUT;
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiEnvPath = resolve(apiDir, ".env");

function refuseInProduction(command: string): boolean {
	if (process.env.NODE_ENV === "production") {
		err(`${command}: refused — this is development tooling. In production, configure the API's own https address instead.`);
		return true;
	}
	return false;
}

// ── github-webhook ────────────────────────────────────────────────────────

/** 32 random bytes as hex: 64 characters, well past the 32 the API requires. */
const GITHUB_SECRET_BYTES = 32;
const GITHUB_SECRET_MIN_LENGTH = 32;

/** Sets the two webhook settings in apps/api/.env (and in this process, so the API config parses with them). */
function writeGithubWebhookSettings(webhookUrl: string): string {
	let envText = readFileSync(apiEnvPath, "utf8");
	let secret = envValue(envText, "GITHUB_WEBHOOK_SECRET");
	if (secret === null || secret.length < GITHUB_SECRET_MIN_LENGTH) {
		secret = randomBytes(GITHUB_SECRET_BYTES).toString("hex");
		envText = withEnvValue(envText, "GITHUB_WEBHOOK_SECRET", secret);
		out("Generated GITHUB_WEBHOOK_SECRET in apps/api/.env");
	}
	envText = withEnvValue(envText, "GITHUB_WEBHOOK_URL", webhookUrl);
	writeFileSync(apiEnvPath, envText, "utf8");
	process.env.GITHUB_WEBHOOK_SECRET = secret;
	process.env.GITHUB_WEBHOOK_URL = webhookUrl;
	out(`GITHUB_WEBHOOK_URL=${webhookUrl} written to apps/api/.env`);
	return secret;
}

/** Re-points every live repository hook to the new address, each with the token of the admin who turned it on. */
async function repointGithubHooks(webhookUrl: string, secret: string): Promise<void> {
	const config = new TypedConfigService(ApiEnvSchema.parse(process.env));
	const cipher = new GithubCredentialCipher(config);
	if (!cipher.isEnabled()) {
		out("GITHUB_CREDENTIAL_ENCRYPTION_KEYS is not set: pull requests are off, nothing to re-point.");
		return;
	}
	const webhooks = new GithubWebhooksClient(new GithubHttpTransport(config, GLOBAL_GITHUB_FETCH));
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.database.url, application_name: "dev-github-webhook" }) });
	try {
		const subscriptions = await prisma.githubWebhookSubscription.findMany({ where: { isDeleted: false } });
		if (subscriptions.length === 0) {
			out("No repository has live updates yet — turn them on from a pull request in the app.");
			return;
		}
		for (const subscription of subscriptions) {
			const name = `${subscription.owner}/${subscription.repository}`;
			const link = await prisma.githubAccountLink.findFirst({ where: { userId: subscription.createdBy, isDeleted: false } });
			if (link === null || link.status === GithubAccountLinkStatus.REJECTED) {
				out(`${name}: the admin who turned it on has no working token linked — turn live updates off and on again in the app.`);
				continue;
			}
			try {
				const token = cipher.decrypt({ ciphertext: link.tokenCiphertext, keyVersion: link.tokenKeyVersion }, subscription.createdBy);
				const repository = { owner: subscription.owner, repository: subscription.repository };
				if (await webhooks.repointHook({ source: "linked", token }, repository, subscription.githubHookId, { url: webhookUrl, secret })) {
					out(`${name}: hook re-pointed to the tunnel.`);
					continue;
				}
				const nowMs = BigInt(Date.now());
				await prisma.githubWebhookSubscription.update({
					where: { id: subscription.id },
					data: { isDeleted: true, deletedAt: nowMs, deletedBy: subscription.createdBy, updatedAt: nowMs },
				});
				out(`${name}: its hook was deleted on GitHub — turned live updates off here; turn them on again in the app.`);
			} catch (error: unknown) {
				out(`${name}: could not re-point its hook (${readCaughtErrorMessage(CaughtValueSchema.parse(error))}) — turn live updates off and on again in the app.`);
			}
		}
	} finally {
		await prisma.$disconnect();
	}
}

/**
 * GitHub delivers webhooks only to a public https address, so on a laptop they come through a quick tunnel
 * whose address changes on every run. Writes GITHUB_WEBHOOK_SECRET (kept, or generated) and
 * GITHUB_WEBHOOK_URL into apps/api/.env and re-points every repository already turned on; a hook deleted
 * on GitHub meanwhile is turned off here too. Restart the API afterwards so it reads the new address.
 */
async function githubWebhook(args: readonly string[]): Promise<number> {
	if (refuseInProduction("github-webhook")) {
		return EXIT_FAILED;
	}
	const [tunnelUrl] = args;
	if (tunnelUrl === undefined) {
		err("Usage: dev github-webhook <https://<name>.trycloudflare.com>");
		return EXIT_FAILED;
	}
	const webhookUrl = webhookUrlFor(tunnelUrl);
	await repointGithubHooks(webhookUrl, writeGithubWebhookSettings(webhookUrl));
	out("Restart the API (pnpm dev) so it reads the new address; then turn live updates on from a pull request in the app.");
	return EXIT_OK;
}

// ── tunnel ────────────────────────────────────────────────────────────────

const TUNNEL_LOG_PATH = join(tmpdir(), "cloudflared.log");
// A quick tunnel must not read ~/.cloudflared/config.yml: when a NAMED tunnel is configured there, its
// ingress rules apply to the quick tunnel too and its catch-all answers every request with 404.
const QUICK_TUNNEL_CONFIG_PATH = join(tmpdir(), "cloudflared-quick-tunnel.yml");
const TUNNEL_TARGET = "http://localhost:8080";
const TUNNEL_REGISTER_TIMEOUT_MS = 30_000;
const TUNNEL_POLL_INTERVAL_MS = 1000;
const RESEND_WEBHOOKS_URL = "https://api.resend.com/webhooks";
// Resend sits behind Cloudflare's edge, which rejects anonymous default user agents.
const RESEND_USER_AGENT = "starter-kit dev tunnel";

/** Starts cloudflared in its own session (it outlives this process and the terminal), logging to TUNNEL_LOG_PATH. */
function spawnDetachedTunnel(): void {
	rmSync(TUNNEL_LOG_PATH, { force: true });
	writeFileSync(QUICK_TUNNEL_CONFIG_PATH, "# Quick tunnel: no ingress rules — everything goes to --url.\n");
	const args = [
		"--config",
		QUICK_TUNNEL_CONFIG_PATH,
		"tunnel",
		"--url",
		TUNNEL_TARGET,
		"--no-autoupdate",
		"--protocol",
		"http2",
		"--region",
		"us",
		"--logfile",
		TUNNEL_LOG_PATH,
	];
	spawn("cloudflared", args, { detached: true, stdio: "ignore" }).unref();
}

async function waitForTunnelUrl(): Promise<string | null> {
	const deadline = Date.now() + TUNNEL_REGISTER_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const url = existsSync(TUNNEL_LOG_PATH) ? newestTunnelUrl(readFileSync(TUNNEL_LOG_PATH, "utf8")) : null;
		if (url !== null) {
			return url;
		}
		await sleep(TUNNEL_POLL_INTERVAL_MS);
	}
	return null;
}

/**
 * Re-points the Resend delivery webhook (the one whose endpoint ends in EMAIL_WEBHOOK_PATH — never an
 * unrelated one) to the new address. Without it, delivery events die after every tunnel restart. Non-fatal.
 */
async function repointResendWebhook(emailWebhookUrl: string): Promise<void> {
	const pasteHint = `Paste this URL in the Resend dashboard: ${emailWebhookUrl}`;
	const apiKey = process.env.RESEND_API_KEY;
	if (apiKey === undefined || apiKey.length === 0) {
		out(`RESEND_API_KEY is not set — skipping the Resend webhook re-point. ${pasteHint}`);
		return;
	}
	const headers = { Authorization: `Bearer ${apiKey}`, "User-Agent": RESEND_USER_AGENT };
	try {
		const listed = await fetch(RESEND_WEBHOOKS_URL, { headers });
		if (!listed.ok) {
			out(`Cannot list Resend webhooks (HTTP ${String(listed.status)}). ${pasteHint}`);
			return;
		}
		const webhookId = findEmailWebhookId(ResendWebhookListSchema.parse(await listed.json()));
		if (webhookId === null) {
			out(`No Resend webhook ends in ${EMAIL_WEBHOOK_PATH} — nothing re-pointed, so an unrelated webhook is never touched. ${pasteHint}`);
			return;
		}
		// Resend's update field is `endpoint`: a body with `url` answers 2xx and changes nothing.
		const updated = await fetch(`${RESEND_WEBHOOKS_URL}/${encodeURIComponent(webhookId)}`, {
			method: "PATCH",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({ endpoint: emailWebhookUrl }),
		});
		out(updated.ok ? `Resend webhook re-pointed → ${emailWebhookUrl}` : `Could not update Resend webhook ${webhookId} (HTTP ${String(updated.status)}). ${pasteHint}`);
	} catch (error: unknown) {
		out(`Cannot reach Resend (${readCaughtErrorMessage(CaughtValueSchema.parse(error))}). ${pasteHint}`);
	}
}

/**
 * A Cloudflare quick tunnel to the local API that survives the terminal, then the webhooks that need a
 * public address re-pointed to it: Resend's delivery webhook and GitHub live pull-request updates. Every
 * run gets a NEW `*.trycloudflare.com` address. A wiring step that fails prints what to do instead.
 */
async function tunnel(): Promise<number> {
	if (refuseInProduction("tunnel")) {
		return EXIT_FAILED;
	}
	spawnDetachedTunnel();
	const url = await waitForTunnelUrl();
	if (url === null) {
		err(`The tunnel started but registered no address within ${String(TUNNEL_REGISTER_TIMEOUT_MS / TUNNEL_POLL_INTERVAL_MS)}s — see ${TUNNEL_LOG_PATH}.`);
		return EXIT_FAILED;
	}
	out(`Tunnel URL: ${url}`);
	out(`Email webhook URL: ${url}${EMAIL_WEBHOOK_PATH}`);
	await repointResendWebhook(`${url}${EMAIL_WEBHOOK_PATH}`);
	try {
		await githubWebhook([url]);
	} catch (error: unknown) {
		out(`Could not wire GitHub live updates (${readCaughtErrorMessage(CaughtValueSchema.parse(error))}). Run: pnpm --filter @workspace/api github:webhook-tunnel ${url}`);
	}
	return EXIT_OK;
}

// ── mail ──────────────────────────────────────────────────────────────────

const DEFAULT_MAILPIT_URL = "http://localhost:8025";

async function requestMailpit(url: string): Promise<Response> {
	try {
		return await fetch(url);
	} catch (error: unknown) {
		throw new Error(`No Mailpit answers at ${url} — start it with \`pnpm mailpit\` (install: \`brew install mailpit\`)`, { cause: error });
	}
}

/**
 * Prints the newest email Mailpit holds (or the newest one sent to `--to <email>`): recipient, subject,
 * the six-digit codes and links it contains, then its text. `--code` prints only the first code:
 *   CODE=$(pnpm mail:latest --to admin@example.com --code)
 * Needs EMAIL_PROVIDER=mailpit and a running Mailpit; reads MAILPIT_URL (default http://localhost:8025).
 */
async function mail(args: readonly string[]): Promise<number> {
	const inbox = parseInboxArgs(args);
	const mailpitUrl = HttpUrlEnvSchema.parse(process.env.MAILPIT_URL ?? DEFAULT_MAILPIT_URL);
	// Mailpit's alias for the newest message in the inbox.
	let messageId = "latest";
	if (inbox.to !== null) {
		const search = MailpitSearchResponseSchema.parse(await (await requestMailpit(`${mailpitUrl}${newestMessageToPath(inbox.to)}`)).json());
		const newest = search.messages.at(0);
		if (newest === undefined) {
			err(`No email to ${inbox.to} in Mailpit yet.`);
			return EXIT_FAILED;
		}
		messageId = newest.ID;
	}
	const response = await requestMailpit(`${mailpitUrl}/api/v1/message/${encodeURIComponent(messageId)}`);
	if (!response.ok) {
		err("Mailpit holds no email yet.");
		return EXIT_FAILED;
	}
	const message = MailpitMessageSchema.parse(await response.json());
	if (!inbox.codeOnly) {
		out(formatMessage(message));
		return EXIT_OK;
	}
	const code = extractVerificationCodes(message.Text).at(0);
	if (code === undefined) {
		err(`The newest email ("${message.Subject}") contains no six-digit code.`);
		return EXIT_FAILED;
	}
	out(code);
	return EXIT_OK;
}

// ── webhook-signature ─────────────────────────────────────────────────────

const DEFAULT_EMAIL_WEBHOOK_URL = `http://localhost:8080${EMAIL_WEBHOOK_PATH}`;
const MS_PER_SECOND = 1000;

async function postWebhook(url: string, headers: ReadonlyMap<string, string>, body: string): Promise<string> {
	try {
		const response = await fetch(url, { method: "POST", headers: [["content-type", "application/json"], ...headers], body });
		return `${String(response.status)} | ${await response.text()}`;
	} catch (error: unknown) {
		return `network error (is the API on :8080 / the tunnel up?) — ${readCaughtErrorMessage(CaughtValueSchema.parse(error))}`;
	}
}

/**
 * Posts one Resend event signed with RESEND_WEBHOOK_SECRET (expect 200) and one tampered copy (expect 403)
 * to WEBHOOK_URL (default: the local API), after printing the headers for Swagger's "Try it out" and a curl.
 */
async function webhookSignature(): Promise<number> {
	const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
	const url = process.env.WEBHOOK_URL ?? DEFAULT_EMAIL_WEBHOOK_URL;
	const id = `msg_test_${String(Date.now())}`;
	const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "e5e8d669-9ef0-44de-98f9-4097dcab36d8" } });
	const headers = standardWebhookHeaders(signStandardWebhook(secret, id, Math.floor(Date.now() / MS_PER_SECOND), payload));
	out('Headers for Swagger\'s "Try it out" (paste the body exactly, on one line):');
	for (const [name, value] of headers) {
		out(`  ${name.padEnd("webhook-timestamp".length)}  ${value}`);
	}
	out(`  body               ${payload}`);
	out("");
	out(`curl -s -X POST '${url}' -H 'content-type: application/json' ${[...headers].map(([name, value]): string => `-H '${name}: ${value}'`).join(" ")} -d '${payload}'`);
	out("");
	out(`signed request   → ${await postWebhook(url, headers, payload)}`);
	const tampered = JSON.stringify({ type: "email.delivered", data: { email_id: "deadbeef-0000-0000-0000-000000000000" } });
	out(`tampered request → ${await postWebhook(url, headers, tampered)}`);
	return EXIT_OK;
}

// ── email-previews ────────────────────────────────────────────────────────

const DEFAULT_CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PREVIEW_WIDTH = 1360;
const PREVIEW_HEIGHT = 1300;

/**
 * Renders every email template and screenshots it with headless Chrome (light mode pinned) into
 * docs/images/email/<key>.png for the docs gallery; the HTML lands in <tmp>/email-previews for inspection.
 * Needs Google Chrome (CHROME_BIN overrides the macOS default path) and the API environment (apps/api/.env).
 */
async function emailPreviews(): Promise<number> {
	const chrome = process.env.CHROME_BIN ?? DEFAULT_CHROME_BIN;
	if (!existsSync(chrome)) {
		err(`Chrome not found at ${chrome} — set CHROME_BIN to its executable.`);
		return EXIT_FAILED;
	}
	// Loaded here, not at the top: the notifications graph reads the full API configuration when it loads.
	const { EMAIL_TEMPLATE_REGISTRY } = await import("../src/contexts/notifications/public-api");
	const context = EmailRenderContextSchema.parse({ appName: "Acme Inc", appUrl: "https://app.example.com", supportEmail: "support@example.com" });
	const htmlDir = join(tmpdir(), "email-previews");
	const pngDir = resolve(apiDir, "..", "..", "docs", "images", "email");
	mkdirSync(htmlDir, { recursive: true });
	mkdirSync(pngDir, { recursive: true });
	for (const entry of Object.values(EMAIL_TEMPLATE_REGISTRY)) {
		const html = entry.build().renderHtml(context);
		const htmlFile = join(htmlDir, `${entry.key}.html`);
		const lightFile = join(htmlDir, `${entry.key}.light.html`);
		const pngFile = join(pngDir, `${entry.key}.png`);
		writeFileSync(htmlFile, html, "utf8");
		writeFileSync(lightFile, lightPinnedHtml(html), "utf8");
		execFileSync(
			chrome,
			[
				"--headless",
				"--disable-gpu",
				"--hide-scrollbars",
				"--force-device-scale-factor=1",
				`--window-size=${String(PREVIEW_WIDTH)},${String(PREVIEW_HEIGHT)}`,
				`--screenshot=${pngFile}`,
				`file://${lightFile}`,
			],
			{ stdio: "ignore" },
		);
		out(`wrote ${pngFile} from ${htmlFile}`);
	}
	return EXIT_OK;
}

// ── entry ─────────────────────────────────────────────────────────────────

const DEV_COMMANDS: ReadonlyMap<string, CliCommand> = new Map<string, CliCommand>([
	["tunnel", { summary: "Start a detached quick tunnel to the API and re-point the Resend and GitHub webhooks", run: tunnel }],
	["github-webhook", { summary: "Re-point GitHub live pull-request updates to <tunnel-url>", run: githubWebhook }],
	["mail", { summary: "Print the newest email in Mailpit (--to <email>, --code)", run: mail }],
	["webhook-signature", { summary: "Post a signed and a tampered Resend event to the email webhook", run: webhookSignature }],
	["email-previews", { summary: "Screenshot every email template into docs/images/email", run: emailPreviews }],
]);

process.exitCode = await runCli("dev", DEV_COMMANDS, process.argv.slice(2));
