import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import { Badge } from "@workspace/ui-native/components/badge";
import { Icon } from "@workspace/ui-native/components/icon";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, Text, View, type ScrollViewInstance, type ViewInstance } from "react-native";

import { Screen } from "../../components/screen";
import { SHOWCASE_FEATURE_INDEX } from "./generated/feature-index";
import {
	NOT_SHOWN_MODULES,
	SHOWCASE_CATALOG_ORDER,
	SHOWCASE_ENTRIES,
	SHOWCASE_FAMILIES,
	type NotShownModule,
	type ShowcaseComponentKey,
	type ShowcaseFamily,
	type ShowcaseFamilyId,
} from "./showcase-catalog";
import type { ShowcaseFeatureSummary } from "./showcase-feature";
import { SHOWCASE_FAMILY_META } from "./showcase-family-meta";
import { SHOWCASE_ROUTES } from "./showcase-routes";
import { ShowcaseSearch } from "./showcase-search";

/** Feature names a component card previews before the count. */
const PREVIEWED_FEATURES = 3;

const TOTAL_FEATURES = [...SHOWCASE_FEATURE_INDEX.values()].reduce((sum: number, features: readonly ShowcaseFeatureSummary[]): number => sum + features.length, 0);
const PAGE_TITLE = "Component showcase";
const PAGE_DESCRIPTION = `${String(SHOWCASE_CATALOG_ORDER.length)} UI kit components and their ${String(TOTAL_FEATURES)} features, each running live beside the exact code that renders it. Search above, or browse by family.`;

/** "3 features" / "1 feature". */
export function featureCountLabel(count: number): string {
	return count === 1 ? "1 feature" : `${String(count)} features`;
}

interface ComponentCardProps {
	readonly componentKey: ShowcaseComponentKey;
}

/** One component: its name, what it is for, how many features its screen shows, and the first few of them. */
const ComponentCard = React.memo(function ComponentCard({ componentKey }: ComponentCardProps): React.JSX.Element {
	const router = useRouter();
	const entry = SHOWCASE_ENTRIES[componentKey];
	const features = SHOWCASE_FEATURE_INDEX.get(entry.slug) ?? [];
	const previewed = features
		.slice(0, PREVIEWED_FEATURES)
		.map((feature: ShowcaseFeatureSummary): string => feature.label)
		.join(" · ");
	const onPress = React.useCallback((): void => {
		router.push(SHOWCASE_ROUTES.component(entry.slug));
	}, [entry.slug, router]);
	return (
		<Pressable
			accessibilityRole="link"
			accessibilityLabel={`${entry.name}, ${featureCountLabel(features.length)}`}
			accessibilityHint={entry.description}
			onPress={onPress}
			className="rounded-card active:bg-surface-selected gap-3 border border-border bg-card p-4"
			testID={`showcase-card-${entry.slug}`}>
			<View className="flex-row items-start justify-between gap-3">
				<Text className="text-body font-mono text-foreground">{entry.name}</Text>
				<Icon icon={ArrowRightIcon} size="sm" colorClassName="accent-icon" />
			</View>
			<Text numberOfLines={2} className="text-body font-sans text-muted-foreground">
				{entry.description}
			</Text>
			<View className="flex-row items-center gap-2">
				<Badge label={featureCountLabel(features.length)} size="sm" />
				<Text numberOfLines={1} className="text-caption shrink font-sans text-muted-foreground">
					{previewed}
				</Text>
			</View>
		</Pressable>
	);
});

interface FamilySectionProps {
	readonly family: ShowcaseFamily;
	readonly sectionRef: React.Ref<ViewInstance>;
}

/** One family: its heading, then a card per component. */
function FamilySection({ family, sectionRef }: FamilySectionProps): React.JSX.Element {
	const meta = SHOWCASE_FAMILY_META[family.id];
	return (
		<View ref={sectionRef} className="gap-4" testID={`showcase-${family.id}`}>
			<View className="flex-row items-center gap-3">
				<IconTile icon={meta.icon} tone={meta.tone} size="sm" />
				<View className="flex-1 gap-0.5">
					<Text accessibilityRole="header" className="text-h3 font-heading text-foreground">
						{family.title}
					</Text>
					<Text className="text-body font-sans text-muted-foreground">{meta.summary}</Text>
				</View>
			</View>
			<View className="gap-3">
				{family.keys.map((key: ShowcaseComponentKey): React.JSX.Element => (
					<ComponentCard key={key} componentKey={key} />
				))}
			</View>
		</View>
	);
}

interface FamilyChipProps {
	readonly family: ShowcaseFamily;
	readonly onPress: (id: ShowcaseFamilyId) => void;
}

const FamilyChip = React.memo(function FamilyChip({ family, onPress }: FamilyChipProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPress(family.id);
	}, [family.id, onPress]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${family.title}, ${String(family.keys.length)} components`}
			onPress={press}
			className="rounded-button active:bg-surface-selected min-h-11 flex-row items-center gap-2 border border-border px-3">
			<Text className="text-label font-sans-medium text-foreground">{family.title}</Text>
			{/* Centred on the label: a badge keeps to its own height (`self-start`), which in a row would lift it to the top. */}
			<Badge label={String(family.keys.length)} size="sm" className="self-center" />
		</Pressable>
	);
});

/**
 * The showcase's index: every UI kit component, family by family, as a card
 * that opens its own screen (every feature, live, with its code). Nothing here
 * runs an example, so the screen is light whatever the catalog's size.
 */
export function ShowcaseIndexScreen(): React.JSX.Element {
	const scrollRef = React.useRef<ScrollViewInstance | null>(null);
	const familyRefs = React.useRef(new Map<ShowcaseFamilyId, ViewInstance | null>());
	const refFor = React.useCallback(
		(id: ShowcaseFamilyId) =>
			(node: ViewInstance | null): void => {
				familyRefs.current.set(id, node);
			},
		[],
	);
	const scrollToFamily = React.useCallback((id: ShowcaseFamilyId): void => {
		const section = familyRefs.current.get(id);
		const scroller = scrollRef.current;
		if (section === null || section === undefined || scroller === null) {
			return;
		}
		const content = scroller.getInnerViewRef();
		if (content !== null) {
			section.measureLayout(content, (_x: number, y: number): void => {
				scroller.scrollTo({ y, animated: true });
			});
		}
	}, []);
	return (
		<Screen stickyHeader={<ShowcaseSearch />} scrollRef={scrollRef} testID="showcase-index">
			<View className="gap-1">
				<Text accessibilityRole="header" className="text-h1 font-sans-bold text-foreground">
					{PAGE_TITLE}
				</Text>
				<Text className="text-body font-sans text-muted-foreground">{PAGE_DESCRIPTION}</Text>
			</View>
			<View accessibilityLabel="Component families" className="flex-row flex-wrap gap-2">
				{SHOWCASE_FAMILIES.map((family: ShowcaseFamily): React.JSX.Element => (
					<FamilyChip key={family.id} family={family} onPress={scrollToFamily} />
				))}
			</View>
			{SHOWCASE_FAMILIES.map((family: ShowcaseFamily): React.JSX.Element => (
				<FamilySection key={family.id} family={family} sectionRef={refFor(family.id)} />
			))}
			<View className="gap-2 border-t border-border pt-6">
				<Text accessibilityRole="header" className="text-label font-sans-semibold text-foreground">
					Not shown here
				</Text>
				<Text className="text-body font-sans text-muted-foreground">{"The kit's infrastructure is built into every component above, so it has no standalone example:"}</Text>
				{NOT_SHOWN_MODULES.map((item: NotShownModule): React.JSX.Element => (
					<Text key={item.module} className="text-body font-sans text-muted-foreground">
						{`• ${item.reason}`}
					</Text>
				))}
			</View>
		</Screen>
	);
}
