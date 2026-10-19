import { createHash } from "node:crypto";

import { epochMs, type RedemptionCheckoutInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { RewardCodeHasher } from "../../../../platform/infrastructure/crypto/reward-code-hasher";
import { SaleCheckedOut } from "../../domain/events/pos.events";
import { API_KEY_PREFIX_LENGTH } from "../../domain/value-objects/api-key-format.value-object";
import { Sha256CheckoutFingerprint } from "../adapters/checkout-fingerprint.adapter";
import { PosCredentialsAdapter } from "../adapters/pos-credentials.adapter";
import { PosIntegrationEventsMapper } from "../outbox/pos-integration-events.mapper";

const NOW = epochMs(1_792_195_200_000);
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const SALE_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const STORE_ID = "55555555-5555-4555-8555-555555555555";
const CLAIM_IDS = ["66666666-6666-4666-8666-666666666666", "77777777-7777-4777-8777-777777777777"];
/** A 32-byte hasher key, as the key ring stores it. */
const KEY = Buffer.alloc(32, 7).toString("base64");

describe("Sha256CheckoutFingerprint", () => {
	const input: RedemptionCheckoutInput = { billTotalMinor: 5_000, currency: "MYR", idempotencyKey: "idem-1", codes: [{ token: "qr-token" }, { backupCode: "AB23CD45" }] };

	it("hashes the canonical bill and codes exactly as the stored sales were hashed (retries must replay)", () => {
		const canonical = JSON.stringify({
			billTotalMinor: 5_000,
			currency: "MYR",
			codes: [
				{ token: "qr-token", backupCode: null },
				{ token: null, backupCode: "AB23CD45" },
			],
		});

		expect(new Sha256CheckoutFingerprint().of(input)).toBe(createHash("sha256").update(canonical).digest("hex"));
	});

	it("ignores the idempotency key and tells another bill or code apart", () => {
		const fingerprint = new Sha256CheckoutFingerprint();

		expect(fingerprint.of({ ...input, idempotencyKey: "idem-2" })).toBe(fingerprint.of(input));
		expect(fingerprint.of({ ...input, billTotalMinor: 5_001 })).not.toBe(fingerprint.of(input));
		expect(fingerprint.of({ ...input, codes: [{ token: "qr-token" }] })).not.toBe(fingerprint.of(input));
	});
});

describe("PosCredentialsAdapter", () => {
	const hasher = new RewardCodeHasher({ 1: KEY });
	const credentials = new PosCredentialsAdapter(hasher);

	it("issues pairing codes stored as keyed hashes, found again by their lookup candidates", () => {
		const { code, hash } = credentials.newPairingCode();

		expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/u);
		expect(hash).toBe(hasher.hash(code));
		expect(credentials.pairingCodeLookups(code)).toContain(hash);
	});

	it("generates terminal ids with the TERM- prefix", () => {
		expect(credentials.newTerminalId()).toMatch(/^TERM-[A-HJ-NP-Z2-9]{8}$/u);
	});

	it("mints mk_live_ keys stored as sha256, with the column-width display prefix", () => {
		const key = credentials.newApiKey();

		expect(key.plaintext.startsWith("mk_live_")).toBe(true);
		expect(key.hash).toBe(createHash("sha256").update(key.plaintext).digest("hex"));
		expect(key.prefix).toBe(key.plaintext.slice(0, API_KEY_PREFIX_LENGTH));
		expect(credentials.newApiKey().plaintext).not.toBe(key.plaintext);
	});
});

describe("PosIntegrationEventsMapper", () => {
	it("feeds every paid bill to the analytics stream as merchant.redeem_reward, byte-compatible with the legacy payload", () => {
		const event = new SaleCheckedOut(NOW, SALE_ID, ORGANIZATION_ID, CUSTOMER_ID, STORE_ID, "TERM-AAAA2222", 5_000, "MYR", CLAIM_IDS);

		expect(new PosIntegrationEventsMapper().map(event)).toEqual({
			type: "reward.platform",
			payload: {
				event: "merchant.redeem_reward",
				actorUserId: null,
				organizationId: ORGANIZATION_ID,
				metadata: {
					saleId: SALE_ID,
					customerUserId: CUSTOMER_ID,
					locationId: STORE_ID,
					terminalId: "TERM-AAAA2222",
					billTotalMinor: 5_000,
					currency: "MYR",
					claimIds: CLAIM_IDS,
				},
			},
		});
	});

	it("maps nothing else", () => {
		expect(new PosIntegrationEventsMapper().map({ eventName: "other", occurredAt: NOW })).toBeNull();
	});
});
