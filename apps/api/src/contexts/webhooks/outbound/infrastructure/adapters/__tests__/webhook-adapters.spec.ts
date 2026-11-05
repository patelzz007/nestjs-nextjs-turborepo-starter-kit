import { WEBHOOK_DELIVERY_ERROR_MAX_LENGTH, WEBHOOK_SECRET_HINT_LENGTH, WEBHOOK_SECRET_PREFIX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../../../test/support/test-api-env";
import { WebhooksNotConfiguredError } from "../../../domain/errors/webhooks.errors";
import { sendOutcomeOf } from "../guarded-webhook-sender";
import { WebhookIdsAdapter } from "../webhook-ids.adapter";
import { WebhookSecretCipher, WebhookSecretUnreadableError } from "../webhook-secret.cipher";
import { WebhookUrlPolicyAdapter } from "../webhook-url-policy.adapter";

// 32 bytes of 0x06 / 0x07, base64 — TEST-ONLY key versions.
const KEY_V1 = "BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY=";
const KEY_V2 = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";
const ENDPOINT_A = "0193f2c4-0000-7000-8000-0000000e0001";
const ENDPOINT_B = "0193f2c4-0000-7000-8000-0000000e0002";
/** A fixed moment the id test pins the clock to. */
const WEBHOOK_ID_TIME_MS = Date.parse("2026-11-05T09:00:00.000Z");
/** RFC 9562 version 7: the 13th hex digit is 7, the variant's first digit 8–b. */
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function cipher(keys: Record<string, string> | null): WebhookSecretCipher {
	return new WebhookSecretCipher(createTestTypedConfig(keys === null ? { WEBHOOK_SECRET_ENCRYPTION_KEYS: "" } : { WEBHOOK_SECRET_ENCRYPTION_KEYS: JSON.stringify(keys) }));
}

describe("WebhookSecretCipher", () => {
	it("is off without a key ring", () => {
		const off = cipher(null);

		expect(off.isConfigured()).toBe(false);
		expect(() => off.create(ENDPOINT_A)).toThrow(WebhooksNotConfiguredError);
	});

	it("creates a prefixed secret, seals it under the newest key and opens it again", () => {
		const ring = cipher({ 1: KEY_V1, 2: KEY_V2 });
		const secret = ring.create(ENDPOINT_A);

		expect(secret.plaintext.startsWith(WEBHOOK_SECRET_PREFIX)).toBe(true);
		expect(secret.sealed.hint).toBe(secret.plaintext.slice(-WEBHOOK_SECRET_HINT_LENGTH));
		expect(secret.sealed.ciphertext.startsWith("2:")).toBe(true);
		expect(secret.sealed.ciphertext).not.toContain(secret.plaintext);
		expect(ring.open(secret.sealed.ciphertext, ENDPOINT_A)).toBe(secret.plaintext);
	});

	it("still opens a secret sealed under an older key after the ring gains one", () => {
		const sealed = cipher({ 1: KEY_V1 }).create(ENDPOINT_A);

		expect(cipher({ 1: KEY_V1, 2: KEY_V2 }).open(sealed.sealed.ciphertext, ENDPOINT_A)).toBe(sealed.plaintext);
	});

	it("does not open a secret copied onto another endpoint", () => {
		const ring = cipher({ 1: KEY_V1 });

		expect(() => ring.open(ring.create(ENDPOINT_A).sealed.ciphertext, ENDPOINT_B)).toThrow();
	});

	it("refuses a value that is not a sealed secret, or a key version it no longer has", () => {
		const ring = cipher({ 1: KEY_V1 });

		expect(() => ring.open("not sealed", ENDPOINT_A)).toThrow(WebhookSecretUnreadableError);
		const sealed = cipher({ 2: KEY_V2 }).create(ENDPOINT_A);
		expect(() => ring.open(sealed.sealed.ciphertext, ENDPOINT_A)).toThrow(WebhookSecretUnreadableError);
	});

	it("never creates the same secret twice", () => {
		const ring = cipher({ 1: KEY_V1 });

		expect(ring.create(ENDPOINT_A).plaintext).not.toBe(ring.create(ENDPOINT_A).plaintext);
	});
});

describe("sendOutcomeOf", () => {
	it("counts only a 2xx answer as delivered", () => {
		expect(sendOutcomeOf({ kind: "answered", status: 204, bodyExcerpt: "", durationMs: 5 })).toEqual({ succeeded: true, statusCode: 204, error: null, durationMs: 5 });
		expect(sendOutcomeOf({ kind: "answered", status: 301, bodyExcerpt: "", durationMs: 5 })).toMatchObject({ succeeded: false, statusCode: 301, error: "HTTP 301" });
	});

	it("keeps a little of a refusal's body, cut to the column's length", () => {
		const outcome = sendOutcomeOf({ kind: "answered", status: 500, bodyExcerpt: "x".repeat(WEBHOOK_DELIVERY_ERROR_MAX_LENGTH), durationMs: 5 });

		expect(outcome.error?.startsWith("HTTP 500: x")).toBe(true);
		expect(outcome.error).toHaveLength(WEBHOOK_DELIVERY_ERROR_MAX_LENGTH);
	});

	it("records no status when the endpoint never answered", () => {
		expect(sendOutcomeOf({ kind: "timed_out", message: "No answer within 10000 ms", durationMs: 10_000 })).toEqual({
			succeeded: false,
			statusCode: null,
			error: "No answer within 10000 ms",
			durationMs: 10_000,
		});
		expect(sendOutcomeOf({ kind: "refused", reason: "address_not_allowed", message: "private address", durationMs: 1 }).statusCode).toBeNull();
	});
});

describe("WebhookUrlPolicyAdapter", () => {
	it("allows a public HTTPS address and refuses a private one, saying why", () => {
		const policy = new WebhookUrlPolicyAdapter(createTestTypedConfig({ WEBHOOK_ALLOW_LOOPBACK_URLS: "false" }));

		expect(policy.check("https://hooks.example.com/in")).toEqual({ ok: true });
		const refused = policy.check("https://10.0.0.5/in");
		expect(refused.ok).toBe(false);
		expect(refused.ok ? null : refused.reason).toBe("address_not_allowed");
	});

	it("allows localhost only where the deployment says so", () => {
		const local = new WebhookUrlPolicyAdapter(createTestTypedConfig({ WEBHOOK_ALLOW_LOOPBACK_URLS: "true" }));
		const strict = new WebhookUrlPolicyAdapter(createTestTypedConfig({ WEBHOOK_ALLOW_LOOPBACK_URLS: "false" }));

		expect(local.check("http://localhost:4000/webhooks")).toEqual({ ok: true });
		expect(strict.check("http://localhost:4000/webhooks").ok).toBe(false);
	});
});

describe("WebhookIdsAdapter", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("hands out distinct version-7 UUIDs, ordered by the millisecond they were made in", () => {
		// UUIDv7 orders by millisecond only: two ids of one millisecond differ in random bits, in either order.
		vi.useFakeTimers({ now: WEBHOOK_ID_TIME_MS, toFake: ["Date"] });
		const ids = new WebhookIdsAdapter();
		const first = ids.next();
		const sameMillisecond = ids.next();
		vi.setSystemTime(WEBHOOK_ID_TIME_MS + 1);
		const later = ids.next();

		expect(new Set([first, sameMillisecond, later]).size).toBe(3);
		expect([first, sameMillisecond, later].every((id: string): boolean => UUID_V7_PATTERN.test(id))).toBe(true);
		expect(first < later && sameMillisecond < later).toBe(true);
	});
});
