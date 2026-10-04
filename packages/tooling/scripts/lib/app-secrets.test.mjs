import { describe, expect, it } from "vitest";

import {
	AES_256_KEY_BYTES,
	APP_SECRET_KEYS,
	KEY_RINGS,
	MFA_KEYS_VARIABLE,
	REWARD_CODE_HASH_KEYS_VARIABLE,
	SIGNING_SECRET_BYTES,
	TENANT_MASTER_KEY,
	appendKeyRingVersion,
	describeUpdate,
	formatFreshEnvBlock,
	generateSecretValues,
	mergeSecretsIntoEnv,
	parseKeyRing,
} from "./app-secrets.mjs";

/** Deterministic byte source: every call returns `size` bytes of an incrementing fill value. */
function sequentialRandomSource() {
	let fill = 0;
	return (size) => {
		fill += 1;
		return Buffer.alloc(size, fill);
	};
}

const OLD_MFA_KEY_V1 = Buffer.alloc(AES_256_KEY_BYTES, 0xa1).toString("base64");
const OLD_MFA_KEY_V2 = Buffer.alloc(AES_256_KEY_BYTES, 0xa2).toString("base64");

function fixedValues() {
	return generateSecretValues(sequentialRandomSource());
}

/** Reads one variable's raw value back out of env file text. */
function envValue(content, key) {
	const line = content.split("\n").find((candidate) => candidate.startsWith(`${key}=`));
	return line?.slice(key.length + 1);
}

describe("generateSecretValues", () => {
	it("draws 128-byte signing secrets and 32-byte AES keys", () => {
		const values = generateSecretValues(sequentialRandomSource());
		for (const key of APP_SECRET_KEYS) {
			expect(Buffer.from(values.signingSecrets[key], "base64")).toHaveLength(SIGNING_SECRET_BYTES);
		}
		for (const { variable } of KEY_RINGS) {
			expect(Buffer.from(values.keyRingKeys[variable], "base64")).toHaveLength(AES_256_KEY_BYTES);
		}
		expect(Buffer.from(values.tenantMasterKey, "base64")).toHaveLength(AES_256_KEY_BYTES);
	});
});

describe("parseKeyRing", () => {
	it("reads single-quoted, double-quoted and bare JSON rings", () => {
		const json = JSON.stringify({ 1: OLD_MFA_KEY_V1, 2: OLD_MFA_KEY_V2 });
		for (const raw of [`'${json}'`, `"${json}"`, json]) {
			expect([...parseKeyRing(MFA_KEYS_VARIABLE, raw).entries()]).toEqual([
				[1, OLD_MFA_KEY_V1],
				[2, OLD_MFA_KEY_V2],
			]);
		}
	});

	it("treats an empty value as an empty ring", () => {
		expect(parseKeyRing(MFA_KEYS_VARIABLE, "").size).toBe(0);
		expect(parseKeyRing(MFA_KEYS_VARIABLE, "''").size).toBe(0);
	});

	it.each([
		["invalid JSON", "{not json", /not valid JSON/],
		["a JSON array", "[]", /JSON object/],
		["a non-integer version", JSON.stringify({ v1: OLD_MFA_KEY_V1 }), /invalid version "v1"/],
		["a zero version", JSON.stringify({ 0: OLD_MFA_KEY_V1 }), /invalid version "0"/],
		["an empty key", JSON.stringify({ 1: "" }), /version 1 has no key material/],
	])("refuses %s instead of overwriting it", (_case, raw, expected) => {
		expect(() => parseKeyRing(MFA_KEYS_VARIABLE, raw)).toThrow(expected);
	});
});

describe("appendKeyRingVersion", () => {
	it("starts a new ring at version 1", () => {
		expect(appendKeyRingVersion(new Map(), "new")).toEqual({ serialized: JSON.stringify({ 1: "new" }), addedVersion: 1, keptVersions: [] });
	});

	it("adds max+1 and keeps every existing version, including gaps", () => {
		const ring = new Map([
			[3, "three"],
			[1, "one"],
		]);
		expect(appendKeyRingVersion(ring, "new")).toEqual({
			serialized: JSON.stringify({ 1: "one", 3: "three", 4: "new" }),
			addedVersion: 4,
			keptVersions: [1, 3],
		});
	});
});

describe("mergeSecretsIntoEnv", () => {
	it("appends a new MFA key version and never drops the old ones", () => {
		const original = [`PORT=8080`, `${MFA_KEYS_VARIABLE}='${JSON.stringify({ 1: OLD_MFA_KEY_V1, 2: OLD_MFA_KEY_V2 })}'`, ""].join("\n");
		const values = fixedValues();

		const result = mergeSecretsIntoEnv(original, values);

		expect(envValue(result.content, MFA_KEYS_VARIABLE)).toBe(`'${JSON.stringify({ 1: OLD_MFA_KEY_V1, 2: OLD_MFA_KEY_V2, 3: values.keyRingKeys[MFA_KEYS_VARIABLE] })}'`);
		expect(result.keyRings[MFA_KEYS_VARIABLE]).toEqual({ addedVersion: 3, keptVersions: [1, 2] });
		expect(result.content.startsWith("PORT=8080\n")).toBe(true);
	});

	it("creates the MFA ring at version 1 when the variable is missing or empty", () => {
		const values = fixedValues();
		for (const original of ["PORT=8080\n", `${MFA_KEYS_VARIABLE}=\n`]) {
			const result = mergeSecretsIntoEnv(original, values);
			expect(envValue(result.content, MFA_KEYS_VARIABLE)).toBe(`'${JSON.stringify({ 1: values.keyRingKeys[MFA_KEYS_VARIABLE] })}'`);
			expect(result.keyRings[MFA_KEYS_VARIABLE].addedVersion).toBe(1);
		}
	});

	it("leaves the file untouched (throws) when the existing MFA ring is unreadable", () => {
		expect(() => mergeSecretsIntoEnv(`${MFA_KEYS_VARIABLE}=garbage\n`, fixedValues())).toThrow(/not valid JSON/);
	});

	it("rotates the signing secrets in place and drops wrapped continuation lines", () => {
		const original = ["JWT_ACCESS_SECRET=old-first-half", "old-second-half", "JWT_REFRESH_SECRET=old", "# comment", ""].join("\n");
		const values = fixedValues();

		const { content } = mergeSecretsIntoEnv(original, values);

		expect(envValue(content, "JWT_ACCESS_SECRET")).toBe(values.signingSecrets.JWT_ACCESS_SECRET);
		expect(envValue(content, "JWT_REFRESH_SECRET")).toBe(values.signingSecrets.JWT_REFRESH_SECRET);
		expect(content).not.toContain("old-second-half");
		expect(content).toContain("# comment");
		// Missing signing secrets are appended.
		expect(envValue(content, "EMAIL_VERIFICATION_SECRET")).toBe(values.signingSecrets.EMAIL_VERIFICATION_SECRET);
		expect(envValue(content, "TWO_FACTOR_PENDING_SECRET")).toBe(values.signingSecrets.TWO_FACTOR_PENDING_SECRET);
	});

	it("never replaces an existing tenant master key, and adds one when missing", () => {
		const values = fixedValues();
		const kept = mergeSecretsIntoEnv(`${TENANT_MASTER_KEY}=existing-master\n`, values);
		expect(envValue(kept.content, TENANT_MASTER_KEY)).toBe("existing-master");
		expect(kept.tenantMasterKeyAdded).toBe(false);

		for (const original of ["PORT=1\n", `${TENANT_MASTER_KEY}=\n`]) {
			const added = mergeSecretsIntoEnv(original, values);
			// Filled in place: exactly one assignment, carrying the new key.
			expect(added.content.split("\n").filter((line) => line.startsWith(`${TENANT_MASTER_KEY}=`))).toEqual([`${TENANT_MASTER_KEY}=${values.tenantMasterKey}`]);
			expect(added.tenantMasterKeyAdded).toBe(true);
		}
	});

	it("is a fixed point for line count on a second run (no duplicate keys)", () => {
		const first = mergeSecretsIntoEnv("PORT=1\n", fixedValues());
		const second = mergeSecretsIntoEnv(first.content, generateSecretValues(sequentialRandomSource()));
		expect(second.content.split("\n")).toHaveLength(first.content.split("\n").length);
		expect(second.keyRings[MFA_KEYS_VARIABLE]).toEqual({ addedVersion: 2, keptVersions: [1] });
		expect(second.keyRings[REWARD_CODE_HASH_KEYS_VARIABLE]).toEqual({ addedVersion: 2, keptVersions: [1] });
	});
});

describe("reward code hash key ring", () => {
	it("is maintained like the MFA ring: appended to, never replaced", () => {
		const values = fixedValues();
		const original = `${REWARD_CODE_HASH_KEYS_VARIABLE}='${JSON.stringify({ 1: OLD_MFA_KEY_V1 })}'\n`;
		const result = mergeSecretsIntoEnv(original, values);
		expect(envValue(result.content, REWARD_CODE_HASH_KEYS_VARIABLE)).toBe(`'${JSON.stringify({ 1: OLD_MFA_KEY_V1, 2: values.keyRingKeys[REWARD_CODE_HASH_KEYS_VARIABLE] })}'`);
		expect(() => mergeSecretsIntoEnv(`${REWARD_CODE_HASH_KEYS_VARIABLE}=garbage\n`, values)).toThrow(/REWARD_CODE_HASH_KEYS is not valid JSON/);
	});
});

describe("messages", () => {
	it("prints a fresh block with a version-1 ring and every variable", () => {
		const values = fixedValues();
		const block = formatFreshEnvBlock(values);
		for (const key of [...APP_SECRET_KEYS, MFA_KEYS_VARIABLE, REWARD_CODE_HASH_KEYS_VARIABLE, TENANT_MASTER_KEY]) {
			expect(block).toContain(`${key}=`);
		}
		expect(block).toContain(`${MFA_KEYS_VARIABLE}='${JSON.stringify({ 1: values.keyRingKeys[MFA_KEYS_VARIABLE] })}'`);
	});

	it("describes the MFA version added and kept, without printing secret values", () => {
		const values = fixedValues();
		const result = mergeSecretsIntoEnv(`${MFA_KEYS_VARIABLE}='${JSON.stringify({ 1: OLD_MFA_KEY_V1 })}'\n${TENANT_MASTER_KEY}=x\n`, values);
		const text = describeUpdate("apps/api/.env", result).join("\n");

		expect(text).toContain("added version 2 (existing versions 1 kept)");
		expect(text).toContain(`${TENANT_MASTER_KEY}: unchanged`);
		expect(text).not.toContain(values.keyRingKeys[MFA_KEYS_VARIABLE]);
		expect(text).not.toContain(OLD_MFA_KEY_V1);
	});
});
