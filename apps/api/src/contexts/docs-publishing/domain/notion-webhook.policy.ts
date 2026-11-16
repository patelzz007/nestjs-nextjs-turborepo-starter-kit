// ============================================
// notion-webhook.policy.ts - What Notion sends, and what is worth a sync (ADR 084)
// ============================================
// Notion signs every event with `X-Notion-Signature: sha256=<hex>`, an HMAC-SHA256 of the raw body keyed with the
// subscription's verification token. The first request is the handshake that delivers that token, which Notion
// then asks an operator to paste back into Notion. Its documentation calls the handshake unsigned, but the live
// service sends an `X-Notion-Signature` on it too (seen 2026-11-11). A server without the token cannot check that
// signature, so the handshake is recognised by its body alone, and only while no secret is configured.

import { z } from "zod";

import { HmacSha256HeaderVerifier, type HmacSha256HeaderScheme, type InboundWebhookRequest, type WebhookSignatureVerifier } from "../../webhooks/inbound/public-api";

const NOTION_SIGNATURE_SCHEME: HmacSha256HeaderScheme = { header: "x-notion-signature", prefix: "sha256=" };

/** Comfortably longer than the tokens Notion issues, and short enough to bound what an unsigned request can store. */
const VERIFICATION_TOKEN_MAX_LENGTH = 500;

const HandshakeBodySchema = z.object({ verification_token: z.string().min(1).max(VERIFICATION_TOKEN_MAX_LENGTH) }).strict();

/** Events about pages and their databases can change what is published; comments and the rest cannot. */
const SYNC_EVENT_PREFIXES: readonly string[] = ["page.", "data_source.", "database."];

/** Locking a page changes nothing a reader sees. */
const IGNORED_EVENTS: ReadonlySet<string> = new Set(["page.locked", "page.unlocked"]);

export function notionSignatureVerifier(secret: string): WebhookSignatureVerifier {
	return new HmacSha256HeaderVerifier(NOTION_SIGNATURE_SCHEME, secret);
}

/**
 * The verification token, when this request's body is Notion's handshake and nothing else; null otherwise. Any
 * signature header is ignored: it cannot be checked before the token is known (see the file header).
 */
export function handshakeTokenOf(request: InboundWebhookRequest): string | null {
	try {
		const parsed = HandshakeBodySchema.safeParse(JSON.parse(request.rawBody.toString("utf8")));
		return parsed.success ? parsed.data.verification_token : null;
	} catch {
		return null;
	}
}

/** Whether an event can change what the docs site should show. */
export function warrantsSync(eventType: string | null): boolean {
	return eventType !== null && !IGNORED_EVENTS.has(eventType) && SYNC_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix));
}
