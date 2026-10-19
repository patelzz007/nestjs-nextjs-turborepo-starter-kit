// Pure helpers of `dev.ts mail` (tested in __tests__/mailpit.spec.ts).

import { z } from "zod";

/** One-time codes the API emails (sign-in, email verification, reward claims) are six digits. */
const VERIFICATION_CODE_PATTERN = /\b(?<code>\d{6})\b/gu;
/** A link ends before whitespace or a closing quote/bracket, and never on sentence punctuation. */
const LINK_PATTERN = /(?<link>https?:\/\/[^\s<>"')\]]*[^\s<>"')\].,;:!?])/gu;
/** Stands in for a missing value (an absent `--to` argument, an unmatched group) — always rejected or filtered out. */
const EMPTY = "";

const MailpitAddressSchema = z.object({ Address: z.string() }).loose();

/** `GET /api/v1/message/{ID}` — only the fields the summary prints. */
export const MailpitMessageSchema = z
	.object({
		ID: z.string(),
		Subject: z.string(),
		Date: z.string(),
		To: z.array(MailpitAddressSchema).nullable(),
		Text: z.string(),
	})
	.loose();
export type MailpitMessage = z.output<typeof MailpitMessageSchema>;

/** `GET /api/v1/search` — newest first. */
export const MailpitSearchResponseSchema = z.object({ messages: z.array(z.object({ ID: z.string() }).loose()) }).loose();

const InboxArgsSchema = z.object({
	to: z.email({ error: "--to must be an email address" }).nullable(),
	codeOnly: z.boolean(),
});
export type InboxArgs = z.output<typeof InboxArgsSchema>;

/** `[--to <email>] [--code]` → options. Unknown flags are refused so a typo never silently widens the search. */
export function parseInboxArgs(argv: readonly string[]): InboxArgs {
	let to: string | null = null;
	let codeOnly = false;
	const remaining: string[] = [...argv];
	for (let flag = remaining.shift(); flag !== undefined; flag = remaining.shift()) {
		if (flag === "--code") {
			codeOnly = true;
		} else if (flag === "--to") {
			to = remaining.shift() ?? EMPTY;
		} else if (flag.startsWith("--to=")) {
			to = flag.slice("--to=".length);
		} else {
			throw new Error(`Unknown argument: ${flag} (usage: pnpm mail:latest [--to <email>] [--code])`);
		}
	}
	return InboxArgsSchema.parse({ to, codeOnly });
}

/** Search API path that finds the newest message sent to `to`. */
export function newestMessageToPath(to: string): string {
	const query = new URLSearchParams({ query: `to:"${to}"`, limit: "1" });
	return `/api/v1/search?${query.toString()}`;
}

/** Every six-digit code in an email body, in order, without repeats. */
export function extractVerificationCodes(text: string): string[] {
	const codes = [...text.matchAll(VERIFICATION_CODE_PATTERN)].map((match: RegExpExecArray): string => match.groups?.code ?? EMPTY);
	return [...new Set(codes.filter((code: string): boolean => code !== EMPTY))];
}

/** Every http(s) link in an email body (verification, reset and invite links), without repeats. */
export function extractLinks(text: string): string[] {
	const links = [...text.matchAll(LINK_PATTERN)].map((match: RegExpExecArray): string => match.groups?.link ?? EMPTY);
	return [...new Set(links.filter((link: string): boolean => link !== EMPTY))];
}

/** Human- and agent-readable summary: who, what, the codes and links, then the plain-text body. */
export function formatMessage(message: MailpitMessage): string {
	const recipients = (message.To ?? []).map((address: z.output<typeof MailpitAddressSchema>): string => address.Address).join(", ");
	const codes = extractVerificationCodes(message.Text);
	const links = extractLinks(message.Text);
	return [
		`To:      ${recipients}`,
		`Subject: ${message.Subject}`,
		`Date:    ${message.Date}`,
		`Codes:   ${codes.length > 0 ? codes.join(", ") : "(none)"}`,
		...(links.length > 0 ? ["Links:", ...links.map((link: string): string => `  ${link}`)] : []),
		"",
		message.Text.trim(),
	].join("\n");
}
