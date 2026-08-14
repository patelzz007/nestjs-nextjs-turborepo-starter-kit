import type { DeviceType, Plan, Role, Tag, Url, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";
import { BROWSERS, CITIES, COUNTRIES, DEVICES, OSS, REFERRERS, UTM_MEDIUMS, UTM_SOURCES, cycle, daysAgo, daysFromNow, generateSeedApiKey, rand, randInt } from "./helpers";

// Additional Seed Data (20 extra users with URLs, tags, clicks, and API keys)
export async function generateAdditionalSeedData(roles: Role[], userRole: Role): Promise<User[]> {
	const hash = (pw: string): Promise<string> => bcrypt.hash(pw, 10);
	const defaultPassword = await hash("User@123");

	const PLANS: Plan[] = ["FREE", "PRO"];
	const NAMES = [
		"Liam Smith",
		"Olivia Johnson",
		"Noah Davis",
		"Emma Brown",
		"Oliver Wilson",
		"Ava Taylor",
		"William Anderson",
		"Sophie Thomas",
		"James Jackson",
		"Mia White",
		"Benjamin Harris",
		"Charlotte Martin",
		"Lucas Thompson",
		"Amelia Garcia",
		"Henry Martinez",
		"Harper Robinson",
		"Alexander Clark",
		"Evelyn Rodriguez",
		"Daniel Lewis",
		"Abigail Lee",
	];

	const createdUsers: User[] = [];
	const urlList: Url[] = [];
	const tagList: Tag[] = [];
	const apiKeyRows: Array<{
		userId: string;
		name: string;
		keyHash: string;
		keyPrefix: string;
		scopes: string[];
		rateLimitTier: string;
		isActive: boolean;
		expiresAt?: number;
	}> = [];
	const rawKeyLog: Array<{ email: string; rawKey: string }> = [];

	for (const [i, name] of NAMES.entries()) {
		const email = `user-${String(i + 1).padStart(2, "0")}@example.com`;
		const plan = rand(PLANS);
		const isActive = i < 17; // 3 inactive users

		const fullName = name;
		const u = await prisma.user.upsert({
			where: { email },
			update: { fullName, isActive, plan },
			create: {
				email,
				passwordHash: defaultPassword,
				fullName,
				isActive,
				isSuperAdmin: false,
				plan,
				monthlyUrlLimit: plan === "PRO" ? 500 : 50,
				monthlyClickLimit: plan === "PRO" ? 100_000 : 10_000,
			},
		});
		createdUsers.push(u);

		// Assign User role
		await prisma.userRole.upsert({
			where: { userId_roleId: { userId: u.id, roleId: userRole.id } },
			update: {},
			create: { userId: u.id, roleId: userRole.id },
		});

		// Create refresh tokens (2 per user)
		await prisma.refreshToken.createMany({
			data: [
				{
					userId: u.id,
					token: `rt_${u.id}_d_${Date.now()}`,
					deviceInfo: "Chrome on Windows",
					ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
					expiresAt: daysFromNow(7),
				},
				{
					userId: u.id,
					token: `rt_${u.id}_m_${Date.now() + 1}`,
					deviceInfo: "Safari on iOS",
					ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
					expiresAt: daysFromNow(30),
				},
			],
		});

		// Create 3-6 tags per user
		const tagNames = randInt(3, 6);
		const tagColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#14b8a6", "#f43f5e", "#22c55e", "#0ea5e9"];
		const userTags: Tag[] = [];
		for (let t = 0; t < tagNames; t++) {
			const tag = await prisma.tag.upsert({
				where: { userId_name: { userId: u.id, name: `tag-${i + 1}-${t}` } },
				update: {},
				create: {
					userId: u.id,
					name: `tag-${i + 1}-${t}`,
					color: rand(tagColors),
				},
			});
			userTags.push(tag);
		}
		tagList.push(...userTags);

		// Create 12-18 URLs per user
		const urlCount = randInt(12, 18);
		for (let uIdx = 0; uIdx < urlCount; uIdx++) {
			const shortCode = `usr${i + 1}-${uIdx}`;
			const url = await prisma.url.upsert({
				where: { shortCode },
				update: {},
				create: {
					userId: u.id,
					shortCode,
					originalUrl: `https://example.com/user-${i + 1}/${uIdx}`,
					title: `User ${i + 1} — URL ${uIdx + 1}`,
					redirectType: "TEMPORARY",
					isActive: true,
					clickCount: randInt(0, 500),
					expiresAt: Math.random() > 0.8 ? daysFromNow(randInt(30, 90)) : undefined,
				},
			});
			urlList.push(url);

			// Link URL to a random tag
			if (userTags.length > 0) {
				const randomTag = rand(userTags);
				await prisma.urlTag
					.upsert({
						where: { urlId_tagId: { urlId: url.id, tagId: randomTag.id } },
						update: {},
						create: { urlId: url.id, tagId: randomTag.id },
					})
					.catch(() => {});
			}
		}

		// Generate 15-20 API keys per user with varied criteria
		const apiKeyCount = randInt(15, 20);
		const baseTier = plan === "PRO" ? "pro" : "standard";
		const allTiers: string[] = ["standard", "pro", "enterprise"];
		const allScopeSets: string[][] = [["read"], ["read", "write"], ["read", "write", "delete"]];
		for (let k = 0; k < apiKeyCount; k++) {
			const { rawKey, keyPrefix } = generateSeedApiKey();
			const keyHash = await bcrypt.hash(rawKey, 10);
			const scopes: string[] = cycle(allScopeSets, k);
			const tier = k < 5 ? baseTier : cycle(allTiers, k);
			const active = k < 12 ? isActive : false; // last few are inactive
			const hasExpiry = k >= 10 && k < 14;
			const name =
				k % 4 === 0
					? `${fullName.split(" ")[0]} — API Key ${k + 1}`
					: k % 4 === 1
						? `${fullName.split(" ")[0]} — Read-Only ${k + 1}`
						: k % 4 === 2
							? `${fullName.split(" ")[0]} — Full Access ${k + 1}`
							: `${fullName.split(" ")[0]} — Dev Key ${k + 1}`;
			apiKeyRows.push({
				userId: u.id,
				name,
				keyHash,
				keyPrefix,
				scopes,
				rateLimitTier: tier,
				isActive: active,
				expiresAt: hasExpiry ? daysFromNow(randInt(15, 90)) : undefined,
			});
			rawKeyLog.push({ email, rawKey });
		}
	}

	// Bulk insert API keys
	if (apiKeyRows.length > 0) {
		await prisma.apiKey.createMany({ data: apiKeyRows, skipDuplicates: true });
	}

	// ── Create 50 anonymous URLs (userId: null) for extra pagination data ─
	const ANONYMOUS_URL_COUNT = 50;
	for (let a = 0; a < ANONYMOUS_URL_COUNT; a++) {
		const shortCode = `anon-bulk-${a}`;
		const anonymousUrl = await prisma.url.upsert({
			where: { shortCode },
			update: {},
			create: {
				userId: null,
				shortCode,
				originalUrl: `https://example.com/anonymous/${a}`,
				title: Math.random() > 0.3 ? `Anonymous Page ${a + 1}` : null,
				redirectType: Math.random() > 0.5 ? "PERMANENT" : "TEMPORARY",
				isActive: true,
				clickCount: randInt(0, 300),
				expiresAt: Math.random() > 0.85 ? daysFromNow(randInt(30, 180)) : undefined,
			},
		});
		urlList.push(anonymousUrl);
	}

	// Create clicks for the new URLs
	if (urlList.length > 0) {
		const clickRows: Array<{
			urlId: string;
			ipAddress: string;
			country: string;
			city: string;
			deviceType: DeviceType;
			os: string;
			browser: string;
			referrer: string | null;
			utmSource: string | null;
			utmMedium: string | null;
			utmCampaign: string | null;
			clickedAt: number;
		}> = [];

		const ip = () => `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;

		for (const url of urlList) {
			const extraClicks = randInt(5, 20);
			for (let c = 0; c < extraClicks; c++) {
				clickRows.push({
					urlId: url.id,
					ipAddress: ip(),
					country: rand(COUNTRIES),
					city: rand(CITIES),
					deviceType: rand(DEVICES),
					os: rand(OSS),
					browser: rand(BROWSERS),
					referrer: rand(REFERRERS),
					utmSource: Math.random() > 0.7 ? rand(UTM_SOURCES) : null,
					utmMedium: Math.random() > 0.7 ? rand(UTM_MEDIUMS) : null,
					utmCampaign: Math.random() > 0.7 ? "bulk_seed" : null,
					clickedAt: daysAgo(randInt(0, 60)),
				});
			}
		}

		// Insert clicks in batches
		const BATCH = 100;
		for (let i = 0; i < clickRows.length; i += BATCH) {
			await prisma.click.createMany({ data: clickRows.slice(i, i + BATCH) });
		}
	}

	// Log generated API keys
	console.log("");
	console.log("  📋 Additional API Keys:");
	console.log("  ────────────────────────────────────────────────────────");
	for (const entry of rawKeyLog) {
		console.log(`  ${entry.email.padEnd(35)} ${entry.rawKey}`);
	}

	return createdUsers;
}
