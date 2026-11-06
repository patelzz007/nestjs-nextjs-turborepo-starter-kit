/**
 * Pure logic behind `pnpm tools secrets:generate` (src/app-secrets/cli.ts):
 * generate the API's locally owned secrets and merge them into an env file's
 * text. No file or process I/O happens here, so every rule is unit-tested
 * (app-secrets.test.mjs).
 *
 * Key handling per variable:
 *   - JWT / email-verification / 2FA-pending signing secrets are REPLACED
 *     (rotation; existing sessions and pending tokens become invalid).
 *   - Versioned key rings (KEY_RINGS: MFA_ENCRYPTION_KEYS, REWARD_CODE_HASH_KEYS,
 *     GITHUB_CREDENTIAL_ENCRYPTION_KEYS)
 *     are APPENDED to: a run adds version max+1 and keeps every existing
 *     version. New material uses the highest version; data written under an
 *     older version (encrypted MFA secrets, hashed reward codes) still resolves
 *     with its own version.
 *   - TENANT_ENCRYPTION_MASTER_KEY wraps every tenant's data key, so it is
 *     write-once: added when missing, never replaced.
 */
import { randomBytes } from "node:crypto";

import { z } from "zod";

/** App-owned signing secrets — each value is 128 random bytes, base64. */
export const APP_SECRET_KEYS = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "EMAIL_VERIFICATION_SECRET", "TWO_FACTOR_PENDING_SECRET"];

export const MFA_KEYS_VARIABLE = "MFA_ENCRYPTION_KEYS";
export const REWARD_CODE_HASH_KEYS_VARIABLE = "REWARD_CODE_HASH_KEYS";
export const GITHUB_CREDENTIAL_KEYS_VARIABLE = "GITHUB_CREDENTIAL_ENCRYPTION_KEYS";
export const WEBHOOK_SECRET_KEYS_VARIABLE = "WEBHOOK_SECRET_ENCRYPTION_KEYS";

/**
 * Every versioned key ring the generator maintains. Adding a ring = one entry
 * here (plus the API's env schema); the merge and the messages handle it.
 * `effect` explains, in the update summary, what the new version changes.
 */
export const KEY_RINGS = [
	{ variable: MFA_KEYS_VARIABLE, effect: "New MFA secrets are encrypted with it; stored ones still decrypt with their own version." },
	{ variable: REWARD_CODE_HASH_KEYS_VARIABLE, effect: "New reward QR tokens / backup codes are hashed with it; existing codes still match under their own version." },
	{ variable: GITHUB_CREDENTIAL_KEYS_VARIABLE, effect: "Newly linked GitHub tokens are encrypted with it; linked ones still decrypt with their own version." },
	{ variable: WEBHOOK_SECRET_KEYS_VARIABLE, effect: "New webhook signing secrets are encrypted with it; stored ones still decrypt with their own version." },
];
export const TENANT_MASTER_KEY = "TENANT_ENCRYPTION_MASTER_KEY";

/** Signing-secret length, in random bytes (`openssl rand -base64 128`). */
export const SIGNING_SECRET_BYTES = 128;
/** Key length (bytes) the API validates at boot: the tenant master key and every key-ring version. */
export const AES_256_KEY_BYTES = 32;

/** The first version of a brand-new key ring. */
const FIRST_KEY_RING_VERSION = 1;
/** A key-ring version is a positive integer without leading zeros (the API's parse rule). */
const KEY_RING_VERSION_PATTERN = /^[1-9][0-9]*$/;
const ENV_ASSIGNMENT_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

/**
 * Fresh random values for every generated variable.
 * @param randomSource byte source (tests inject a deterministic one)
 */

export function generateSecretValues(randomSource: (size: number) => Buffer = randomBytes): {
	signingSecrets: Record<string, string>;
	keyRingKeys: Record<string, string>;
	tenantMasterKey: string;
} {
	const signingSecrets = Object.fromEntries(APP_SECRET_KEYS.map((key) => [key, randomSource(SIGNING_SECRET_BYTES).toString("base64")]));
	const keyRingKeys = Object.fromEntries(KEY_RINGS.map((ring) => [ring.variable, randomSource(AES_256_KEY_BYTES).toString("base64")]));
	return {
		signingSecrets,
		keyRingKeys,
		tenantMasterKey: randomSource(AES_256_KEY_BYTES).toString("base64"),
	};
}

/** Removes one pair of matching surrounding quotes from an env value. */
function unquote(rawValue: string): string {
	const value = rawValue.trim();
	const first = value.at(0);
	if (value.length >= 2 && (first === "'" || first === '"') && value.at(-1) === first) {
		return value.slice(1, -1);
	}
	return value;
}

/**
 * Parses an existing key-ring value (e.g. MFA_ENCRYPTION_KEYS) into a ring.
 * An empty value is an empty ring. Anything that is not a JSON object of
 * `"<positive integer>": "<non-empty string>"` throws: overwriting a ring we
 * cannot read would destroy the keys that existing data depends on.
 * @param variable the env variable (for error messages)
 */

/** A key ring's JSON: any object (each key is checked on its own, to name the bad version). */
const KeyRingObjectSchema = z.looseObject({});
const KeyMaterialSchema = z.string().min(1);

export function parseKeyRing(variable: string, rawValue: string): Map<number, string> {
	const value = unquote(rawValue);
	if (value.length === 0) {
		return new Map();
	}

	let parsed: ReturnType<typeof KeyRingObjectSchema.safeParse>;
	try {
		parsed = KeyRingObjectSchema.safeParse(JSON.parse(value));
	} catch {
		throw new Error(`${variable} is not valid JSON; fix it by hand (existing keys are never discarded automatically).`);
	}
	if (!parsed.success) {
		throw new Error(`${variable} must be a JSON object of {"<version>": "<base64 key>"}.`);
	}

	const ring = new Map<number, string>();
	for (const [version, rawKey] of Object.entries(parsed.data)) {
		if (!KEY_RING_VERSION_PATTERN.test(version)) {
			throw new Error(`${variable} has an invalid version "${version}": versions are positive integers.`);
		}
		const key = KeyMaterialSchema.safeParse(rawKey);
		if (!key.success) {
			throw new Error(`${variable} version ${version} has no key material.`);
		}
		ring.set(Number(version), key.data);
	}
	return ring;
}

/**
 * Adds `newKey` to the ring as version max+1 (1 for an empty ring), keeping
 * every existing version.
 */

export function appendKeyRingVersion(ring: Map<number, string>, newKey: string): { serialized: string; addedVersion: number; keptVersions: number[] } {
	const keptVersions = [...ring.keys()].sort((left, right) => left - right);
	const addedVersion = keptVersions.length === 0 ? FIRST_KEY_RING_VERSION : Math.max(...keptVersions) + 1;
	const entries = [...keptVersions.map((version) => [String(version), ring.get(version)]), [String(addedVersion), newKey]];
	return { serialized: JSON.stringify(Object.fromEntries(entries)), addedVersion, keptVersions };
}

/**
 * The block printed when no env file is given: a complete, fresh set for a
 * NEW env file (every key ring at version 1).
 */

function generatedKey(keys: Readonly<Record<string, string>>, variable: string): string {
	const key = keys[variable];
	if (key === undefined) {
		throw new Error(`no key was generated for ${variable}`);
	}
	return key;
}

export function formatFreshEnvBlock(values: ReturnType<typeof generateSecretValues>): string {
	return [
		"# --- Generated by: pnpm tools secrets:generate (signing secrets: 128 random bytes; keys: 32 bytes) ---",
		...APP_SECRET_KEYS.map((key) => `${key}=${generatedKey(values.signingSecrets, key)}`),
		...KEY_RINGS.map((ring) => `${ring.variable}='${appendKeyRingVersion(new Map(), generatedKey(values.keyRingKeys, ring.variable)).serialized}'`),
		`${TENANT_MASTER_KEY}=${values.tenantMasterKey}`,
	].join("\n");
}

/** True for a line that ends a wrapped value: blank, comment, or the next assignment. */
function endsWrappedValue(line: string): boolean {
	const trimmed = line.trim();
	return trimmed.length === 0 || trimmed.startsWith("#") || ENV_ASSIGNMENT_PATTERN.test(line);
}

/**
 * Merges generated values into the text of an existing env file.
 * @param original env file content
 */

export function mergeSecretsIntoEnv(
	original: string,
	values: ReturnType<typeof generateSecretValues>,
): { content: string; keyRings: Record<string, { addedVersion: number; keptVersions: number[] }>; tenantMasterKeyAdded: boolean } {
	const lines = original.split("\n");
	const signingKeys = new Set(APP_SECRET_KEYS);
	const written = new Set<string>();
	const nextLines: string[] = [];
	const ringVariables = new Set(KEY_RINGS.map((ring) => ring.variable));
	/** Per key-ring variable: the existing ring and the index of its line (-1 = absent). */
	const rings = new Map(KEY_RINGS.map((ring): [string, { ring: Map<number, string>; lineIndex: number }] => [ring.variable, { ring: new Map(), lineIndex: -1 }]));
	let hasTenantMasterKey = false;
	/** Index (in nextLines) of an EMPTY `TENANT_ENCRYPTION_MASTER_KEY=` line to fill in place. */
	let emptyTenantMasterKeyIndex = -1;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines.at(index) ?? "";
		const [, key, rawValue = ""] = ENV_ASSIGNMENT_PATTERN.exec(line) ?? [];

		if (key === TENANT_MASTER_KEY) {
			if (unquote(rawValue).length > 0) {
				hasTenantMasterKey = true;
			} else if (emptyTenantMasterKeyIndex === -1) {
				emptyTenantMasterKeyIndex = nextLines.length;
			}
		}
		if (key === undefined || (!signingKeys.has(key) && !ringVariables.has(key))) {
			nextLines.push(line);
			continue;
		}

		if (ringVariables.has(key)) {
			rings.set(key, { ring: parseKeyRing(key, rawValue), lineIndex: nextLines.length });
			nextLines.push(line);
		} else {
			nextLines.push(`${key}=${generatedKey(values.signingSecrets, key)}`);
		}
		written.add(key);

		// Drop orphaned continuation lines of an old, line-wrapped openssl value.
		let cursor = index + 1;
		while (cursor < lines.length && !endsWrappedValue(lines.at(cursor) ?? "")) {
			cursor += 1;
		}
		index = cursor - 1;
	}

	const keyRings: Record<string, { addedVersion: number; keptVersions: number[] }> = {};
	for (const { variable } of KEY_RINGS) {
		const existing = rings.get(variable) ?? { ring: new Map<number, string>(), lineIndex: -1 };
		const appended = appendKeyRingVersion(existing.ring, generatedKey(values.keyRingKeys, variable));
		const ringLine = `${variable}='${appended.serialized}'`;
		if (existing.lineIndex === -1) {
			nextLines.push(ringLine);
		} else {
			nextLines[existing.lineIndex] = ringLine;
		}
		keyRings[variable] = { addedVersion: appended.addedVersion, keptVersions: appended.keptVersions };
	}
	for (const key of APP_SECRET_KEYS) {
		if (!written.has(key)) {
			nextLines.push(`${key}=${generatedKey(values.signingSecrets, key)}`);
		}
	}
	if (!hasTenantMasterKey) {
		const masterKeyLine = `${TENANT_MASTER_KEY}=${values.tenantMasterKey}`;
		if (emptyTenantMasterKeyIndex === -1) {
			nextLines.push(masterKeyLine);
		} else {
			nextLines[emptyTenantMasterKeyIndex] = masterKeyLine;
		}
	}

	return {
		content: `${nextLines.join("\n").replace(/\n*$/, "")}\n`,
		keyRings,
		tenantMasterKeyAdded: !hasTenantMasterKey,
	};
}

/** Human-readable summary of what a file update changed (no secret values). */

export function describeUpdate(envPath: string, result: ReturnType<typeof mergeSecretsIntoEnv>): string[] {
	const ringLines = KEY_RINGS.flatMap(({ variable, effect }) => {
		const ring = result.keyRings[variable];
		if (ring === undefined) {
			return [];
		}
		const { addedVersion, keptVersions } = ring;
		const kept = keptVersions.length === 0 ? "a new key ring" : `existing versions ${keptVersions.join(", ")} kept`;
		return [`- ${variable}: added version ${String(addedVersion)} (${kept}). ${effect}`];
	});
	return [
		`Updated ${envPath}.`,
		`- Rotated ${APP_SECRET_KEYS.join(", ")}: existing sessions and pending email/2FA tokens are invalid — users must sign in again.`,
		...ringLines,
		result.tenantMasterKeyAdded
			? `- ${TENANT_MASTER_KEY}: added (it was missing).`
			: `- ${TENANT_MASTER_KEY}: unchanged (write-once; rotating it would make tenant data unreadable).`,
	];
}
