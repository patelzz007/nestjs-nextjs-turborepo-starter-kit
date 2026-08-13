import type { User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";
import { daysAgo, daysFromNow, generateSeedApiKey, rand, randInt } from "./helpers";

export async function createApiKeys(users: User[]): Promise<void> {
	// NOTE: Keys are NOT deleted here on purpose — volatile cleanup happens at
	// the top of main(), and this function runs AFTER generateAdditionalSeedData()
	// so it must preserve the keys that function just created for extra users.
	// skipDuplicates guards against hash collisions from random key generation.
	// For a full reset, use: npx prisma migrate reset

	const hash = (s: string): Promise<string> => bcrypt.hash(s, 10);
	const get = (email: string) => users.find((u) => u.email === email)!;

	// Track raw keys to display to the tester
	const rawKeyLog: Array<{ email: string; name: string; rawKey: string }> = [];

	const rows: Array<{
		userId: string;
		name: string;
		keyHash: string;
		keyPrefix: string;
		scopes: string[];
		rateLimitTier: string;
		isActive: boolean;
		expiresAt?: Date;
	}> = [];

	// Helper: generate a key row using random key + log the raw key for display
	const addKey = async (email: string, name: string, scopes: string[], tier: string, active: boolean, expiresAt?: Date) => {
		const { rawKey, keyPrefix } = generateSeedApiKey();
		const keyHash = await hash(rawKey);
		rows.push({
			userId: get(email).id,
			name,
			keyHash,
			keyPrefix,
			scopes,
			rateLimitTier: tier,
			isActive: active,
			expiresAt,
		});
		rawKeyLog.push({ email, name, rawKey });
	};

	// ── SuperAdmin ────────────────────────────────────────────────────────
	await addKey("superadmin@example.com", "SuperAdmin — Full Access", ["read", "write", "delete"], "enterprise", true);
	// ── Admin ─────────────────────────────────────────────────────────────
	await addKey("admin@example.com", "Admin — Internal Key", ["read", "write", "delete"], "enterprise", true);
	await addKey("admin@example.com", "Admin — Deprecated Key", ["read"], "enterprise", false, daysAgo(30));
	// ── Manager ───────────────────────────────────────────────────────────
	await addKey("manager@example.com", "Manager — Team API", ["read", "write"], "pro", true);
	// ── Regular User ──────────────────────────────────────────────────────
	await addKey("user@example.com", "User — Personal Key", ["read"], "standard", true);
	// ── Alice ─────────────────────────────────────────────────────────────
	await addKey("alice.johnson@example.com", "Alice — Production", ["read", "write"], "pro", true);
	await addKey("alice.johnson@example.com", "Alice — CI/CD", ["read"], "pro", true, daysFromNow(90));
	// ── Bob ───────────────────────────────────────────────────────────────
	await addKey("bob.smith@example.com", "Bob — Personal", ["read"], "standard", true);
	// ── Carol ─────────────────────────────────────────────────────────────
	await addKey("carol.white@example.com", "Carol — Blog API", ["read"], "standard", true);
	// ── David ─────────────────────────────────────────────────────────────
	await addKey("david.lee@example.com", "David — OSS Toolkit", ["read", "write"], "pro", true);
	// ── Frank ─────────────────────────────────────────────────────────────
	await addKey("frank.miller@example.com", "Frank — Internal Services", ["read", "write", "delete"], "enterprise", true);
	await addKey("frank.miller@example.com", "Frank — Monitoring Bot", ["read"], "enterprise", true);
	// ── Grace ─────────────────────────────────────────────────────────────
	await addKey("grace.wilson@example.com", "Grace — Art Portfolio", ["read"], "standard", true);
	// ── Henry ─────────────────────────────────────────────────────────────
	await addKey("henry.moore@example.com", "Henry — Research Scripts", ["read"], "standard", true);
	// ── Isla ──────────────────────────────────────────────────────────────
	await addKey("isla.taylor@example.com", "Isla — Travel API", ["read"], "standard", true);
	// ── Jack ──────────────────────────────────────────────────────────────
	await addKey("jack.anderson@example.com", "Jack — SaaS Backend", ["read", "write"], "pro", true);
	await addKey("jack.anderson@example.com", "Jack — Analytics Worker", ["read"], "pro", true);

	await prisma.apiKey.createMany({ data: rows, skipDuplicates: true });

	// ── Display generated keys so testers can use them ─────────────────────
	console.log("");
	console.log("  📋 Generated API Keys (use these for testing):");
	console.log("  ─────────────────────────────────────────────────────────");
	for (const entry of rawKeyLog) {
		console.log(`  ${entry.email.padEnd(35)} ${entry.rawKey}`);
	}
	console.log("");
}

export async function createApiKeyUsageLogs(): Promise<void> {
	const apiKeys = await prisma.apiKey.findMany({
		where: { isActive: true },
		select: { id: true },
	});

	if (apiKeys.length === 0) return;

	type UsageRow = {
		apiKeyId: string;
		endpoint: string;
		method: string;
		statusCode: number;
		ipAddress: string;
		userAgent: string;
		responseTimeMs: number;
		createdAt: Date;
	};

	const ip = () => `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
	const ENDPOINTS = ["/api/v1/urls", "/api/v1/urls/ali-gh", "/api/v1/tags", "/api/v1/analytics", "/api/v1/api-keys"];
	const METHODS = ["GET", "POST", "PATCH", "DELETE"];
	const AGENTS = ["axios/1.7.0", "curl/8.4.0", "PostmanRuntime/7.36.0", "python-requests/2.31.0", "okhttp/4.12.0"];
	const STATUSES = [200, 200, 200, 200, 201, 200, 200, 200, 404, 200, 200, 200, 200, 401, 200];

	const rows: UsageRow[] = [];

	for (const key of apiKeys) {
		// Generate 10-25 random usage log entries per key over the last 30 days
		const entryCount = randInt(10, 25);
		for (let i = 0; i < entryCount; i++) {
			rows.push({
				apiKeyId: key.id,
				endpoint: rand(ENDPOINTS),
				method: rand(METHODS),
				statusCode: rand(STATUSES),
				ipAddress: ip(),
				userAgent: rand(AGENTS),
				responseTimeMs: randInt(15, 450),
				createdAt: daysAgo(randInt(1, 30)),
			});
		}
	}

	// Insert in batches of 50
	const BATCH = 50;
	for (let i = 0; i < rows.length; i += BATCH) {
		await prisma.apiKeyUsageLog.createMany({
			data: rows.slice(i, i + BATCH),
			skipDuplicates: true,
		});
	}
}
