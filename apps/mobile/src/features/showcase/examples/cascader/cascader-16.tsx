import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text } from "react-native";

interface Country {
	readonly code: string;
	readonly name: string;
	readonly flag: string;
}

const COUNTRIES: readonly Country[] = [
	{ code: "us", name: "United States", flag: "🇺🇸" },
	{ code: "gb", name: "United Kingdom", flag: "🇬🇧" },
	{ code: "de", name: "Germany", flag: "🇩🇪" },
	{ code: "fr", name: "France", flag: "🇫🇷" },
	{ code: "jp", name: "Japan", flag: "🇯🇵" },
	{ code: "br", name: "Brazil", flag: "🇧🇷" },
	{ code: "in", name: "India", flag: "🇮🇳" },
	{ code: "au", name: "Australia", flag: "🇦🇺" },
];

/** Territories per country: with 8 countries, nearly 3,000 markets. */
const TERRITORIES_PER_COUNTRY = 370;
const TIERS: readonly { readonly label: string; readonly tone: BadgeTone }[] = [
	{ label: "Gold", tone: "warning" },
	{ label: "Silver", tone: "neutral" },
	{ label: "Bronze", tone: "info" },
];

const MARKETS: readonly CascaderNode[] = COUNTRIES.flatMap((country: Country): CascaderNode[] =>
	Array.from({ length: TERRITORIES_PER_COUNTRY }, (_market: undefined, index: number): CascaderNode => ({
		value: `${country.code}-${String(index + 1)}`,
		label: `${country.name} territory ${String(index + 1)}`,
		icon: <Text className="text-body-lg">{country.flag}</Text>,
		keywords: [TIERS.at(index % TIERS.length)?.label ?? ""],
	})),
);

/** The market's reach tier. */
function TierBadge(node: CascaderNode): React.ReactNode {
	const tier = TIERS.find((candidate): boolean => (node.keywords ?? []).includes(candidate.label));
	return tier === undefined ? null : <Badge label={tier.label} tone={tier.tone} size="sm" />;
}

export function Cascader16Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Cascader label="Market" items={MARKETS} value={value} onChange={setValue} renderTrailing={TierBadge} placeholder={`Search ${String(MARKETS.length)} markets`} />;
}
