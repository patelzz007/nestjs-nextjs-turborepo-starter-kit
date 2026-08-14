import type { DeviceType, RedirectType, Tag, Url, User } from "@prisma/client";

import { prisma } from "./client";
import { BROWSERS, CITIES, COUNTRIES, DEVICES, OSS, REFERRERS, UTM_MEDIUMS, UTM_SOURCES, daysAgo, daysFromNow, rand, randInt } from "./helpers";

export async function createUrls(users: User[]): Promise<Url[]> {
	const get = (email: string) => users.find((u) => u.email === email)!;

	const urlsData: {
		userId: string | null;
		shortCode: string;
		customAlias?: string;
		originalUrl: string;
		title: string | null;
		redirectType: RedirectType;
		isActive: boolean;
		clickCount: number;
		clickLimit?: number;
		expiresAt?: number;
	}[] = [
		// Alice
		{
			userId: get("alice.johnson@example.com").id,
			shortCode: "ali-gh",
			originalUrl: "https://github.com/alicejohnson",
			title: "Alice's GitHub",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 284,
		},
		{
			userId: get("alice.johnson@example.com").id,
			shortCode: "ali-tw",
			customAlias: "alice-twitter",
			originalUrl: "https://twitter.com/alice_codes",
			title: "Alice on Twitter",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 173,
		},
		{
			userId: get("alice.johnson@example.com").id,
			shortCode: "ali-yt",
			originalUrl: "https://youtube.com/@alicecodes",
			title: "Alice's YouTube Channel",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 512,
		},
		{
			userId: get("alice.johnson@example.com").id,
			shortCode: "q1-promo",
			customAlias: "promo-q1",
			originalUrl: "https://shop.example.com/promo?campaign=q1_2025",
			title: "Q1 2025 Promo Campaign",
			redirectType: "TEMPORARY",
			isActive: false,
			clickCount: 1840,
			expiresAt: new Date("2025-03-31").getTime(),
		},
		{
			userId: get("alice.johnson@example.com").id,
			shortCode: "ali-nl",
			originalUrl: "https://newsletter.alice.dev/subscribe",
			title: "Alice's Newsletter",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 96,
			clickLimit: 1000,
		},
		{
			userId: get("alice.johnson@example.com").id,
			shortCode: "ali-lk",
			originalUrl: "https://linkedin.com/in/alicejohnson",
			title: "Alice on LinkedIn",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 45,
		},

		// Bob
		{
			userId: get("bob.smith@example.com").id,
			shortCode: "bob-lk",
			customAlias: "bob-linkedin",
			originalUrl: "https://linkedin.com/in/bobsmith",
			title: "Bob's LinkedIn",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 88,
		},
		{
			userId: get("bob.smith@example.com").id,
			shortCode: "bob-cal",
			originalUrl: "https://calendly.com/bobsmith/30min",
			title: "Book 30 min with Bob",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 47,
			clickLimit: 200,
		},
		{
			userId: get("bob.smith@example.com").id,
			shortCode: "bob-cv",
			customAlias: "bob-resume",
			originalUrl: "https://resume.bobsmith.dev",
			title: "Bob's Resume",
			redirectType: "PERMANENT",
			isActive: true,
			clickCount: 32,
		},
		{
			userId: get("bob.smith@example.com").id,
			shortCode: "bob-port",
			originalUrl: "https://bobsmith.dev",
			title: "Bob's Portfolio Site",
			redirectType: "PERMANENT",
			isActive: true,
			clickCount: 211,
		},

		// Carol
		{
			userId: get("carol.white@example.com").id,
			shortCode: "carol-blog",
			originalUrl: "https://carolwhite.blog",
			title: "Carol's Blog",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 634,
		},
		{
			userId: get("carol.white@example.com").id,
			shortCode: "carol-r1",
			originalUrl: "https://carolwhite.blog/recipes/pasta-carbonara",
			title: "Best Pasta Carbonara Recipe",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 291,
		},
		{
			userId: get("carol.white@example.com").id,
			shortCode: "carol-ig",
			originalUrl: "https://instagram.com/carolcooks",
			title: "Carol on Instagram",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 158,
		},

		// David
		{
			userId: get("david.lee@example.com").id,
			shortCode: "dav-gh",
			originalUrl: "https://github.com/davidlee",
			title: "David's GitHub",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 374,
		},
		{
			userId: get("david.lee@example.com").id,
			shortCode: "dav-npm",
			customAlias: "david-npm",
			originalUrl: "https://npmjs.com/~davidlee",
			title: "David's npm Packages",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 127,
		},
		{
			userId: get("david.lee@example.com").id,
			shortCode: "dav-oss",
			originalUrl: "https://github.com/davidlee/awesome-toolkit",
			title: "Awesome Toolkit — OSS",
			redirectType: "PERMANENT",
			isActive: true,
			clickCount: 892,
		},
		{
			userId: get("david.lee@example.com").id,
			shortCode: "dav-docs",
			originalUrl: "https://docs.awesome-toolkit.dev",
			title: "Toolkit Documentation",
			redirectType: "PERMANENT",
			isActive: true,
			clickCount: 440,
		},

		// Frank
		{
			userId: get("frank.miller@example.com").id,
			shortCode: "fk-dash",
			customAlias: "admin-dashboard",
			originalUrl: "https://internal.example.com/admin",
			title: "Admin Dashboard",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 1203,
		},
		{
			userId: get("frank.miller@example.com").id,
			shortCode: "fk-logs",
			originalUrl: "https://logs.internal.example.com",
			title: "Log Viewer",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 346,
		},
		{
			userId: get("frank.miller@example.com").id,
			shortCode: "fk-graf",
			originalUrl: "https://grafana.internal.example.com",
			title: "Grafana Monitoring",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 218,
		},
		{
			userId: get("frank.miller@example.com").id,
			shortCode: "fk-runbook",
			originalUrl: "https://notion.so/team/runbooks",
			title: "Ops Runbooks (Notion)",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 79,
		},

		// Grace
		{
			userId: get("grace.wilson@example.com").id,
			shortCode: "grace-shop",
			originalUrl: "https://etsy.com/shop/gracewilsonart",
			title: "Grace's Etsy Shop",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 502,
		},
		{
			userId: get("grace.wilson@example.com").id,
			shortCode: "grace-ig",
			customAlias: "grace-art",
			originalUrl: "https://instagram.com/gracewilsonart",
			title: "Grace's Art Instagram",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 739,
		},

		// Henry
		{
			userId: get("henry.moore@example.com").id,
			shortCode: "hen-sub",
			originalUrl: "https://substack.com/@henrymoore",
			title: "Henry's Substack",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 317,
		},
		{
			userId: get("henry.moore@example.com").id,
			shortCode: "hen-report",
			customAlias: "q4-report",
			originalUrl: "https://docs.example.com/reports/q4-2024-financial",
			title: "Q4 2024 Financial Report",
			redirectType: "PERMANENT",
			isActive: true,
			clickCount: 88,
		},
		{
			userId: get("henry.moore@example.com").id,
			shortCode: "hen-tw",
			originalUrl: "https://twitter.com/henrymoore_fin",
			title: "Henry on Twitter",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 64,
		},

		// Isla
		{
			userId: get("isla.taylor@example.com").id,
			shortCode: "isla-blog",
			originalUrl: "https://islatravels.com",
			title: "Isla's Travel Blog",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 428,
		},
		{
			userId: get("isla.taylor@example.com").id,
			shortCode: "isla-vsco",
			originalUrl: "https://vsco.co/islataylor",
			title: "Isla's VSCO",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 183,
		},

		// Jack
		{
			userId: get("jack.anderson@example.com").id,
			shortCode: "jack-app",
			customAlias: "launch",
			originalUrl: "https://app.jackstartup.com",
			title: "Jack's SaaS App",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 2104,
		},
		{
			userId: get("jack.anderson@example.com").id,
			shortCode: "jack-ph",
			originalUrl: "https://producthunt.com/posts/jackstartup",
			title: "Product Hunt Launch",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 1567,
			expiresAt: daysFromNow(14),
		},
		{
			userId: get("jack.anderson@example.com").id,
			shortCode: "jack-demo",
			originalUrl: "https://app.jackstartup.com/demo",
			title: "Book a Demo",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 389,
			clickLimit: 500,
		},
		{
			userId: get("jack.anderson@example.com").id,
			shortCode: "jack-price",
			originalUrl: "https://app.jackstartup.com/pricing",
			title: "Pricing Page",
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 874,
		},

		// Anonymous
		{
			userId: null,
			shortCode: "anon-1",
			originalUrl: "https://example.com/landing",
			title: null,
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 12,
		},
		{
			userId: null,
			shortCode: "anon-2",
			originalUrl: "https://docs.example.com/getting-started",
			title: null,
			redirectType: "TEMPORARY",
			isActive: true,
			clickCount: 7,
		},
	];

	await prisma.url.createMany({ data: urlsData, skipDuplicates: true });
	return prisma.url.findMany();
}

export async function createUrlTags(users: User[], urls: Url[], tags: Tag[]): Promise<void> {
	const u = (email: string) => users.find((x) => x.email === email)!;
	const ul = (code: string) => urls.find((x) => x.shortCode === code)!;
	const tg = (userId: string, name: string) => tags.find((x) => x.userId === userId && x.name === name)!;

	const alice = u("alice.johnson@example.com");
	const bob = u("bob.smith@example.com");
	const carol = u("carol.white@example.com");
	const david = u("david.lee@example.com");
	const frank = u("frank.miller@example.com");
	const grace = u("grace.wilson@example.com");
	const henry = u("henry.moore@example.com");
	const isla = u("isla.taylor@example.com");
	const jack = u("jack.anderson@example.com");

	const rows = [
		// Alice
		{ urlId: ul("ali-gh").id, tagId: tg(alice.id, "social").id },
		{ urlId: ul("ali-tw").id, tagId: tg(alice.id, "social").id },
		{ urlId: ul("ali-yt").id, tagId: tg(alice.id, "social").id },
		{ urlId: ul("q1-promo").id, tagId: tg(alice.id, "marketing").id },
		{ urlId: ul("q1-promo").id, tagId: tg(alice.id, "campaigns").id },
		{ urlId: ul("ali-nl").id, tagId: tg(alice.id, "marketing").id },
		{ urlId: ul("ali-lk").id, tagId: tg(alice.id, "social").id },

		// Bob
		{ urlId: ul("bob-lk").id, tagId: tg(bob.id, "work").id },
		{ urlId: ul("bob-cal").id, tagId: tg(bob.id, "work").id },
		{ urlId: ul("bob-cv").id, tagId: tg(bob.id, "portfolio").id },
		{ urlId: ul("bob-port").id, tagId: tg(bob.id, "portfolio").id },

		// Carol
		{ urlId: ul("carol-blog").id, tagId: tg(carol.id, "blog").id },
		{ urlId: ul("carol-r1").id, tagId: tg(carol.id, "blog").id },
		{ urlId: ul("carol-r1").id, tagId: tg(carol.id, "recipes").id },
		{ urlId: ul("carol-ig").id, tagId: tg(carol.id, "blog").id },

		// David
		{ urlId: ul("dav-gh").id, tagId: tg(david.id, "dev").id },
		{ urlId: ul("dav-npm").id, tagId: tg(david.id, "dev").id },
		{ urlId: ul("dav-oss").id, tagId: tg(david.id, "open-source").id },
		{ urlId: ul("dav-oss").id, tagId: tg(david.id, "dev").id },
		{ urlId: ul("dav-docs").id, tagId: tg(david.id, "tools").id },

		// Frank
		{ urlId: ul("fk-dash").id, tagId: tg(frank.id, "internal").id },
		{ urlId: ul("fk-logs").id, tagId: tg(frank.id, "ops").id },
		{ urlId: ul("fk-graf").id, tagId: tg(frank.id, "infra").id },
		{ urlId: ul("fk-graf").id, tagId: tg(frank.id, "ops").id },
		{ urlId: ul("fk-runbook").id, tagId: tg(frank.id, "ops").id },

		// Grace
		{ urlId: ul("grace-shop").id, tagId: tg(grace.id, "shop").id },
		{ urlId: ul("grace-ig").id, tagId: tg(grace.id, "art").id },
		{ urlId: ul("grace-ig").id, tagId: tg(grace.id, "shop").id },

		// Henry
		{ urlId: ul("hen-sub").id, tagId: tg(henry.id, "finance").id },
		{ urlId: ul("hen-sub").id, tagId: tg(henry.id, "news").id },
		{ urlId: ul("hen-report").id, tagId: tg(henry.id, "finance").id },
		{ urlId: ul("hen-report").id, tagId: tg(henry.id, "research").id },
		{ urlId: ul("hen-tw").id, tagId: tg(henry.id, "news").id },

		// Isla
		{ urlId: ul("isla-blog").id, tagId: tg(isla.id, "travel").id },
		{ urlId: ul("isla-vsco").id, tagId: tg(isla.id, "photos").id },
		{ urlId: ul("isla-vsco").id, tagId: tg(isla.id, "travel").id },

		// Jack
		{ urlId: ul("jack-app").id, tagId: tg(jack.id, "saas").id },
		{ urlId: ul("jack-app").id, tagId: tg(jack.id, "startup").id },
		{ urlId: ul("jack-ph").id, tagId: tg(jack.id, "growth").id },
		{ urlId: ul("jack-ph").id, tagId: tg(jack.id, "startup").id },
		{ urlId: ul("jack-demo").id, tagId: tg(jack.id, "saas").id },
		{ urlId: ul("jack-price").id, tagId: tg(jack.id, "growth").id },
	];

	await prisma.urlTag.createMany({ data: rows, skipDuplicates: true });
}

export async function createClicks(urls: Url[]): Promise<void> {
	type ClickRow = {
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
	};

	const ip = () => `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;

	const makeClick = (urlId: string, daysBack: number, withUtm = false): ClickRow => {
		const ci = randInt(0, COUNTRIES.length - 1);
		return {
			urlId,
			ipAddress: ip(),
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
