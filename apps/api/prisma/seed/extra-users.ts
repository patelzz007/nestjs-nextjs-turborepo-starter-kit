import type { DeviceType, Plan, Role, Tag, Url, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";
import { SEED_DEVICE_PROFILES, SEED_MOBILE_PROFILES, SEED_SESSION_LOCATIONS, seedSessionRow } from "./device-sessions";
import {
	BROWSERS,
	CITIES,
	COUNTRIES,
	DEVICES,
	OSS,
	REFERRERS,
	UTM_MEDIUMS,
	UTM_SOURCES,
	cycle,
	daysAgo,
	daysFromNow,
	generateSeedApiKey,
	rand,
	randChance,
	randInt,
	randomIpv4,
} from "./helpers";
import { seedLog } from "./seed-log";

/** Display names of the additional demo users; user N gets `user-NN@example.com`. */
const NAMES: readonly string[] = [
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

/** Email of the `index`-th additional demo user. */
function extraUserEmail(index: number): string {
	return `user-${String(index + 1).padStart(2, "0")}@example.com`;
}

/** Every account {@link generateAdditionalSeedData} owns — the seed's cleanup is scoped to these. */
export const EXTRA_SEED_USER_EMAILS: readonly string[] = NAMES.map((_name, index) => extraUserEmail(index));

/** Short codes of the anonymous demo URLs share this prefix (they have no owner to scope by). */
export const ANONYMOUS_SEED_URL_PREFIX = "anon-bulk-";

// Additional Seed Data (20 extra users with URLs, tags, clicks, and API keys)
export async function generateAdditionalSeedData(roles: Role[], userRole: Role): Promise<User[]> {
	const hash = (pw: string): Promise<string> => bcrypt.hash(pw, 10);
	const defaultPassword = await hash("User@123");

	const PLANS: Plan[] = ["FREE", "PRO"];

	const createdUsers: User[] = [];
	const urlList: Url[] = [];
	const tagList: Tag[] = [];
	const apiKeyRows: {
		userId: string;
		name: string;
		keyHash: string;
		keyPrefix: string;
		scopes: string[];
		rateLimitTier: string;
		isActive: boolean;
		expiresAt: number | null;
	}[] = [];
	const rawKeyLog: { email: string; rawKey: string }[] = [];

	for (const [i, name] of NAMES.entries()) {
		const email = extraUserEmail(i);
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

		// Two device sessions per user: the web app on a desktop and the mobile app.
		const desktopIp: string = randomIpv4();
		const phoneIp: string = randomIpv4();
		await prisma.refreshToken.createMany({
			data: [
				seedSessionRow({
					userId: u.id,
					tokenHash: `rt_${u.id}_d_${String(Date.now())}`,
					profile: SEED_DEVICE_PROFILES.webChromeMac,
					signInMethod: "PASSWORD_NEW_DEVICE_CODE",
					ipAddress: desktopIp,
					lastIpAddress: desktopIp,
					location: rand([...SEED_SESSION_LOCATIONS, null]),
					createdAt: daysAgo(randInt(1, 6)),
					lastActiveAt: daysAgo(randInt(0, 1)),
					expiresAt: daysFromNow(7),
				}),
				seedSessionRow({
					userId: u.id,
					tokenHash: `rt_${u.id}_m_${String(Date.now() + 1)}`,
					profile: rand(SEED_MOBILE_PROFILES),
					signInMethod: "PASSWORD",
					ipAddress: phoneIp,
					lastIpAddress: randomIpv4(),
					location: rand(SEED_SESSION_LOCATIONS),
					createdAt: daysAgo(randInt(2, 6)),
					lastActiveAt: daysAgo(randInt(0, 1)),
					expiresAt: daysFromNow(7),
				}),
			],
		});

		// Create 3-6 tags per user
		const tagNames = randInt(3, 6);
		const tagColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#14b8a6", "#f43f5e", "#22c55e", "#0ea5e9"];
		const userTags: Tag[] = [];
		for (let t = 0; t < tagNames; t++) {
			const tag = await prisma.tag.upsert({
				where: { userId_name: { userId: u.id, name: `tag-${String(i + 1)}-${String(t)}` } },
				update: {},
				create: {
					userId: u.id,
					name: `tag-${String(i + 1)}-${String(t)}`,
					color: rand(tagColors),
				},
			});
			userTags.push(tag);
		}
		tagList.push(...userTags);

		// Create 12-18 URLs per user
		const urlCount = randInt(12, 18);
		for (let uIdx = 0; uIdx < urlCount; uIdx++) {
			const shortCode = `usr${String(i + 1)}-${String(uIdx)}`;
			const url = await prisma.url.upsert({
				where: { shortCode },
				update: {},
				create: {
					userId: u.id,
					shortCode,
					originalUrl: `https://example.com/user-${String(i + 1)}/${String(uIdx)}`,
					title: `User ${String(i + 1)} — URL ${String(uIdx + 1)}`,
					redirectType: "TEMPORARY",
					isActive: true,
					clickCount: randInt(0, 500),
					expiresAt: randChance(0.2) ? daysFromNow(randInt(30, 90)) : null,
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
			const [firstName = fullName] = fullName.split(" ");
			const name =
				k % 4 === 0
					? `${firstName} — API Key ${String(k + 1)}`
					: k % 4 === 1
						? `${firstName} — Read-Only ${String(k + 1)}`
						: k % 4 === 2
							? `${firstName} — Full Access ${String(k + 1)}`
							: `${firstName} — Dev Key ${String(k + 1)}`;
			apiKeyRows.push({
				userId: u.id,
				name,
				keyHash,
				keyPrefix,
				scopes,
				rateLimitTier: tier,
				isActive: active,
				expiresAt: hasExpiry ? daysFromNow(randInt(15, 90)) : null,
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
		const shortCode = `${ANONYMOUS_SEED_URL_PREFIX}${String(a)}`;
		const anonymousUrl = await prisma.url.upsert({
			where: { shortCode },
			update: {},
			create: {
				userId: null,
				shortCode,
				originalUrl: `https://example.com/anonymous/${String(a)}`,
				title: randChance(0.7) ? `Anonymous Page ${String(a + 1)}` : null,
				redirectType: randChance(0.5) ? "PERMANENT" : "TEMPORARY",
				isActive: true,
				clickCount: randInt(0, 300),
				expiresAt: randChance(0.15) ? daysFromNow(randInt(30, 180)) : null,
			},
		});
		urlList.push(anonymousUrl);
	}

	// Create clicks for the new URLs
	if (urlList.length > 0) {
		const clickRows: {
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
		}[] = [];

		for (const url of urlList) {
			const extraClicks = randInt(5, 20);
			for (let c = 0; c < extraClicks; c++) {
				clickRows.push({
					urlId: url.id,
					ipAddress: randomIpv4(),
					country: rand(COUNTRIES),
					city: rand(CITIES),
					deviceType: rand(DEVICES),
					os: rand(OSS),
					browser: rand(BROWSERS),
					referrer: rand(REFERRERS),
					utmSource: randChance(0.3) ? rand(UTM_SOURCES) : null,
					utmMedium: randChance(0.3) ? rand(UTM_MEDIUMS) : null,
					utmCampaign: randChance(0.3) ? "bulk_seed" : null,
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
	seedLog("");
	seedLog("  📋 Additional API Keys:");
	seedLog("  ────────────────────────────────────────────────────────");
	for (const entry of rawKeyLog) {
		seedLog(`  ${entry.email.padEnd(35)} ${entry.rawKey}`);
	}

	return createdUsers;
}
