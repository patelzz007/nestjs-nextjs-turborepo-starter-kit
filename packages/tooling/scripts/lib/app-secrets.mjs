/**
 * Pure logic behind `pnpm secrets:generate` (scripts/generate-app-secrets.mjs):
 * generate the API's locally owned secrets and merge them into an env file's
 * text. No file or process I/O happens here, so every rule is unit-tested
 * (app-secrets.test.mjs).
 *
 * Key handling per variable:
 *   - JWT / email-verification / 2FA-pending signing secrets are REPLACED
 *     (rotation; existing sessions and pending tokens become invalid).
 *   - Versioned key rings (KEY_RINGS: MFA_ENCRYPTION_KEYS, REWARD_CODE_HASH_KEYS)
 *     are APPENDED to: a run adds version max+1 and keeps every existing
 *     version. New material uses the highest version; data written under an
 *     older version (encrypted MFA secrets, hashed reward codes) still resolves
 *     with its own version.
 *   - TENANT_ENCRYPTION_MASTER_KEY wraps every tenant's data key, so it is
 *     write-once: added when missing, never replaced.
 */
import { randomBytes } from "node:crypto";

/** App-owned signing secrets — each value is 128 random bytes, base64. */
export const APP_SECRET_KEYS = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "EMAIL_VERIFICATION_SECRET", "TWO_FACTOR_PENDING_SECRET"];

export const MFA_KEYS_VARIABLE = "MFA_ENCRYPTION_KEYS";
export const REWARD_CODE_HASH_KEYS_VARIABLE = "REWARD_CODE_HASH_KEYS";

/**
 * Every versioned key ring the generator maintains. Adding a ring = one entry
 * here (plus the API's env schema); the merge and the messages handle it.
 * `effect` explains, in the update summary, what the new version changes.
 */
export const KEY_RINGS = [
	{ variable: MFA_KEYS_VARIABLE, effect: "New MFA secrets are encrypted with it; stored ones still decrypt with their own version." },
	{ variable: REWARD_CODE_HASH_KEYS_VARIABLE, effect: "New reward QR tokens / backup codes are hashed with it; existing codes still match under their own version." },
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
 *
 * @param {(size: number) => Buffer} [randomSource] byte source (tests inject a deterministic one)
 * @returns {{ signingSecrets: Record<string, string>, keyRingKeys: Record<string, string>, tenantMasterKey: string }}
 */
export function generateSecretValues(randomSource = randomBytes) {
	const signingSecrets = Object.fromEntries(APP_SECRET_KEYS.map((key) => [key, randomSource(SIGNING_SECRET_BYTES).toString("base64")]));
	const keyRingKeys = Object.fromEntries(KEY_RINGS.map((ring) => [ring.variable, randomSource(AES_256_KEY_BYTES).toString("base64")]));
	return {
		signingSecrets,
		keyRingKeys,
		tenantMasterKey: randomSource(AES_256_KEY_BYTES).toString("base64"),
	};
}

/** Removes one pair of matching surrounding quotes from an env value. */
function unquote(rawValue) {
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
 *
 * @param {string} variable the env variable (for error messages)
 * @param {string} rawValue
 * @returns {Map<number, string>}
 */
export function parseKeyRing(variable, rawValue) {
	const value = unquote(rawValue);
	if (value.length === 0) {
		return new Map();
	}

	let parsed;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error(`${variable} is not valid JSON; fix it by hand (existing keys are never discarded automatically).`);
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${variable} must be a JSON object of {"<version>": "<base64 key>"}.`);
	}

	const ring = new Map();
	for (const [version, key] of Object.entries(parsed)) {
		if (!KEY_RING_VERSION_PATTERN.test(version)) {
			throw new Error(`${variable} has an invalid version "${version}": versions are positive integers.`);
		}
		if (typeof key !== "string" || key.length === 0) {
			throw new Error(`${variable} version ${version} has no key material.`);
		}
		ring.set(Number(version), key);
	}
	return ring;
}

/**
 * Adds `newKey` to the ring as version max+1 (1 for an empty ring), keeping
 * every existing version.
 *
 * @param {Map<number, string>} ring
 * @param {string} newKey
 * @returns {{ serialized: string, addedVersion: number, keptVersions: number[] }}
 */
export function appendKeyRingVersion(ring, newKey) {
	const keptVersions = [...ring.keys()].sort((left, right) => left - right);
	const addedVersion = keptVersions.length === 0 ? FIRST_KEY_RING_VERSION : Math.max(...keptVersions) + 1;
	const entries = [...keptVersions.map((version) => [String(version), ring.get(version)]), [String(addedVersion), newKey]];
	return { serialized: JSON.stringify(Object.fromEntries(entries)), addedVersion, keptVersions };
}

/**
 * The block printed when no env file is given: a complete, fresh set for a
 * NEW env file (every key ring at version 1).
 *
 * @param {ReturnType<typeof generateSecretValues>} values
 * @returns {string}
 */
export function formatFreshEnvBlock(values) {
	return [
		"# --- Generated by: pnpm secrets:generate (signing secrets: 128 random bytes; keys: 32 bytes) ---",
		...APP_SECRET_KEYS.map((key) => `${key}=${values.signingSecrets[key]}`),
		...KEY_RINGS.map((ring) => `${ring.variable}='${appendKeyRingVersion(new Map(), values.keyRingKeys[ring.variable]).serialized}'`),
		`${TENANT_MASTER_KEY}=${values.tenantMasterKey}`,
	].join("\n");
}

/** True for a line that ends a wrapped value: blank, comment, or the next assignment. */
function endsWrappedValue(line) {
	const trimmed = line.trim();
	return trimmed.length === 0 || trimmed.startsWith("#") || ENV_ASSIGNMENT_PATTERN.test(line);
}

/**
 * Merges generated values into the text of an existing env file.
 *
 * @param {string} original env file content
 * @param {ReturnType<typeof generateSecretValues>} values
 * @returns {{ content: string, keyRings: Record<string, { addedVersion: number, keptVersions: number[] }>, tenantMasterKeyAdded: boolean }}
 */
export function mergeSecretsIntoEnv(original, values) {
	const lines = original.split("\n");
	const signingKeys = new Set(APP_SECRET_KEYS);
	const written = new Set();
	const nextLines = [];
	const ringVariables = new Set(KEY_RINGS.map((ring) => ring.variable));
	/** Per key-ring variable: the existing ring and the index of its line (-1 = absent). */
	const rings = new Map(KEY_RINGS.map((ring) => [ring.variable, { ring: new Map(), lineIndex: -1 }]));
	let hasTenantMasterKey = false;
	/** Index (in nextLines) of an EMPTY `TENANT_ENCRYPTION_MASTER_KEY=` line to fill in place. */
	let emptyTenantMasterKeyIndex = -1;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const match = ENV_ASSIGNMENT_PATTERN.exec(line);
		const key = match?.[1];

		if (key === TENANT_MASTER_KEY) {
			if (unquote(match[2]).length > 0) {
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
			rings.set(key, { ring: parseKeyRing(key, match[2]), lineIndex: nextLines.length });
			nextLines.push(line);
		} else {
			nextLines.push(`${key}=${values.signingSecrets[key]}`);
		}
		written.add(key);

		// Drop orphaned continuation lines of an old, line-wrapped openssl value.
		let cursor = index + 1;
		while (cursor < lines.length && !endsWrappedValue(lines[cursor])) {
			cursor += 1;
		}
		index = cursor - 1;
	}

	const keyRings = {};
	for (const { variable } of KEY_RINGS) {
		const existing = rings.get(variable);
		const appended = appendKeyRingVersion(existing.ring, values.keyRingKeys[variable]);
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
			nextLines.push(`${key}=${values.signingSecrets[key]}`);
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

/**
 * Human-readable summary of what a file update changed (no secret values).
 *
 * @param {string} envPath
 * @param {ReturnType<typeof mergeSecretsIntoEnv>} result
 * @returns {string[]}
 */
export function describeUpdate(envPath, result) {
	const ringLines = KEY_RINGS.map(({ variable, effect }) => {
		const { addedVersion, keptVersions } = result.keyRings[variable];
		const kept = keptVersions.length === 0 ? "a new key ring" : `existing versions ${keptVersions.join(", ")} kept`;
		return `- ${variable}: added version ${String(addedVersion)} (${kept}). ${effect}`;
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
