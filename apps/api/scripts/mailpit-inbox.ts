// ============================================
// mailpit-inbox.ts - Read the newest email from the local Mailpit (development)
// ============================================
// `pnpm mail:latest [--to <email>] [--code]` (root) — prints the newest email
// Mailpit holds (or the newest one sent to <email>): recipient, subject, the
// six-digit codes and links it contains, then its plain-text body. `--code`
// prints only the first code, for scripts and AI agents signing in:
//   CODE=$(pnpm mail:latest --to admin@example.com --code)
// Needs EMAIL_PROVIDER=mailpit and a running Mailpit (`pnpm mailpit`).
// Reads MAILPIT_URL from apps/api/.env (default http://localhost:8025).

import { CaughtValueSchema, HttpUrlEnvSchema } from "@workspace/shared";

import { readCaughtErrorMessage } from "../src/common/utils/caught-error";

import { MailpitMessageSchema, MailpitSearchResponseSchema, formatMessage, extractVerificationCodes, newestMessageToPath, parseInboxArgs } from "./mailpit-inbox.lib";

const DEFAULT_MAILPIT_URL = "http://localhost:8025";
const EXIT_NOT_FOUND = 1;

function fail(message: string): void {
	process.stderr.write(`[mail:latest] ${message}\n`);
	process.exitCode = EXIT_NOT_FOUND;
}

async function request(url: string): Promise<Response> {
	try {
		return await fetch(url);
	} catch (error) {
		throw new Error(`No Mailpit answers at ${url} — start it with \`pnpm mailpit\` (install: \`brew install mailpit\`)`, { cause: error });
	}
}

async function main(): Promise<void> {
	const args = parseInboxArgs(process.argv.slice(2));
	const mailpitUrl = HttpUrlEnvSchema.parse(process.env.MAILPIT_URL ?? DEFAULT_MAILPIT_URL);

	// Mailpit's alias for the newest message in the inbox.
	let messageId = "latest";
	if (args.to !== null) {
		const search = MailpitSearchResponseSchema.parse(await (await request(`${mailpitUrl}${newestMessageToPath(args.to)}`)).json());
		const newest = search.messages.at(0);
		if (newest === undefined) {
			fail(`No email to ${args.to} in Mailpit yet.`);
			return;
		}
		messageId = newest.ID;
	}
	const response = await request(`${mailpitUrl}/api/v1/message/${encodeURIComponent(messageId)}`);
	if (!response.ok) {
		fail("Mailpit holds no email yet.");
		return;
	}
	const message = MailpitMessageSchema.parse(await response.json());
	if (!args.codeOnly) {
		process.stdout.write(`${formatMessage(message)}\n`);
		return;
	}
	const code = extractVerificationCodes(message.Text).at(0);
	if (code === undefined) {
		fail(`The newest email ("${message.Subject}") contains no six-digit code.`);
		return;
	}
	process.stdout.write(`${code}\n`);
}

try {
	await main();
} catch (error) {
	fail(readCaughtErrorMessage(CaughtValueSchema.parse(error)));
}
