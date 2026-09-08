#!/usr/bin/env node
/**
 * Rejects likely real secrets in tracked `.env.example` files.
 * Placeholders and documented test fixtures are allowed.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXAMPLE_FILES = [
	"apps/api/.env.example",
	"apps/web/.env.example",
	"apps/admin/.env.example",
	"apps/merchant/.env.example",
];

const ALLOWED_PATTERNS = [
	/^change-me-/i,
	/^dev-/i,
	/^e2e-/i,
	/^re_[x]+$/i,
	/^whsec_[x]+$/i,
	/^re_dummy$/i,
	/^you@example\.com$/i,
	/^noreply@example\.com$/i,
	/^postgresql:\/\//i,
	/^redis:\/\//i,
	/^amqp:\/\//i,
	/^http:\/\//i,
	/^https:\/\//i,
	/^\{.*\}$/,
	/^$/,
	/^[0-9]+$/,
	/^(true|false|auto|memory|redis|send|log-only|noop)$/i,
	/^[A-Za-z0-9_./:@,-]+$/,
];

const SUSPICIOUS_KEY_PATTERNS = [/SECRET$/i, /_SECRET_/i, /API_KEY$/i, /WEBHOOK_SECRET$/i, /PASSWORD$/i, /PRIVATE_KEY$/i];

const SUSPICIOUS_VALUE_PATTERNS = [
	/^-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
	/^sk_live_[A-Za-z0-9]+$/,
	/^re_[A-Za-z0-9]{20,}$/,
	/^whsec_[A-Za-z0-9]{16,}$/,
	/^[a-f0-9]{64,}$/i,
];

function isAllowedValue(value) {
	return ALLOWED_PATTERNS.some((pattern) => pattern.test(value));
}

function collectExampleFiles() {
	const found = [];
	for (const relativePath of EXAMPLE_FILES) {
		const absolutePath = path.join(ROOT, relativePath);
		try {
			statSync(absolutePath);
			found.push(absolutePath);
		} catch {
			// Optional app env examples may not exist in every workspace snapshot.
		}
	}
	return found;
}

function scanFile(filePath) {
	const lines = readFileSync(filePath, "utf8").split("\n");
	const violations = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			continue;
		}
		const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
		if (match === null) {
			continue;
		}
		const key = match[1];
		const rawValue = match[2].trim().replace(/^['"]|['"]$/g, "");
		if (rawValue.length === 0) {
			continue;
		}

		const keyLooksSensitive = SUSPICIOUS_KEY_PATTERNS.some((pattern) => pattern.test(key));
		const valueLooksSensitive = SUSPICIOUS_VALUE_PATTERNS.some((pattern) => pattern.test(rawValue));
		if (!keyLooksSensitive && !valueLooksSensitive) {
			continue;
		}
		if (isAllowedValue(rawValue)) {
			continue;
		}

		violations.push(`${path.relative(ROOT, filePath)}:${key}`);
	}

	return violations;
}

const violations = collectExampleFiles().flatMap((filePath) => scanFile(filePath));

if (violations.length > 0) {
	console.error("Secret scan failed — replace likely real credentials with placeholders:");
	for (const violation of violations) {
		console.error(`  - ${violation}`);
	}
	process.exit(1);
}

console.log("Secret scan passed for tracked .env.example files.");
