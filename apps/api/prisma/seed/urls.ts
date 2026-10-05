import type { DeviceType, RedirectType, Tag, Url, User } from "@prisma/client";

import { prisma } from "./client";
import { requireRow } from "./require-row";
import { BROWSERS, CITIES, COUNTRIES, DEVICES, OSS, REFERRERS, UTM_MEDIUMS, UTM_SOURCES, daysAgo, daysFromNow, rand, randInt, randomIpv4 } from "./helpers";

/** One seeded short URL. `redirectType` defaults to TEMPORARY and `isActive` to true. */
interface SeedUrl {
	readonly shortCode: string;
	readonly customAlias?: string;
	readonly originalUrl: string;
	readonly title: string | null;
	readonly clickCount: number;
	readonly redirectType?: RedirectType;
	readonly isActive?: boolean;
	readonly clickLimit?: number;
	readonly expiresAt?: number;
	/** Names of the OWNER's tags attached through `url_tags`, in insertion order. */
	readonly tags?: readonly string[];
}

/** Seeded URLs grouped by owner email (`null` = anonymous), in insertion order. Built per call: `expiresAt` may be relative to now. */
function seedUrlTable(): readonly (readonly [ownerEmail: string | null, urls: readonly SeedUrl[]])[] {
	return [
		[
			"alice.johnson@example.com",
			[
				{ shortCode: "ali-gh", originalUrl: "https://github.com/alicejohnson", title: "Alice's GitHub", clickCount: 284, tags: ["social"] },
				{ shortCode: "ali-tw", customAlias: "alice-twitter", originalUrl: "https://twitter.com/alice_codes", title: "Alice on Twitter", clickCount: 173, tags: ["social"] },
				{ shortCode: "ali-yt", originalUrl: "https://youtube.com/@alicecodes", title: "Alice's YouTube Channel", clickCount: 512, tags: ["social"] },
				{
					shortCode: "q1-promo",
					customAlias: "promo-q1",
					originalUrl: "https://shop.example.com/promo?campaign=q1_2025",
					title: "Q1 2025 Promo Campaign",
					clickCount: 1840,
					isActive: false,
					expiresAt: new Date("2025-03-31").getTime(),
					tags: ["marketing", "campaigns"],
				},
				{ shortCode: "ali-nl", originalUrl: "https://newsletter.alice.dev/subscribe", title: "Alice's Newsletter", clickCount: 96, clickLimit: 1000, tags: ["marketing"] },
				{ shortCode: "ali-lk", originalUrl: "https://linkedin.com/in/alicejohnson", title: "Alice on LinkedIn", clickCount: 45, tags: ["social"] },
			],
		],
		[
			"bob.smith@example.com",
			[
				{ shortCode: "bob-lk", customAlias: "bob-linkedin", originalUrl: "https://linkedin.com/in/bobsmith", title: "Bob's LinkedIn", clickCount: 88, tags: ["work"] },
				{ shortCode: "bob-cal", originalUrl: "https://calendly.com/bobsmith/30min", title: "Book 30 min with Bob", clickCount: 47, clickLimit: 200, tags: ["work"] },
				{
					shortCode: "bob-cv",
					customAlias: "bob-resume",
					originalUrl: "https://resume.bobsmith.dev",
					title: "Bob's Resume",
					clickCount: 32,
					redirectType: "PERMANENT",
					tags: ["portfolio"],
				},
				{ shortCode: "bob-port", originalUrl: "https://bobsmith.dev", title: "Bob's Portfolio Site", clickCount: 211, redirectType: "PERMANENT", tags: ["portfolio"] },
			],
		],
		[
			"carol.white@example.com",
			[
				{ shortCode: "carol-blog", originalUrl: "https://carolwhite.blog", title: "Carol's Blog", clickCount: 634, tags: ["blog"] },
				{
					shortCode: "carol-r1",
					originalUrl: "https://carolwhite.blog/recipes/pasta-carbonara",
					title: "Best Pasta Carbonara Recipe",
					clickCount: 291,
					tags: ["blog", "recipes"],
				},
				{ shortCode: "carol-ig", originalUrl: "https://instagram.com/carolcooks", title: "Carol on Instagram", clickCount: 158, tags: ["blog"] },
			],
		],
		[
			"david.lee@example.com",
			[
				{ shortCode: "dav-gh", originalUrl: "https://github.com/davidlee", title: "David's GitHub", clickCount: 374, tags: ["dev"] },
				{ shortCode: "dav-npm", customAlias: "david-npm", originalUrl: "https://npmjs.com/~davidlee", title: "David's npm Packages", clickCount: 127, tags: ["dev"] },
				{
					shortCode: "dav-oss",
					originalUrl: "https://github.com/davidlee/awesome-toolkit",
					title: "Awesome Toolkit — OSS",
					clickCount: 892,
					redirectType: "PERMANENT",
					tags: ["open-source", "dev"],
				},
				{
					shortCode: "dav-docs",
					originalUrl: "https://docs.awesome-toolkit.dev",
					title: "Toolkit Documentation",
					clickCount: 440,
					redirectType: "PERMANENT",
					tags: ["tools"],
				},
			],
		],
		[
			"frank.miller@example.com",
			[
				{
					shortCode: "fk-dash",
					customAlias: "admin-dashboard",
					originalUrl: "https://internal.example.com/admin",
					title: "Admin Dashboard",
					clickCount: 1203,
					tags: ["internal"],
				},
				{ shortCode: "fk-logs", originalUrl: "https://logs.internal.example.com", title: "Log Viewer", clickCount: 346, tags: ["ops"] },
				{ shortCode: "fk-graf", originalUrl: "https://grafana.internal.example.com", title: "Grafana Monitoring", clickCount: 218, tags: ["infra", "ops"] },
				{ shortCode: "fk-runbook", originalUrl: "https://notion.so/team/runbooks", title: "Ops Runbooks (Notion)", clickCount: 79, tags: ["ops"] },
			],
		],
		[
			"grace.wilson@example.com",
			[
				{ shortCode: "grace-shop", originalUrl: "https://etsy.com/shop/gracewilsonart", title: "Grace's Etsy Shop", clickCount: 502, tags: ["shop"] },
				{
					shortCode: "grace-ig",
					customAlias: "grace-art",
					originalUrl: "https://instagram.com/gracewilsonart",
					title: "Grace's Art Instagram",
					clickCount: 739,
					tags: ["art", "shop"],
				},
			],
		],
		[
			"henry.moore@example.com",
			[
				{ shortCode: "hen-sub", originalUrl: "https://substack.com/@henrymoore", title: "Henry's Substack", clickCount: 317, tags: ["finance", "news"] },
				{
					shortCode: "hen-report",
					customAlias: "q4-report",
					originalUrl: "https://docs.example.com/reports/q4-2024-financial",
					title: "Q4 2024 Financial Report",
					clickCount: 88,
					redirectType: "PERMANENT",
					tags: ["finance", "research"],
				},
				{ shortCode: "hen-tw", originalUrl: "https://twitter.com/henrymoore_fin", title: "Henry on Twitter", clickCount: 64, tags: ["news"] },
			],
		],
		[
			"isla.taylor@example.com",
			[
				{ shortCode: "isla-blog", originalUrl: "https://islatravels.com", title: "Isla's Travel Blog", clickCount: 428, tags: ["travel"] },
				{ shortCode: "isla-vsco", originalUrl: "https://vsco.co/islataylor", title: "Isla's VSCO", clickCount: 183, tags: ["photos", "travel"] },
			],
		],
		[
			"jack.anderson@example.com",
			[
				{ shortCode: "jack-app", customAlias: "launch", originalUrl: "https://app.jackstartup.com", title: "Jack's SaaS App", clickCount: 2104, tags: ["saas", "startup"] },
				{
					shortCode: "jack-ph",
					originalUrl: "https://producthunt.com/posts/jackstartup",
					title: "Product Hunt Launch",
					clickCount: 1567,
					expiresAt: daysFromNow(14),
					tags: ["growth", "startup"],
				},
				{ shortCode: "jack-demo", originalUrl: "https://app.jackstartup.com/demo", title: "Book a Demo", clickCount: 389, clickLimit: 500, tags: ["saas"] },
				{ shortCode: "jack-price", originalUrl: "https://app.jackstartup.com/pricing", title: "Pricing Page", clickCount: 874, tags: ["growth"] },
			],
		],
		[
			null,
			[
				{ shortCode: "anon-1", originalUrl: "https://example.com/landing", title: null, clickCount: 12 },
				{ shortCode: "anon-2", originalUrl: "https://docs.example.com/getting-started", title: null, clickCount: 7 },
			],
		],
	];
}

function findUser(users: readonly User[], email: string): User {
	return requireRow(
		users.find((u) => u.email === email),
		`user ${email}`,
	);
}

export async function createUrls(users: User[]): Promise<Url[]> {
	const urlsData = seedUrlTable().flatMap(([ownerEmail, urls]) => {
		const userId: string | null = ownerEmail === null ? null : findUser(users, ownerEmail).id;
		return urls.map(({ tags: _tags, redirectType = "TEMPORARY", isActive = true, ...url }) => ({ userId, ...url, redirectType, isActive }));
	});

	await prisma.url.createMany({ data: urlsData, skipDuplicates: true });
	return prisma.url.findMany();
}

export async function createUrlTags(users: User[], urls: Url[], tags: Tag[]): Promise<void> {
	const rows: { urlId: string; tagId: string }[] = [];
	for (const [ownerEmail, ownerUrls] of seedUrlTable()) {
		if (ownerEmail === null) {
			continue;
		}
		const owner: User = findUser(users, ownerEmail);
		for (const seedUrl of ownerUrls) {
			for (const tagName of seedUrl.tags ?? []) {
				const url: Url = requireRow(
					urls.find((x) => x.shortCode === seedUrl.shortCode),
					`url ${seedUrl.shortCode}`,
				);
				const tag: Tag = requireRow(
					tags.find((x) => x.userId === owner.id && x.name === tagName),
					`tag ${tagName} for user ${owner.id}`,
				);
				rows.push({ urlId: url.id, tagId: tag.id });
			}
		}
	}

	await prisma.urlTag.createMany({ data: rows, skipDuplicates: true });
}

export async function createClicks(urls: Url[]): Promise<void> {
	interface ClickRow {
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
	}

	const makeClick = (urlId: string, daysBack: number, withUtm = false): ClickRow => {
		const ci = randInt(0, COUNTRIES.length - 1);
		return {
			urlId,
			ipAddress: randomIpv4(),
			country: COUNTRIES[ci] ?? "MY",
			city: CITIES[ci] ?? "Kuala Lumpur",
			deviceType: rand(DEVICES),
			os: rand(OSS),
			browser: rand(BROWSERS),
			referrer: rand(REFERRERS),
			utmSource: withUtm ? rand(UTM_SOURCES) : null,
			utmMedium: withUtm ? rand(UTM_MEDIUMS) : null,
			utmCampaign: withUtm ? "seed_campaign" : null,
			clickedAt: daysAgo(daysBack),
		};
	};

	// [shortCode, clickCount, hasUtm]
	const targets: [string, number, boolean][] = [
		["jack-app", 80, true],
		["jack-ph", 60, true],
		["jack-price", 40, true],
		["jack-demo", 30, false],
		["dav-oss", 40, false],
		["dav-docs", 25, false],
		["ali-yt", 30, false],
		["q1-promo", 40, true],
		["carol-blog", 35, false],
		["grace-ig", 30, false],
		["fk-dash", 25, false],
		["ali-gh", 20, false],
		["bob-port", 15, false],
		["hen-sub", 15, false],
		["isla-blog", 20, false],
		["ali-nl", 10, true],
		["carol-r1", 15, false],
		["bob-lk", 10, false],
		["dav-gh", 10, false],
		["grace-shop", 10, false],
	];

	const urlMap = new Map(urls.map((u) => [u.shortCode, u.id]));

	const rows: ClickRow[] = [];
	for (const [code, count, withUtm] of targets) {
		const urlId = urlMap.get(code);
		if (!urlId) continue;
		for (let i = 0; i < count; i++) {
			rows.push(makeClick(urlId, randInt(0, 90), withUtm));
		}
	}

	// Insert in batches of 100
	const BATCH = 100;
	for (let i = 0; i < rows.length; i += BATCH) {
		await prisma.click.createMany({ data: rows.slice(i, i + BATCH) });
	}
}
