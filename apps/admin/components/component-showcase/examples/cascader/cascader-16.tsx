"use client";

import * as React from "react";
import { GlobeIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";
import {
	Cascader,
	CascaderContent,
	CascaderEmpty,
	CascaderList,
	CascaderPanel,
	CascaderStatus,
	CascaderTrigger,
	useCascaderSelection,
} from "@workspace/ui/components/cascader/cascader";
import type { CascaderItemState } from "@workspace/ui/components/cascader/cascader-context";
import { CascaderBreadcrumb, CascaderInput, CascaderNav } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";
import { CascaderVirtualItems } from "@workspace/ui/components/cascader/cascader-virtual";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

const globeIcon = <GlobeIcon className="size-4" />;

/* -------------------------------------------------------------------------- */
/*                                    Data                                    */
/* -------------------------------------------------------------------------- */

/**
 * `[iso2, country, cities]`.
 *
 * The cities are one comma separated string rather than a nested array so a
 * country stays one readable line. Four real cities each, which is what the
 * generator below needs to fill a country's share of its region without
 * repeating itself, and few enough to stay accurate for small markets as well
 * as large ones. The flag is derived from the code, see `flagOf`.
 */
type CountrySeed = readonly [string, string, string];

/**
 * `[id, label, markets, countries]`. Six regions, ten countries each, plus the
 * number of markets that region carries.
 *
 * The counts are unequal and un-round on purpose. See the sizing note above the
 * component for why they are these numbers rather than one figure repeated.
 */
const REGIONS: readonly (readonly [string, string, number, readonly CountrySeed[]])[] = [
	[
		"europe",
		"Europe",
		612,
		[
			["DE", "Germany", "Berlin,Munich,Hamburg,Cologne"],
			["FR", "France", "Paris,Lyon,Marseille,Toulouse"],
			["GB", "United Kingdom", "London,Manchester,Birmingham,Glasgow"],
			["IT", "Italy", "Rome,Milan,Naples,Turin"],
			["ES", "Spain", "Madrid,Barcelona,Valencia,Seville"],
			["PL", "Poland", "Warsaw,Krakow,Gdansk,Wroclaw"],
			["NL", "Netherlands", "Amsterdam,Rotterdam,Utrecht,Eindhoven"],
			["BE", "Belgium", "Brussels,Antwerp,Ghent,Liege"],
			["SE", "Sweden", "Stockholm,Gothenburg,Malmo,Uppsala"],
			["PT", "Portugal", "Lisbon,Porto,Braga,Coimbra"],
		],
	],
	[
		"americas",
		"Americas",
		528,
		[
			["US", "United States", "New York,Chicago,Los Angeles,Miami"],
			["BR", "Brazil", "Sao Paulo,Rio de Janeiro,Belo Horizonte,Recife"],
			["MX", "Mexico", "Mexico City,Guadalajara,Monterrey,Puebla"],
			["CO", "Colombia", "Bogota,Medellin,Cali,Barranquilla"],
			["AR", "Argentina", "Buenos Aires,Cordoba,Rosario,Mendoza"],
			["CA", "Canada", "Toronto,Montreal,Vancouver,Calgary"],
			["PE", "Peru", "Lima,Arequipa,Trujillo,Cusco"],
			["VE", "Venezuela", "Caracas,Maracaibo,Valencia,Barquisimeto"],
			["CL", "Chile", "Santiago,Valparaiso,Concepcion,Antofagasta"],
			["EC", "Ecuador", "Quito,Guayaquil,Cuenca,Ambato"],
		],
	],
	[
		"apac",
		"Asia Pacific",
		674,
		[
			["IN", "India", "Mumbai,Delhi,Bengaluru,Chennai"],
			["CN", "China", "Shanghai,Beijing,Shenzhen,Chengdu"],
			["ID", "Indonesia", "Jakarta,Surabaya,Bandung,Medan"],
			["PK", "Pakistan", "Karachi,Lahore,Islamabad,Faisalabad"],
			["JP", "Japan", "Tokyo,Osaka,Nagoya,Fukuoka"],
			["PH", "Philippines", "Manila,Cebu,Davao,Quezon City"],
			["VN", "Vietnam", "Hanoi,Ho Chi Minh City,Da Nang,Can Tho"],
			["TH", "Thailand", "Bangkok,Chiang Mai,Phuket,Khon Kaen"],
			["KR", "South Korea", "Seoul,Busan,Incheon,Daegu"],
			["MY", "Malaysia", "Kuala Lumpur,Penang,Johor Bahru,Ipoh"],
		],
	],
	[
		"africa",
		"Africa",
		431,
		[
			["NG", "Nigeria", "Lagos,Abuja,Kano,Port Harcourt"],
			["ET", "Ethiopia", "Addis Ababa,Dire Dawa,Mekelle,Hawassa"],
			["EG", "Egypt", "Cairo,Alexandria,Giza,Luxor"],
			["CD", "DR Congo", "Kinshasa,Lubumbashi,Goma,Kisangani"],
			["TZ", "Tanzania", "Dar es Salaam,Dodoma,Mwanza,Arusha"],
			["ZA", "South Africa", "Johannesburg,Cape Town,Durban,Pretoria"],
			["KE", "Kenya", "Nairobi,Mombasa,Kisumu,Nakuru"],
			["SD", "Sudan", "Khartoum,Omdurman,Port Sudan,Nyala"],
			["MA", "Morocco", "Casablanca,Rabat,Marrakesh,Tangier"],
			["GH", "Ghana", "Accra,Kumasi,Tamale,Takoradi"],
		],
	],
	[
		"mideast",
		"Middle East",
		386,
		[
			["TR", "Turkiye", "Istanbul,Ankara,Izmir,Bursa"],
			["IR", "Iran", "Tehran,Mashhad,Isfahan,Shiraz"],
			["IQ", "Iraq", "Baghdad,Basra,Mosul,Erbil"],
			["SA", "Saudi Arabia", "Riyadh,Jeddah,Dammam,Mecca"],
			["YE", "Yemen", "Sanaa,Aden,Taiz,Hodeidah"],
			["SY", "Syria", "Damascus,Aleppo,Homs,Latakia"],
			["JO", "Jordan", "Amman,Zarqa,Irbid,Aqaba"],
			["IL", "Israel", "Tel Aviv,Jerusalem,Haifa,Beersheba"],
			["AE", "United Arab Emirates", "Dubai,Abu Dhabi,Sharjah,Al Ain"],
			["OM", "Oman", "Muscat,Salalah,Sohar,Nizwa"],
		],
	],
	[
		"oceania",
		"Oceania",
		317,
		[
			["AU", "Australia", "Sydney,Melbourne,Brisbane,Perth"],
			["NZ", "New Zealand", "Auckland,Wellington,Christchurch,Hamilton"],
			["PG", "Papua New Guinea", "Port Moresby,Lae,Mount Hagen,Madang"],
			["FJ", "Fiji", "Suva,Nadi,Lautoka,Labasa"],
			["SB", "Solomon Islands", "Honiara,Auki,Gizo,Munda"],
			["NC", "New Caledonia", "Noumea,Mont-Dore,Dumbea,Paita"],
			["PF", "French Polynesia", "Papeete,Faaa,Punaauia,Pirae"],
			["VU", "Vanuatu", "Port Vila,Luganville,Isangel,Lakatoro"],
			["WS", "Samoa", "Apia,Vaitele,Faleasiu,Salelologa"],
			["TO", "Tonga", "Nuku'alofa,Neiafu,Haveluloto,Vaini"],
		],
	],
];

/**
 * ISO 3166-1 alpha-2 to its regional indicator pair: "DE" becomes the German
 * flag. The offset from an ASCII letter to its indicator is a constant, so
 * sixty flags cost one line rather than sixty pasted emoji.
 *
 * Emoji rather than an icon package on purpose - the repo already carries flags
 * as plain string data, and a decorative glyph is not worth a registry
 * dependency. Windows Chrome ships no regional indicator glyphs and falls back
 * to the two letters, which still reads as the country beside its name.
 */
const REGIONAL_INDICATOR_OFFSET = 127397;

function flagOf(iso2: string): string {
	return String.fromCodePoint(...Array.from(iso2, (letter: string): number => letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET));
}

interface Market {
	/** Territory inside the country, e.g. "Munich Ring". Never a region name. */
	readonly area: string;
	/** Reachable subscribers, thousands. */
	readonly subscribers: number;
}

/**
 * How a country's markets are split up, in the order a sales directory would
 * add them: the city on its own first, then its metro, then the compass
 * territories, then the ring roads and their segments, then the outskirts.
 *
 * Four cities times these eighteen zones is seventy-two distinct market names
 * per country, and the largest region here gives a country sixty-eight rows -
 * so no row inside a country is ever a duplicate of another, with the margin
 * sitting on the right side of the biggest level rather than the smallest.
 */
const MARKET_ZONES: readonly string[] = [
	"",
	"Metro",
	"North",
	"South",
	"East",
	"West",
	"Central",
	"Northeast",
	"Northwest",
	"Southeast",
	"Southwest",
	"Ring",
	"Corridor",
	"Inner Ring",
	"Outer Ring",
	"North Ring",
	"South Ring",
	"Outskirts",
];

const TOTAL_MARKETS = REGIONS.reduce((total, [, , markets]) => total + markets, 0);

const REGION_SIZES = REGIONS.map(([, , markets]) => markets);
const SMALLEST_REGION = Math.min(...REGION_SIZES);
const LARGEST_REGION = Math.max(...REGION_SIZES);

const COUNTRY_COUNT = REGIONS.reduce((total, [, , , countries]) => total + countries.length, 0);

/**
 * Reach tiers, and the one rule the trailing badge follows: the tone is what
 * the NUMBER means, never a colour picked to break up the list. Read down a
 * level and the ladder is the sales ladder.
 *
 * | reach       | tone    | what it says                            |
 * | ----------- | ------- | --------------------------------------- |
 * | under 250k  | warning | under the floor a territory is sold at  |
 * | 250 to 499k | primary | the standard market                     |
 * | 500 to 749k | info    | large enough to staff on its own        |
 * | 750k and up | success | top tier, carries the country           |
 *
 * `pin` is not decoration. A cascader row carries
 * `data-highlighted:**:text-accent-foreground`, a DESCENDANT rule, so the row
 * under the cursor repaints every element inside it - and a badge whose colour
 * IS the tier would go the same grey as its neighbours exactly when the reader
 * is looking hardest at it. `!` holds the tier through the highlight. The dark
 * half needs its own because the `*-light` variants swap token there.
 *
 * No `size`, so the badge is the default h-5. That is the same twenty pixels
 * `text-sm` already gives the label in six of the eight styles, and in the two
 * that set a smaller type scale the padding still lands the row at or under the
 * 36 the virtualizer estimates - so the estimate below stays honest.
 */
interface ReachTier {
	/** Lowest reach, in thousands, that still lands in this tier. */
	readonly floor: number;
	readonly variant: BadgeProps["variant"];
	readonly pin: string;
}

/** The bottom rung, which every reach clears: also the fallback of the lookup. */
const UNDER_FLOOR_TIER: ReachTier = {
	floor: 0,
	variant: "warning-light",
	pin: "text-warning-foreground! dark:text-warning!",
};

const REACH_TIERS: readonly ReachTier[] = [
	{
		floor: 750,
		variant: "success-light",
		pin: "text-success-foreground! dark:text-success!",
	},
	{
		floor: 500,
		variant: "info-light",
		pin: "text-info-foreground! dark:text-info!",
	},
	{
		floor: 250,
		variant: "primary-light",
		pin: "text-primary! dark:text-primary!",
	},
	UNDER_FLOOR_TIER,
];

function reachTier(subscribers: number): ReachTier {
	return REACH_TIERS.find((tier: ReachTier): boolean => subscribers >= tier.floor) ?? UNDER_FLOOR_TIER;
}

/**
 * Deterministic 32 bit mix. The badge number has to survive scrolling:
 * `Math.random` here would give a windowed row a new metric every time it left
 * the window and came back, which reads as a bug rather than as data.
 */
function mix(n: number): number {
	let h = (n ^ 0x9e3779b9) >>> 0;
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
}

/** Smallest reach a generated market reports, and the spread above it, in thousands. */
const MIN_SUBSCRIBERS = 40;
const SUBSCRIBER_SPREAD = 960;
/** Primes that keep the region, the row and the country apart in the seed. */
const REGION_SEED_PRIME = 7919;
const ROW_SEED_PRIME = 31;

/** One country, prepared once per region: its flag element and its city list. */
interface CountryRows {
	readonly iso2: string;
	readonly country: string;
	readonly cities: readonly string[];
	readonly flag: React.JSX.Element;
}

/**
 * One flag element per COUNTRY, hoisted out of the row loop: sixty shared
 * elements rather than one throwaway per market. `leading-none` stops the
 * emoji, which carries a generous line box of its own, from setting the height
 * of every row in the list.
 */
function prepareCountry([iso2, country, list]: CountrySeed): CountryRows {
	return {
		iso2,
		country,
		cities: list.split(","),
		flag: (
			<span aria-hidden="true" className="text-base leading-none">
				{flagOf(iso2)}
			</span>
		),
	};
}

/**
 * One market row. `k` is the per-country ordinal: the city cycles fastest and
 * the zone advances once the cities have been through, so a country's rows
 * read Berlin, Munich, ..., then Berlin Metro, Munich Metro, and so on.
 */
function marketRow(regionId: string, regionIndex: number, rowIndex: number, k: number, seed: CountryRows): CascaderNode<Market> {
	// Wrapped rather than indexed straight in, so a country seeded with a
	// shorter city list still lands on a zone instead of on `undefined`.
	const zone = MARKET_ZONES[Math.floor(k / seed.cities.length) % MARKET_ZONES.length] ?? "";
	const city = seed.cities[k % seed.cities.length] ?? seed.country;
	const area = zone === "" ? city : `${city} ${zone}`;

	return {
		value: `${regionId}.${seed.iso2.toLowerCase()}.${String(k)}`,
		label: seed.country,
		icon: seed.flag,
		// Typing "Munich" or "DE" finds the row even though neither word is
		// its label: keywords are matched alongside it.
		keywords: [area, seed.iso2],
		data: {
			area,
			// The region index is folded into the seed as well as the row's, or
			// the same ordinal in two regions whose countries happen to share a
			// first letter would report the same reach.
			subscribers: MIN_SUBSCRIBERS + (mix(regionIndex * REGION_SEED_PRIME + rowIndex * ROW_SEED_PRIME + seed.iso2.charCodeAt(0)) % SUBSCRIBER_SPREAD),
		},
	};
}

/**
 * Round robin over the countries rather than a country's whole run and then
 * the next one's, so any screenful of rows carries ten flags and ten country
 * names instead of one repeated eight times. A region whose count does not
 * divide by ten simply leaves the first few countries one row longer, which is
 * what an uneven catalogue looks like.
 */
function regionMarkets(regionId: string, regionIndex: number, markets: number, seeds: readonly CountryRows[]): CascaderNode<Market>[] {
	const rows: CascaderNode<Market>[] = [];
	if (seeds.length === 0) return rows;
	for (let k = 0; rows.length < markets; k += 1) {
		for (const seed of seeds) {
			if (rows.length >= markets) break;
			rows.push(marketRow(regionId, regionIndex, rows.length, k, seed));
		}
	}
	return rows;
}

function buildDirectory(): readonly CascaderNode<Market>[] {
	return REGIONS.map(([regionId, regionLabel, markets, countries], regionIndex: number): CascaderNode<Market> => ({
		value: regionId,
		label: regionLabel,
		icon: globeIcon,
		children: regionMarkets(regionId, regionIndex, markets, countries.map(prepareCountry)),
	}));
}

/** Estimated height of a one-line row before it is measured, in px. */
const ROW_ESTIMATE_PX = 36;
/** The scrollport cap the virtualizer divides into rows, in px. */
const LIST_MAX_HEIGHT_PX = 288;
const NO_MARKETS: readonly CascaderNode<Market>[] = [];

/** Branches read as plain labels; a market row gets its territory and a reach badge. */
function renderMarketLabel(node: CascaderNode<Market>, state: CascaderItemState<CascaderNode<Market>>): React.ReactNode {
	if (state.branch) {
		return <span className="w-full truncate text-start font-medium">{node.label}</span>;
	}

	const subscribers = node.data?.subscribers ?? 0;
	const tier = reachTier(subscribers);

	return (
		<span className="flex w-full min-w-0 items-center gap-2">
			<span className="min-w-0 flex-1 truncate text-start">{node.label}</span>
			<span className="min-w-0 truncate text-xs text-muted-foreground">{node.data?.area}</span>
			<Badge variant={tier.variant} className={cn("shrink-0 tabular-nums", tier.pin)}>
				{subscribers}k
				{/* The row's accessible name is its text, and a bare "612k"
                    read out after a country name means nothing. */}
				<span className="sr-only"> subscribers</span>
			</Badge>
		</span>
	);
}

/**
 * The default trigger renders the whole path, which here would say
 * "Europe > Germany": the region again, then a country that dozens of rows
 * share. So it names what was actually picked instead, on the row's own terms -
 * country first, territory after it. The selection hook is handed the typed
 * tree, so `data` comes back as a `Market` without a cast.
 */
function MarketValue({ items }: { readonly items: readonly CascaderNode<Market>[] }): React.JSX.Element {
	const { first } = useCascaderSelection<Market>(items);

	if (first === null) {
		return <span className="truncate text-muted-foreground">Select a market</span>;
	}

	return (
		<span className="flex min-w-0 flex-1 items-center gap-2">
			{first.icon}
			<span className="min-w-0 truncate">{first.label}</span>
			<span className="min-w-0 truncate text-xs text-muted-foreground">{first.data?.area}</span>
		</span>
	);
}

/**
 * Windowed levels.
 *
 * `CascaderVirtualItems` is a drop-in replacement for `CascaderItems`: below
 * `virtualizeThreshold` rows it renders exactly what `CascaderItems` renders,
 * and above it, it windows. The region level here is six rows and stays plain
 * DOM; drilling into one switches the same list to windowing without touching
 * the keyboard model, the search or the row component.
 *
 * ## The row
 *
 * A windowed row is the one row a demo cannot fake, so it is worth making it a
 * real one: a flag, a country, the market inside it and a reach figure, all on
 * a single line. The composition is the data grid's - a leading glyph, a label
 * that gives way, a trailing metric - translated to a list row, where
 * "trailing" has to be earned by `flex-1` on the label rather than granted by a
 * column. Only the country and the market give way; the badge holds its width,
 * because a cut number is worse than a shortened name.
 *
 * The COUNTRY is the label and the market territory is the muted second slot,
 * which is the way round a reader scans it: the country is what tells you where
 * you are, and the territory only separates the several dozen rows that share
 * it. The region is named once, by the breadcrumb above the list, and never
 * repeated down the rows - a level whose every row re-states the level it is in
 * wastes the widest part of the row on the one word already on screen.
 *
 * The flag goes on `node.icon` rather than into `renderLabel`. The primitive's
 * icon slot is already the leading, `shrink-0` position the pattern wants, and
 * putting it there means the closed trigger shows the flag beside the chosen
 * market for free.
 *
 * The badge is toned by reach rather than left neutral, on the rule tabled at
 * `REACH_TIERS`. A metric that is always the same grey is a metric the reader
 * has to actually read before it means anything; four tones let a scroll answer
 * "where are the big markets" without stopping on a single row.
 *
 * Rows are one line tall, so the estimate is 36 - but only until they mount.
 * Every row is measured after it renders, which is what keeps the scroll
 * position and the highlight in agreement across the eight styles, each of
 * which sets its own row height.
 *
 * ## Why the regions are the sizes they are
 *
 * The earlier version of this example booted with a deep initial value and a
 * 2,500-row level, and it opened badly: a blank frame, a long freeze, then
 * rows. Neither half of that was the windowing.
 *
 * `revealSelected` (on by default) navigates to the level holding the current
 * selection IN THE SAME COMMIT that opens the popup, so with a deep initial
 * value the popup's very first mount lands on the big level rather than on the
 * six-row root. Measured in jsdom, at 2,500 rows per level:
 *
 * | what                                  | cost   |
 * | ------------------------------------- | ------ |
 * | open, deep preselection, reveal on     | 865 ms |
 * | open, deep preselection, reveal off    | 16 ms  |
 * | open at the root, then drill into it   | 13 ms  |
 * | type into the 2,500-row level          | 9 ms   |
 *
 * So the level itself is cheap to render, to filter and to window - it is
 * mounting the popup ONTO it that is not, and the cost is Base UI's per-item
 * work at mount rather than the DOM (plain rows measured 453 ms against the
 * window's 668 ms on the same data). The blank frame is the level-swap reset
 * that has to render one empty list to clamp the highlighted index, which is
 * exactly the "flickering" part.
 *
 * Two consequences, both applied here. Starting unselected means the first open
 * is the six-row root. And because `CascaderContent` unmounts on close, every
 * REOPEN after a deep pick pays that mount again - 483 ms at 2,500 rows against
 * 85 ms at 500 - so the constraint is on the LARGEST level, not on the total.
 * Asia Pacific's 674 is the largest here, which sits with the 500 that measured
 * 85 ms rather than anywhere near the 2,500 that measured 483.
 *
 * Under that ceiling the counts differ per region, because a real catalogue's
 * do. The previous revision gave all six the same round 500, and the one number
 * a reader could actually check - the child count the primitive prints on each
 * region row - came out identical six times down the root level, which reads as
 * a placeholder rather than as a directory. Each region now carries its own
 * figure, 317 through 674, still every one of them multiples past
 * `virtualizeThreshold` and 2,948 rows overall: far past the point where plain
 * DOM rows stop being viable, and windowing is visibly working on the smallest
 * level as well as on the biggest.
 */
export function Cascader16Example(): React.JSX.Element {
	// Built off the render path: ~3,000 nodes is ~10ms of allocation, and
	// blocking the first paint with it is exactly the "nothing happened" moment
	// this example is supposed to be free of.
	const [items, setItems] = useState<readonly CascaderNode<Market>[] | null>(null);
	const [value, setValue] = useState("");

	const handleValueChange = useCallback((next: string): void => {
		setValue(next);
	}, []);

	useEffect((): (() => void) => {
		const frame = requestAnimationFrame((): void => {
			setItems(buildDirectory());
		});
		return (): void => {
			cancelAnimationFrame(frame);
		};
	}, []);

	return (
		<div className="flex w-full flex-col items-center gap-2 p-4">
			<Cascader
				items={items ?? NO_MARKETS}
				value={value}
				onValueChange={handleValueChange}
				disabled={items === null}
				estimateRowSize={ROW_ESTIMATE_PX}
				renderLabel={renderMarketLabel}>
				<CascaderTrigger aria-label="Market" render={<Button variant="outline" className="w-80 justify-between gap-2 font-normal" />}>
					{items === null ? (
						<span className="flex items-center gap-2 text-muted-foreground">
							<Spinner className="size-4" />
							Loading {TOTAL_MARKETS.toLocaleString()} markets...
						</span>
					) : (
						<MarketValue items={items} />
					)}
				</CascaderTrigger>

				<CascaderContent className="w-80">
					<CascaderPanel>
						<CascaderNav>
							<CascaderInput />
						</CascaderNav>
						<CascaderBreadcrumb />
						<CascaderEmpty />
						{/* Kept deliberately. The windowing IS the subject here, and a
                windowed list needs a scrollport with a height it can divide
                into rows - so the cap is part of the demonstration rather than
                a stand-in for one. */}
						<CascaderList maxHeight={LIST_MAX_HEIGHT_PX}>
							<CascaderVirtualItems />
						</CascaderList>
						<CascaderStatus />
					</CascaderPanel>
				</CascaderContent>
			</Cascader>

			<p className="text-xs text-muted-foreground">
				{TOTAL_MARKETS.toLocaleString()} markets in {COUNTRY_COUNT} countries, {SMALLEST_REGION.toLocaleString()} to {LARGEST_REGION.toLocaleString()} per region across{" "}
				{REGIONS.length} regions.
			</p>
		</div>
	);
}
