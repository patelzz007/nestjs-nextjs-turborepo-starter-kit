import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import BookOpenIcon from "lucide-react-native/icons/book-open";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import InfoIcon from "lucide-react-native/icons/info";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { ErrorState } from "@workspace/ui-native/components/empty";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { useRouter } from "expo-router";
import * as React from "react";
import { Linking, Pressable, Text, View, type ScrollViewInstance } from "react-native";

import { Screen } from "../../components/screen";
import { SHOWCASE_CONTENT } from "./generated/content";
import { SHOWCASE_FEATURE_INDEX } from "./generated/feature-index";
import { SHOWCASE_FEATURE_SETS } from "./generated/feature-sets";
import { showcaseNeighbours, type ShowcaseCatalogItem } from "./showcase-catalog";
import type { ShowcaseContent, ShowcaseOverview } from "./showcase-content";
import { MissingShowcaseFeaturesError } from "./showcase-errors";
import { SHOWCASE_FAMILY_META } from "./showcase-family-meta";
import { ShowcaseFaq } from "./showcase-faq";
import type { ShowcaseComponentModule, ShowcaseFeatureSummary } from "./showcase-feature";
import { ShowcaseFeatureList, type FeatureTarget } from "./showcase-feature-list";
import { ShowcaseGuidelines } from "./showcase-guidelines";
import { featureCountLabel } from "./showcase-index-screen";
import { FeatureSetLoading } from "./showcase-loading";
import { ShowcaseMarkdown } from "./showcase-markdown";
import { SHOWCASE_ROUTES } from "./showcase-routes";
import { ShowcaseSearch } from "./showcase-search";
import { useLoaded } from "./use-loaded";

/** ReUI's plans page: the components here are adapted from ReUI, whose Pro blocks build on them (as on the web). */
const REUI_PRICING_URL = "https://reui.io/pricing";

interface NeighbourLinkProps {
	readonly item: ShowcaseCatalogItem;
	readonly direction: "previous" | "next";
}

function NeighbourLink({ item, direction }: NeighbourLinkProps): React.JSX.Element {
	const router = useRouter();
	const isNext = direction === "next";
	const onPress = React.useCallback((): void => {
		router.replace(SHOWCASE_ROUTES.component(item.entry.slug));
	}, [item.entry.slug, router]);
	return (
		<Pressable
			accessibilityRole="link"
			accessibilityLabel={`${isNext ? "Next" : "Previous"}: ${item.entry.name}`}
			onPress={onPress}
			className={`rounded-card active:bg-surface-selected flex-1 gap-1 border border-border bg-card p-4 ${isNext ? "items-end" : "items-start"}`}>
			<View className="flex-row items-center gap-1">
				{isNext ? null : <Icon icon={ArrowLeftIcon} size="sm" colorClassName="accent-icon" />}
				<Text className="text-caption font-sans text-muted-foreground">{isNext ? "Next" : "Previous"}</Text>
				{isNext ? <Icon icon={ArrowRightIcon} size="sm" colorClassName="accent-icon" /> : null}
			</View>
			<Text className="text-body font-mono text-foreground">{item.entry.name}</Text>
		</Pressable>
	);
}

/** A bullet list of inline Markdown items. */
function markdownList(items: readonly string[]): string {
	return items.map((item: string): string => `- ${item}`).join("\n");
}

interface GuidancePanelProps {
	readonly title: string;
	readonly icon: LucideIcon;
	readonly iconColor: string;
	readonly items: readonly string[];
}

function GuidancePanel({ title, icon, iconColor, items }: GuidancePanelProps): React.JSX.Element {
	return (
		<View accessibilityLabel={title} className="rounded-card gap-2 border border-border bg-card p-4">
			<View className="flex-row items-center gap-2">
				<Icon icon={icon} size="sm" colorClassName={iconColor} />
				<Text accessibilityRole="header" className="text-label font-sans-semibold text-foreground">
					{title}
				</Text>
			</View>
			<ShowcaseMarkdown source={markdownList(items)} />
		</View>
	);
}

/** When to reach for the component, when not to, and what to know first. */
function Guidance({ overview }: { readonly overview: ShowcaseOverview }): React.JSX.Element {
	return (
		<View className="gap-4" testID="showcase-guidance">
			<GuidancePanel title="When to use" icon={CircleCheckIcon} iconColor="accent-success" items={overview.whenToUse} />
			<GuidancePanel title="When not to use" icon={CircleXIcon} iconColor="accent-destructive" items={overview.whenNotToUse} />
			{overview.notes.length === 0 ? null : <GuidancePanel title="Notes" icon={InfoIcon} iconColor="accent-info" items={overview.notes} />}
		</View>
	);
}

/** The closing call to action: the components here are adapted from ReUI. */
function ReuiProCallToAction(): React.JSX.Element {
	const open = React.useCallback((): void => {
		Linking.openURL(REUI_PRICING_URL).catch((): void => {
			// No browser could open it: nothing to do.
		});
	}, []);
	return (
		<View accessibilityLabel="ReUI Pro" className="rounded-card items-start gap-3 border border-border bg-muted p-5">
			<View className="gap-1">
				<Text className="text-body-lg font-sans-semibold text-foreground">Start building with ReUI Pro today.</Text>
				<Text className="text-body font-sans text-muted-foreground">These components are adapted from ReUI, whose Pro blocks compose them into complete pages.</Text>
			</View>
			<Button label="See ReUI pricing" icon={ArrowUpRightIcon} variant="outline" size="sm" onPress={open} />
		</View>
	);
}

interface FeatureChipProps {
	readonly feature: ShowcaseFeatureSummary;
	readonly onPress: (anchor: string) => void;
}

const FeatureChip = React.memo(function FeatureChip({ feature, onPress }: FeatureChipProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPress(feature.anchor);
	}, [feature.anchor, onPress]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Go to ${feature.label}`}
			onPress={press}
			className="rounded-button active:bg-surface-selected min-h-9 justify-center border border-border px-3">
			<Text className="text-caption font-sans-medium text-foreground">{feature.label}</Text>
		</Pressable>
	);
});

export interface ShowcaseComponentScreenProps {
	readonly item: ShowcaseCatalogItem;
	/** The feature a link points at (`?feature=`), scrolled to once it is drawn. */
	readonly feature?: string | undefined;
}

/**
 * One component's screen, laid out like the web's (and reui.io's): its name
 * and purpose with a link to its docs, when to use it, every feature (live
 * preview and code), its Do / Don't pairs, the overview, the FAQ, then its
 * neighbours in catalog order.
 */
export function ShowcaseComponentScreen({ item, feature }: ShowcaseComponentScreenProps): React.JSX.Element {
	const router = useRouter();
	const { key, entry, family } = item;
	const meta = SHOWCASE_FAMILY_META[family.id];
	const features = SHOWCASE_FEATURE_INDEX.get(entry.slug) ?? [];
	const { previous, next } = showcaseNeighbours(key);
	const scrollRef = React.useRef<ScrollViewInstance | null>(null);
	const [target, setTarget] = React.useState<FeatureTarget>({ anchor: feature, request: 0 });
	const goToFeature = React.useCallback((anchor: string): void => {
		setTarget((current: FeatureTarget): FeatureTarget => ({ anchor, request: current.request + 1 }));
	}, []);
	const loadModule = React.useCallback((): Promise<ShowcaseComponentModule> => {
		const load = SHOWCASE_FEATURE_SETS.get(entry.slug);
		return load === undefined ? Promise.reject(new MissingShowcaseFeaturesError(entry.slug)) : load();
	}, [entry.slug]);
	const loadContent = React.useCallback((): Promise<ShowcaseContent | null> => SHOWCASE_CONTENT.get(entry.slug)?.() ?? Promise.resolve(null), [entry.slug]);
	const { state: module, retry: retryModule } = useLoaded(loadModule);
	const { state: content } = useLoaded(loadContent);
	const overview = content.status === "ready" ? (content.value?.overview ?? null) : null;
	const openDocs = React.useCallback((): void => {
		router.push(SHOWCASE_ROUTES.docs(entry.slug));
	}, [entry.slug, router]);
	const openIndex = React.useCallback((): void => {
		router.navigate(SHOWCASE_ROUTES.index);
	}, [router]);
	return (
		<Screen stickyHeader={<ShowcaseSearch />} scrollRef={scrollRef} testID={`showcase-component-${entry.slug}`}>
			<View className="gap-4 border-b border-border pb-6">
				<View accessibilityLabel="Breadcrumb" className="flex-row flex-wrap items-center gap-2">
					<Pressable accessibilityRole="link" accessibilityLabel="Showcase" onPress={openIndex} className="min-h-9 justify-center">
						<Text className="text-body font-sans text-muted-foreground">Showcase</Text>
					</Pressable>
					<Text className="text-body font-sans text-muted-foreground">/</Text>
					<View className="flex-row items-center gap-2">
						<IconTile icon={meta.icon} tone={meta.tone} size="sm" />
						<Text className="text-body font-sans text-muted-foreground">{family.title}</Text>
					</View>
				</View>
				<Text accessibilityRole="header" className="text-h1 font-mono text-foreground">
					{entry.name}
				</Text>
				<Button label="Docs & API" icon={BookOpenIcon} variant="outline" size="sm" onPress={openDocs} className="self-start" />
				<Text className="text-body-lg font-sans text-muted-foreground">{entry.description}</Text>
				<Badge label={featureCountLabel(features.length)} className="self-start" />
			</View>
			{overview === null ? null : <Guidance overview={overview} />}
			<View className="gap-6">
				<Text accessibilityRole="header" className="text-h2 font-sans-bold text-foreground">
					Examples
				</Text>
				{features.length > 1 ? (
					<View accessibilityLabel={`${entry.name} features`} className="flex-row flex-wrap gap-1.5">
						{features.map((summary: ShowcaseFeatureSummary): React.JSX.Element => (
							<FeatureChip key={summary.id} feature={summary} onPress={goToFeature} />
						))}
					</View>
				) : null}
				{module.status === "loading" ? <FeatureSetLoading /> : null}
				{module.status === "failed" ? <ErrorState message="The examples could not load." retryLabel="Try again" onRetry={retryModule} /> : null}
				{module.status === "ready" ? <ShowcaseFeatureList slug={entry.slug} features={module.value.features} target={target} scrollRef={scrollRef} /> : null}
			</View>
			{module.status === "ready" && module.value.guidelines.length > 0 ? <ShowcaseGuidelines slug={entry.slug} guidelines={module.value.guidelines} /> : null}
			{overview === null ? null : <ShowcaseMarkdown source={overview.body} testID="showcase-overview" />}
			{overview === null ? null : <ShowcaseFaq faq={overview.faq} />}
			<View accessibilityLabel="More components" className="flex-row gap-3 border-t border-border pt-6">
				{previous === undefined ? <View className="flex-1" /> : <NeighbourLink item={previous} direction="previous" />}
				{next === undefined ? <View className="flex-1" /> : <NeighbourLink item={next} direction="next" />}
			</View>
			<ReuiProCallToAction />
		</Screen>
	);
}
