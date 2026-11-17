// ============================================
// prisma/seed/merchant-network-plan.ts — more merchants, branches, rewards and loyal customers, as data
// ============================================
// The `development` scenario's two demo merchants show every screen; this adds a marketplace's worth beside them:
// six more merchants across Kuala Lumpur and Melaka (the pilot cities), 3–5 branches each, 50 rewards at every
// branch, and a year of claims and bills through the same invariants as analytics-history.ts. Five loyal customers
// come back to five of the merchants all year: 11 counted redemptions at each is 55 in the 12-month window, past the
// 50 that Diamond needs (at most 20 count per merchant: ADR 085), so the tiers show real Diamond customers.
//
// A PURE builder (no Prisma) so its rows are unit-tested. Structure (ids, slugs, codes, which branch offers which
// reward) depends only on this file; values that vary (bill totals, times, stock) come from the seeded PRNG, so a
// `--seed` gives the same rows every run and a re-run converges.

import { DAY_MS, PILOT_CITY_TIME_ZONES, type CustomerTier } from "@workspace/shared";
import type { RewardRedemptionMethod, RewardType } from "@prisma/client";

import { CLAIM_WINDOW_MS, duringOpeningHours, localMidnight } from "./analytics-history";
import { deterministicUuid } from "./deterministic-uuid";
import type { SeededRandom } from "./prng";
import type { RewardImageSetSlug } from "./reward-images";

const NAMESPACE = "merchant-network";

/** Rewards each branch offers. */
export const REWARDS_PER_LOCATION = 50;
/** Merchants the loyal customers return to (the first five of {@link NETWORK_TENANTS}). */
export const LOYAL_MERCHANT_COUNT = 5;
/** Counted redemptions a loyal customer makes at each of those merchants in the last year (5 × 11 = 55 ≥ Diamond's 50). */
export const LOYAL_VISITS_PER_MERCHANT = 11;
/** Bills an ordinary branch takes from other customers over the year. */
const GENERAL_VISITS_PER_LOCATION = 18;
/** Share of ordinary claims never redeemed (their window passed). */
const EXPIRED_CLAIM_SHARE = 0.2;
/** Share of redemptions entered with the backup code instead of a QR scan. */
const MANUAL_REDEMPTION_SHARE = 0.25;
/** The loyal customers' visits fall between these many days ago (inside the tiers' 12-month window). */
const LOYAL_FIRST_DAYS_AGO = 330;
const LOYAL_LAST_DAYS_AGO = 5;
/** Ordinary visits fall in the year before today. */
const GENERAL_FIRST_DAYS_AGO = 360;
const GENERAL_LAST_DAYS_AGO = 2;
/** Most claims are made the same day as the bill; up to this many days before. */
const MAX_CLAIM_LEAD_DAYS = 3;
const MINUTE_MS = 60_000;

/** Every this-many-th reward of a branch runs all year (so every visit finds one running). */
const EVERGREEN_EVERY = 5;
const EVERGREEN_START_DAYS_AGO = 380;
const EVERGREEN_END_DAYS_FROM_NOW = 120;
/** Other rewards run a stretch of the year; every this-many-th one has ended. */
const ENDED_EVERY = 6;
const CAMPAIGN_MIN_START_DAYS_AGO = 20;
const CAMPAIGN_MAX_START_DAYS_AGO = 340;
const CAMPAIGN_MIN_LENGTH_DAYS = 30;
const CAMPAIGN_MAX_LENGTH_DAYS = 200;
const RUNNING_MIN_DAYS_LEFT = 14;
const RUNNING_MAX_DAYS_LEFT = 150;
/** Every this-many-th reward needs a minimum tier (the marketplace shows it locked below that tier). */
const SILVER_EVERY = 9;
const GOLD_EVERY = 23;
const DIAMOND_EVERY = 47;

/** Offer sizes, by reward type. */
const DISCOUNT_PERCENTS: readonly number[] = [10, 15, 20, 25, 30];
const CASHBACK_RINGGIT: readonly number[] = [2, 3, 5, 8, 10];
const POINTS_MULTIPLIERS: readonly number[] = [2, 3, 5];
const OFFER_TYPES: readonly RewardType[] = ["DISCOUNT", "FREE_ITEM", "CASHBACK", "POINTS", "BOGO"];
const SEN_PER_RINGGIT = 100;
/** A free item needs a bill of at least this many times its price. */
const FREE_ITEM_SPEND_MULTIPLE = 2;
/** Bills range up to this many times the reward's minimum spend (or the item's price). */
const BILL_SPREAD = 3;

/** When and why an offer runs: a reward's title ends with one. */
const OCCASIONS: readonly string[] = [
	"weekday mornings",
	"rainy-day special",
	"Hari Raya treat",
	"payday Friday",
	"student pass",
	"family weekend",
	"after-work hour",
	"first visit",
	"Deepavali lights",
	"Chinese New Year ong",
	"Merdeka month",
	"school holidays",
	"birthday month",
	"bring a friend",
	"midweek pick-me-up",
	"monsoon comfort",
	"night owl",
	"early bird",
	"Ramadan bazaar",
	"Christmas cheer",
];

export interface NetworkItem {
	readonly name: string;
	readonly sku: string;
	readonly priceMinor: number;
}

export interface NetworkLocationSeed {
	readonly code: string;
	readonly area: string;
	readonly addressText: string;
	readonly city: "KUALA_LUMPUR" | "MELAKA";
	readonly contactPhone: string;
}

export interface NetworkTenantSeed {
	readonly key: string;
	readonly slug: string;
	readonly displayName: string;
	readonly legalName: string;
	/** A reward category (the marketplace's filter). */
	readonly category: "cafe" | "restaurant" | "retail" | "wellness" | "entertainment" | "food" | "beverage";
	/** The photo sets (assets/reward-images) whose covers this merchant uploads; its rewards take them in turn. A published reward always has an image. */
	readonly imageSets: readonly RewardImageSetSlug[];
	readonly ownerName: string;
	readonly registrationNo: string;
	readonly items: readonly NetworkItem[];
	/** The first branch is the primary one. */
	readonly locations: readonly NetworkLocationSeed[];
}

/** The six merchants: their own goods, and branches across the pilot cities. */
export const NETWORK_TENANTS: readonly NetworkTenantSeed[] = [
	{
		key: "kopi-kaki",
		slug: "kopi-kaki-collective",
		displayName: "Kopi Kaki Collective",
		legalName: "Kopi Kaki Collective Sdn Bhd",
		category: "cafe",
		imageSets: ["free-coffee", "coffee-refill", "pastry-coffee"],
		ownerName: "Farid Iskandar",
		registrationNo: "202101034567",
		items: [
			{ name: "Kopi O kosong", sku: "KK-KOPI-O", priceMinor: 350 },
			{ name: "Kopi peng", sku: "KK-KOPI-PENG", priceMinor: 450 },
			{ name: "Teh tarik", sku: "KK-TEH-TARIK", priceMinor: 400 },
			{ name: "Kaya butter toast", sku: "KK-KAYA-TOAST", priceMinor: 550 },
			{ name: "Half-boiled eggs", sku: "KK-EGGS", priceMinor: 400 },
			{ name: "Nasi lemak bungkus", sku: "KK-NASI-LEMAK", priceMinor: 650 },
			{ name: "Ipoh white coffee", sku: "KK-WHITE-COFFEE", priceMinor: 600 },
			{ name: "Milo dinosaur", sku: "KK-MILO-DINO", priceMinor: 700 },
			{ name: "Roti bakar set", sku: "KK-ROTI-SET", priceMinor: 900 },
			{ name: "Cham (coffee-tea)", sku: "KK-CHAM", priceMinor: 450 },
		],
		locations: [
			{ code: "bangsar", area: "Bangsar", addressText: "21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60322841001" },
			{ code: "mont-kiara", area: "Mont Kiara", addressText: "8 Jalan Kiara 3, Mont Kiara, 50480 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60362011002" },
			{ code: "chow-kit", area: "Chow Kit", addressText: "45 Jalan Haji Hussein, Chow Kit, 50300 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60326921003" },
			{ code: "ttdi", area: "TTDI", addressText: "12 Lorong Rahim Kajai 14, Taman Tun Dr Ismail, 60000 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60377221004" },
		],
	},
	{
		key: "roti-republic",
		slug: "roti-canai-republic",
		displayName: "Roti Canai Republic",
		legalName: "Republik Roti Enterprise",
		category: "restaurant",
		imageSets: ["signature-noodles", "next-meal", "jonker-lunch-set"],
		ownerName: "Mohan Krishnan",
		registrationNo: "201801045678",
		items: [
			{ name: "Roti canai kosong", sku: "RR-ROTI-KOSONG", priceMinor: 180 },
			{ name: "Roti telur bawang", sku: "RR-ROTI-TELUR", priceMinor: 350 },
			{ name: "Roti tisu tower", sku: "RR-ROTI-TISU", priceMinor: 600 },
			{ name: "Thosai masala", sku: "RR-THOSAI", priceMinor: 550 },
			{ name: "Murtabak ayam", sku: "RR-MURTABAK", priceMinor: 900 },
			{ name: "Maggi goreng", sku: "RR-MAGGI-GORENG", priceMinor: 750 },
			{ name: "Nasi kandar plate", sku: "RR-NASI-KANDAR", priceMinor: 1_300 },
			{ name: "Teh halia", sku: "RR-TEH-HALIA", priceMinor: 350 },
			{ name: "Bandung cincau", sku: "RR-BANDUNG", priceMinor: 450 },
			{ name: "Chicken 65 basket", sku: "RR-CHICKEN-65", priceMinor: 1_100 },
		],
		locations: [
			{
				code: "brickfields",
				area: "Brickfields",
				addressText: "102 Jalan Tun Sambanthan, Brickfields, 50470 Kuala Lumpur",
				city: "KUALA_LUMPUR",
				contactPhone: "+60322742001",
			},
			{ code: "sentul", area: "Sentul", addressText: "7 Jalan Sentul Pasar, Sentul, 51100 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60340412002" },
			{
				code: "kampung-baru",
				area: "Kampung Baru",
				addressText: "30 Jalan Raja Muda Musa, Kampung Baru, 50300 Kuala Lumpur",
				city: "KUALA_LUMPUR",
				contactPhone: "+60326922003",
			},
		],
	},
	{
		key: "nyonya-bakehouse",
		slug: "nyonya-batik-bakehouse",
		displayName: "Nyonya Batik Bakehouse",
		legalName: "Batik Bakehouse Melaka Sdn Bhd",
		category: "food",
		imageSets: ["nyonya-kuih", "croissant", "cake"],
		ownerName: "Tan Mei Ling",
		registrationNo: "201901056789",
		items: [
			{ name: "Pineapple tart box", sku: "NB-PINEAPPLE-TART", priceMinor: 2_800 },
			{ name: "Kuih lapis slice", sku: "NB-KUIH-LAPIS", priceMinor: 300 },
			{ name: "Pandan chiffon", sku: "NB-PANDAN-CHIFFON", priceMinor: 2_200 },
			{ name: "Onde-onde dozen", sku: "NB-ONDE-ONDE", priceMinor: 900 },
			{ name: "Gula Melaka cake", sku: "NB-GULA-CAKE", priceMinor: 3_500 },
			{ name: "Kuih bangkit tin", sku: "NB-KUIH-BANGKIT", priceMinor: 2_600 },
			{ name: "Seri muka square", sku: "NB-SERI-MUKA", priceMinor: 350 },
			{ name: "Egg tart pair", sku: "NB-EGG-TART", priceMinor: 600 },
			{ name: "Durian puff", sku: "NB-DURIAN-PUFF", priceMinor: 450 },
			{ name: "Cendol jar", sku: "NB-CENDOL", priceMinor: 800 },
		],
		locations: [
			{ code: "jonker-walk", area: "Jonker Walk", addressText: "66 Jalan Hang Jebat, 75200 Melaka", city: "MELAKA", contactPhone: "+6062833001" },
			{ code: "klebang", area: "Klebang", addressText: "3 Jalan Klebang Besar, 75200 Melaka", city: "MELAKA", contactPhone: "+6063153002" },
			{ code: "ayer-keroh", area: "Ayer Keroh", addressText: "19 Jalan Ayer Keroh Lama, 75450 Melaka", city: "MELAKA", contactPhone: "+6062323003" },
			{ code: "bukit-baru", area: "Bukit Baru", addressText: "41 Jalan Bukit Baru, 75150 Melaka", city: "MELAKA", contactPhone: "+6062833004" },
			{ code: "bandar-hilir", area: "Bandar Hilir", addressText: "9 Jalan Merdeka, Bandar Hilir, 75000 Melaka", city: "MELAKA", contactPhone: "+6062843005" },
		],
	},
	{
		key: "pedal-pump",
		slug: "pedal-and-pump-cycles",
		displayName: "Pedal & Pump Cycles",
		legalName: "Pedal and Pump Cycles PLT",
		category: "retail",
		imageSets: ["loyalty-points-retail", "iced-tea", "merdeka-coffee"],
		ownerName: "Jason Wong",
		registrationNo: "202201067890",
		items: [
			{ name: "Tyre puncture fix", sku: "PP-PUNCTURE", priceMinor: 1_500 },
			{ name: "Chain clean and lube", sku: "PP-CHAIN-LUBE", priceMinor: 2_500 },
			{ name: "Brake tune-up", sku: "PP-BRAKE-TUNE", priceMinor: 4_000 },
			{ name: "Water bottle cage", sku: "PP-BOTTLE-CAGE", priceMinor: 3_500 },
			{ name: "LED light set", sku: "PP-LED-SET", priceMinor: 6_900 },
			{ name: "Padded cycling gloves", sku: "PP-GLOVES", priceMinor: 4_900 },
			{ name: "Full bike service", sku: "PP-FULL-SERVICE", priceMinor: 12_000 },
			{ name: "Inner tube", sku: "PP-INNER-TUBE", priceMinor: 1_800 },
			{ name: "Saddle fitting", sku: "PP-SADDLE-FIT", priceMinor: 5_000 },
			{ name: "Weekend bike rental", sku: "PP-RENTAL", priceMinor: 8_000 },
		],
		locations: [
			{
				code: "desa-parkcity",
				area: "Desa ParkCity",
				addressText: "5 Jalan Intisari Perdana, Desa ParkCity, 52200 Kuala Lumpur",
				city: "KUALA_LUMPUR",
				contactPhone: "+60362804001",
			},
			{ code: "cheras", area: "Cheras", addressText: "88 Jalan Cheras, Taman Connaught, 56000 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60391314002" },
			{ code: "setapak", area: "Setapak", addressText: "14 Jalan Genting Kelang, Setapak, 53300 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60341434003" },
			{
				code: "bukit-jalil",
				area: "Bukit Jalil",
				addressText: "2 Jalan Jalil Perkasa 1, Bukit Jalil, 57000 Kuala Lumpur",
				city: "KUALA_LUMPUR",
				contactPhone: "+60389964004",
			},
		],
	},
	{
		key: "selasih-spa",
		slug: "selasih-spa-wellness",
		displayName: "Selasih Spa & Wellness",
		legalName: "Selasih Wellness Sdn Bhd",
		category: "wellness",
		imageSets: ["yoga-class", "matcha-latte", "iced-tea"],
		ownerName: "Nurul Huda Aziz",
		registrationNo: "202001078901",
		items: [
			{ name: "Urut tradisional (60 min)", sku: "SS-URUT-60", priceMinor: 12_000 },
			{ name: "Lulur body scrub", sku: "SS-LULUR", priceMinor: 9_000 },
			{ name: "Herbal foot soak", sku: "SS-FOOT-SOAK", priceMinor: 4_500 },
			{ name: "Pandan hair mask", sku: "SS-HAIR-MASK", priceMinor: 6_500 },
			{ name: "Aromatherapy add-on", sku: "SS-AROMA", priceMinor: 3_000 },
			{ name: "Hot stone massage", sku: "SS-HOT-STONE", priceMinor: 16_000 },
			{ name: "Express facial", sku: "SS-FACIAL", priceMinor: 8_500 },
			{ name: "Bertungku warm compress", sku: "SS-BERTUNGKU", priceMinor: 5_500 },
			{ name: "Ginger tea and kuih", sku: "SS-GINGER-TEA", priceMinor: 1_500 },
			{ name: "Couple's spa hour", sku: "SS-COUPLE", priceMinor: 25_000 },
		],
		locations: [
			{ code: "bandar-hilir", area: "Bandar Hilir", addressText: "17 Jalan Kota Laksamana 3, 75200 Melaka", city: "MELAKA", contactPhone: "+6062885001" },
			{ code: "ujong-pasir", area: "Ujong Pasir", addressText: "6 Jalan Ujong Pasir, 75050 Melaka", city: "MELAKA", contactPhone: "+6062845002" },
			{ code: "tanjung-kling", area: "Tanjung Kling", addressText: "22 Jalan Pantai Tanjung Kling, 76400 Melaka", city: "MELAKA", contactPhone: "+6063155003" },
		],
	},
	{
		key: "lantern-lane",
		slug: "lantern-lane-books",
		displayName: "Lantern Lane Books",
		legalName: "Lantern Lane Books Sdn Bhd",
		category: "entertainment",
		imageSets: ["live-music-night", "latte-art", "heritage-set"],
		ownerName: "Priya Ramasamy",
		registrationNo: "201701089012",
		items: [
			{ name: "Malaysian fiction paperback", sku: "LL-FICTION", priceMinor: 4_500 },
			{ name: "Children's picture book", sku: "LL-PICTURE-BOOK", priceMinor: 2_900 },
			{ name: "Batik bookmark set", sku: "LL-BOOKMARK", priceMinor: 1_200 },
			{ name: "Poetry chapbook", sku: "LL-POETRY", priceMinor: 2_500 },
			{ name: "Comic omnibus", sku: "LL-COMIC", priceMinor: 6_500 },
			{ name: "Reading-nook latte", sku: "LL-LATTE", priceMinor: 1_200 },
			{ name: "Author talk ticket", sku: "LL-AUTHOR-TALK", priceMinor: 3_000 },
			{ name: "Tote bag", sku: "LL-TOTE", priceMinor: 3_500 },
			{ name: "Cookbook of the month", sku: "LL-COOKBOOK", priceMinor: 8_900 },
			{ name: "Gift wrap service", sku: "LL-GIFT-WRAP", priceMinor: 500 },
		],
		locations: [
			{ code: "klcc", area: "KLCC", addressText: "Lot 3-12, Jalan Ampang, KLCC, 50450 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60321666001" },
			{ code: "bangsar-south", area: "Bangsar South", addressText: "1 Jalan Kerinchi, Bangsar South, 59200 Kuala Lumpur", city: "KUALA_LUMPUR", contactPhone: "+60322886002" },
			{ code: "jonker", area: "Jonker", addressText: "25 Jalan Tukang Emas, 75200 Melaka", city: "MELAKA", contactPhone: "+6062886003" },
			{ code: "melaka-raya", area: "Melaka Raya", addressText: "33 Jalan Melaka Raya 8, 75000 Melaka", city: "MELAKA", contactPhone: "+6062826004" },
			{ code: "kota-laksamana", area: "Kota Laksamana", addressText: "11 Jalan KL 3/8, Kota Laksamana, 75200 Melaka", city: "MELAKA", contactPhone: "+6062836005" },
		],
	},
];

/** The time zone a city's merchants cut their analytics days in. */
export function timeZoneOf(city: NetworkLocationSeed["city"]): string {
	return PILOT_CITY_TIME_ZONES[city];
}

export interface NetworkLocation extends NetworkLocationSeed {
	readonly key: string;
	readonly id: string;
	readonly tenantKey: string;
	readonly tenantId: string;
	readonly name: string;
	readonly isPrimary: boolean;
	/** The till's name on its bills. */
	readonly terminalId: string;
	readonly apiKeyId: string;
}

export interface NetworkTenant extends Omit<NetworkTenantSeed, "locations"> {
	readonly id: string;
	readonly ownerEmail: string;
	readonly ownerMembershipId: string;
	readonly locations: readonly NetworkLocation[];
}

export interface NetworkReward {
	readonly key: string;
	readonly id: string;
	readonly tenantId: string;
	readonly locationId: string;
	readonly title: string;
	readonly description: string;
	readonly rewardType: RewardType;
	readonly rewardValue: number;
	readonly freeItemName: string | null;
	readonly freeItemSku: string | null;
	readonly category: NetworkTenantSeed["category"];
	/** One of its merchant's `imageSets`: the reward's one image is the merchant's copy of that set's cover. */
	readonly imageSet: RewardImageSetSlug;
	readonly minSpendMinor: number;
	readonly minimumTier: CustomerTier;
	readonly startMs: number;
	readonly endMs: number;
}

export interface NetworkCheckout {
	readonly locationKey: string;
	readonly paidAt: number;
	readonly billTotalMinor: number;
	readonly redemptionMethod: RewardRedemptionMethod;
}

export interface NetworkClaim {
	readonly key: string;
	readonly rewardKey: string;
	readonly rewardId: string;
	readonly userId: string;
	readonly status: "REDEEMED" | "EXPIRED";
	readonly claimedAt: number;
	readonly claimExpiresAt: number;
	readonly checkout: NetworkCheckout | null;
}

export interface MerchantNetworkPlan {
	readonly tenants: readonly NetworkTenant[];
	readonly rewards: readonly NetworkReward[];
	readonly claims: readonly NetworkClaim[];
}

export interface MerchantNetworkInput {
	readonly random: SeededRandom;
	readonly nowMs: number;
	/** Customers who visit now and then. */
	readonly customerIds: readonly string[];
	/** Customers who return to five merchants all year (Diamond). */
	readonly loyalCustomerIds: readonly string[];
}

/** A list with nothing in it, where one item was needed: a bug in this file. */
export class EmptyNetworkListError extends Error {
	public constructor(what: string) {
		super(`Merchant network: no ${what} to pick from`);
		this.name = "EmptyNetworkListError";
	}
}

/** The item at `index`, wrapping around the list. */
function cycle<T>(list: readonly T[], index: number, what: string): T {
	const item = list.at(index % Math.max(1, list.length));
	if (item === undefined) {
		throw new EmptyNetworkListError(what);
	}
	return item;
}

/** One of the list, from the PRNG. */
function pickFrom<T>(random: SeededRandom, list: readonly T[], what: string): T {
	if (list.length === 0) {
		throw new EmptyNetworkListError(what);
	}
	return random.pick(list);
}

function ringgit(minor: number): string {
	return `RM${String(Math.round(minor / SEN_PER_RINGGIT))}`;
}

/** The merchants, their owners and branches. */
export function networkTenants(): readonly NetworkTenant[] {
	return NETWORK_TENANTS.map((tenant): NetworkTenant => {
		const id = deterministicUuid(NAMESPACE, `tenant:${tenant.key}`);
		return {
			...tenant,
			id,
			ownerEmail: `owner@${tenant.slug}.demo`,
			ownerMembershipId: deterministicUuid(NAMESPACE, `owner-membership:${tenant.key}`),
			locations: tenant.locations.map((location, index): NetworkLocation => ({
				...location,
				key: `${tenant.key}:${location.code}`,
				id: deterministicUuid(NAMESPACE, `location:${tenant.key}:${location.code}`),
				tenantKey: tenant.key,
				tenantId: id,
				name: `${tenant.displayName} — ${location.area}`,
				isPrimary: index === 0,
				terminalId: `${location.code.toUpperCase()}-TILL-01`,
				apiKeyId: deterministicUuid(NAMESPACE, `pos-key:${tenant.key}:${location.code}`),
			})),
		};
	});
}

function minimumTierOf(index: number): CustomerTier {
	if (index % DIAMOND_EVERY === DIAMOND_EVERY - 1) {
		return "DIAMOND";
	}
	if (index % GOLD_EVERY === GOLD_EVERY - 1) {
		return "GOLD";
	}
	return index % SILVER_EVERY === SILVER_EVERY - 1 ? "SILVER" : "BRONZE";
}

/** One branch's reward `index`: an offer on one of the merchant's goods, for an occasion. */
function rewardFor(random: SeededRandom, nowMs: number, tenant: NetworkTenant, location: NetworkLocation, index: number): NetworkReward {
	const item = cycle(tenant.items, index, "item");
	const occasion = cycle(OCCASIONS, index + location.code.length, "occasion");
	const rewardType = cycle(OFFER_TYPES, index, "offer type");
	const evergreen = index % EVERGREEN_EVERY === 0;
	const startDaysAgo = evergreen ? EVERGREEN_START_DAYS_AGO : random.int(CAMPAIGN_MIN_START_DAYS_AGO, CAMPAIGN_MAX_START_DAYS_AGO);
	const ended = !evergreen && index % ENDED_EVERY === ENDED_EVERY - 1;
	const endDaysAgo = evergreen
		? -EVERGREEN_END_DAYS_FROM_NOW
		: ended
			? Math.max(1, startDaysAgo - random.int(CAMPAIGN_MIN_LENGTH_DAYS, CAMPAIGN_MAX_LENGTH_DAYS))
			: -random.int(RUNNING_MIN_DAYS_LEFT, RUNNING_MAX_DAYS_LEFT);
	const offer = ((): Pick<NetworkReward, "title" | "description" | "rewardValue" | "minSpendMinor" | "freeItemName" | "freeItemSku"> => {
		switch (rewardType) {
			case "DISCOUNT": {
				const percent = cycle(DISCOUNT_PERCENTS, index, "discount");
				return {
					title: `${String(percent)}% off ${item.name} — ${occasion}`,
					description: `${String(percent)}% off ${item.name} at ${location.area}. One per bill.`,
					rewardValue: percent,
					minSpendMinor: item.priceMinor,
					freeItemName: null,
					freeItemSku: null,
				};
			}
			case "FREE_ITEM":
				return {
					title: `Free ${item.name} — ${occasion}`,
					description: `${item.name} on the house with a ${ringgit(item.priceMinor * FREE_ITEM_SPEND_MULTIPLE)} bill at ${location.area}.`,
					rewardValue: 1,
					minSpendMinor: item.priceMinor * FREE_ITEM_SPEND_MULTIPLE,
					freeItemName: item.name,
					freeItemSku: item.sku,
				};
			case "CASHBACK": {
				const back = cycle(CASHBACK_RINGGIT, index, "cashback");
				return {
					title: `RM${String(back)} back on ${item.name} — ${occasion}`,
					description: `RM${String(back)} off your bill when it includes ${item.name}, at ${location.area}.`,
					rewardValue: back,
					minSpendMinor: Math.max(item.priceMinor, back * SEN_PER_RINGGIT * FREE_ITEM_SPEND_MULTIPLE),
					freeItemName: null,
					freeItemSku: null,
				};
			}
			case "POINTS": {
				const multiplier = cycle(POINTS_MULTIPLIERS, index, "points");
				return {
					title: `${String(multiplier)}× points on ${item.name} — ${occasion}`,
					description: `${String(multiplier)}× loyalty points on ${item.name} at ${location.area}.`,
					rewardValue: multiplier,
					minSpendMinor: item.priceMinor,
					freeItemName: null,
					freeItemSku: null,
				};
			}
			case "BOGO":
				return {
					title: `Buy one ${item.name}, get one free — ${occasion}`,
					description: `A second ${item.name} free with the first, at ${location.area}.`,
					rewardValue: 1,
					minSpendMinor: item.priceMinor,
					freeItemName: item.name,
					freeItemSku: item.sku,
				};
		}
	})();
	const key = `${location.key}:${String(index)}`;
	return {
		...offer,
		key,
		id: deterministicUuid(NAMESPACE, `reward:${key}`),
		tenantId: tenant.id,
		locationId: location.id,
		rewardType,
		category: tenant.category,
		imageSet: cycle(tenant.imageSets, index, "image set"),
		minimumTier: minimumTierOf(index),
		startMs: nowMs - startDaysAgo * DAY_MS,
		endMs: nowMs - endDaysAgo * DAY_MS,
	};
}

/** A redeemed claim of a BRONZE reward running at `location` on the day `daysAgo` days back (none running: null). */
function visit(
	random: SeededRandom,
	nowMs: number,
	rewardsAt: readonly NetworkReward[],
	location: NetworkLocation,
	userId: string,
	daysAgo: number,
	key: string,
): NetworkClaim | null {
	const midnight = localMidnight(nowMs, daysAgo);
	const paidAt = duringOpeningHours(random, midnight);
	const claimedAt = Math.min(
		paidAt - MINUTE_MS,
		Math.max(duringOpeningHours(random, midnight - random.int(0, MAX_CLAIM_LEAD_DAYS) * DAY_MS), paidAt - CLAIM_WINDOW_MS + MINUTE_MS),
	);
	// Anyone may claim a Bronze reward; one needing a higher tier is left out, so no redemption breaks the tier rule.
	const running = rewardsAt.filter((reward) => reward.minimumTier === "BRONZE" && reward.startMs <= claimedAt && reward.endMs >= paidAt);
	if (running.length === 0) {
		return null;
	}
	const reward = pickFrom(random, running, "running reward");
	return {
		key,
		rewardKey: reward.key,
		rewardId: reward.id,
		userId,
		status: "REDEEMED",
		claimedAt,
		claimExpiresAt: Math.min(claimedAt + CLAIM_WINDOW_MS, reward.endMs),
		checkout: {
			locationKey: location.key,
			paidAt,
			billTotalMinor: random.int(reward.minSpendMinor, reward.minSpendMinor * BILL_SPREAD),
			redemptionMethod: random.chance(MANUAL_REDEMPTION_SHARE) ? "MANUAL" : "SCAN",
		},
	};
}

/** The merchants, their rewards, and a year of claims: ordinary visits and the loyal customers' round of five merchants. */
export function buildMerchantNetworkPlan(input: MerchantNetworkInput): MerchantNetworkPlan {
	const { random, nowMs, loyalCustomerIds } = input;
	const customerIds = input.customerIds.filter((userId) => !loyalCustomerIds.includes(userId));
	const tenants = networkTenants();
	const rewards: NetworkReward[] = [];
	const rewardsByLocation = new Map<string, readonly NetworkReward[]>();
	for (const tenant of tenants) {
		for (const location of tenant.locations) {
			const atLocation = Array.from({ length: REWARDS_PER_LOCATION }, (_unused, index) => rewardFor(random, nowMs, tenant, location, index));
			rewardsByLocation.set(location.key, atLocation);
			rewards.push(...atLocation);
		}
	}
	const rewardsAt = (location: NetworkLocation): readonly NetworkReward[] => rewardsByLocation.get(location.key) ?? [];

	const claims: NetworkClaim[] = [];
	// Ordinary visits: other customers, now and then, at every branch.
	for (const tenant of tenants) {
		for (const location of tenant.locations) {
			for (let index = 0; index < GENERAL_VISITS_PER_LOCATION && customerIds.length > 0; index += 1) {
				const daysAgo = random.int(GENERAL_LAST_DAYS_AGO, GENERAL_FIRST_DAYS_AGO);
				const key = `general:${location.key}:${String(index)}`;
				const redeemed = visit(random, nowMs, rewardsAt(location), location, pickFrom(random, customerIds, "customer"), daysAgo, key);
				if (redeemed !== null) {
					claims.push(redeemed);
				}
				// Some claims are never redeemed: their window passed.
				if (redeemed !== null && redeemed.claimExpiresAt < nowMs && random.chance(EXPIRED_CLAIM_SHARE)) {
					claims.push({ ...redeemed, key: `${key}:expired`, userId: pickFrom(random, customerIds, "customer"), status: "EXPIRED", checkout: null });
				}
			}
		}
	}
	// The loyal customers: eleven visits to each of five merchants, spread across the year, at their branches in turn.
	const loyalMerchants = tenants.slice(0, LOYAL_MERCHANT_COUNT);
	const spacing = (LOYAL_FIRST_DAYS_AGO - LOYAL_LAST_DAYS_AGO) / LOYAL_VISITS_PER_MERCHANT;
	for (const [customerIndex, userId] of loyalCustomerIds.entries()) {
		for (const [merchantIndex, tenant] of loyalMerchants.entries()) {
			for (let visitIndex = 0; visitIndex < LOYAL_VISITS_PER_MERCHANT; visitIndex += 1) {
				const location = cycle(tenant.locations, visitIndex + customerIndex, "branch");
				// Staggered by customer and merchant, so no two loyal visits share a day and branch.
				const daysAgo = Math.round(LOYAL_FIRST_DAYS_AGO - visitIndex * spacing - customerIndex - merchantIndex * LOYAL_MERCHANT_COUNT);
				const loyal = visit(random, nowMs, rewardsAt(location), location, userId, daysAgo, `loyal:${String(customerIndex)}:${tenant.key}:${String(visitIndex)}`);
				if (loyal !== null) {
					claims.push(loyal);
				}
			}
		}
	}
	return { tenants, rewards, claims };
}
