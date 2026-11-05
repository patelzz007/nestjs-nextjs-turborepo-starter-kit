import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ConfiguredPaymentProviders } from "../payment-providers.registry";
import { scriptedHttp } from "./provider-fakes";

const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const BILLPLZ = { apiKey: "key", collectionId: "col_1", xSignatureKey: "x-signature-key", sandbox: true };
const CHIP = { secretKey: "secret", brandId: "brand-1", publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) };

describe("ConfiguredPaymentProviders", () => {
	it("builds only the gateways that are configured, and names them in a stable order", () => {
		const { http } = scriptedHttp([]);
		const none = new ConfiguredPaymentProviders({ billplz: null, chip: null, fakeSecret: null }, http);
		expect(none.configured()).toStrictEqual([]);
		expect(none.get("BILLPLZ")).toBeNull();

		const all = new ConfiguredPaymentProviders({ billplz: BILLPLZ, chip: CHIP, fakeSecret: "fake-secret" }, http);
		expect(all.configured()).toStrictEqual(["BILLPLZ", "CHIP", "FAKE"]);
		expect(all.get("CHIP")?.name).toBe("CHIP");

		const chipOnly = new ConfiguredPaymentProviders({ billplz: null, chip: CHIP, fakeSecret: null }, http);
		expect(chipOnly.configured()).toStrictEqual(["CHIP"]);
		expect(chipOnly.get("FAKE")).toBeNull();
	});
});
