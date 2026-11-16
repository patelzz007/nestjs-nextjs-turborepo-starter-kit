import SearchIcon from "lucide-react-native/icons/search";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { useRouter } from "expo-router";
import * as React from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";

import { SHOWCASE_ROUTES } from "./showcase-routes";
import { buildShowcaseSearchEntries, searchShowcase, type ShowcaseSearchEntry, type ShowcaseSearchKind } from "./showcase-search-index";

const PLACEHOLDER = "Search components and features…";
const GROUP_TITLES: Readonly<Record<ShowcaseSearchKind, string>> = { component: "Components", feature: "Features" };
const GROUP_ORDER: readonly ShowcaseSearchKind[] = ["component", "feature"];

/** One group of results. */
export interface ResultGroup {
	readonly kind: ShowcaseSearchKind;
	readonly title: string;
	readonly items: readonly ShowcaseSearchEntry[];
}

/** The results, split into components and features (empty groups left out). */
export function groupShowcaseResults(results: readonly ShowcaseSearchEntry[]): ResultGroup[] {
	return GROUP_ORDER.map((kind: ShowcaseSearchKind): ResultGroup => ({
		kind,
		title: GROUP_TITLES[kind],
		items: results.filter((entry: ShowcaseSearchEntry): boolean => entry.kind === kind),
	})).filter((group: ResultGroup): boolean => group.items.length > 0);
}

interface ResultRowProps {
	readonly entry: ShowcaseSearchEntry;
	readonly onPick: (entry: ShowcaseSearchEntry) => void;
}

const ResultRow = React.memo(function ResultRow({ entry, onPick }: ResultRowProps): React.JSX.Element {
	const onPress = React.useCallback((): void => {
		onPick(entry);
	}, [entry, onPick]);
	const context = entry.kind === "feature" ? entry.componentName : entry.familyTitle;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${entry.title}, ${context}`}
			onPress={onPress}
			className="active:bg-surface-selected min-h-11 flex-row items-center justify-between gap-3 px-3">
			<Text numberOfLines={1} className="text-body font-sans-medium shrink text-foreground">
				{entry.title}
			</Text>
			<Text numberOfLines={1} className="text-caption shrink-0 font-sans text-muted-foreground">
				{context}
			</Text>
		</Pressable>
	);
});

/**
 * The showcase's search, pinned to the top of its screens: it finds a
 * component or any one of its features ("soft wrap", "diff") and opens it.
 * The results list under the field while there is a query.
 */
export function ShowcaseSearch(): React.JSX.Element {
	const router = useRouter();
	const entries = React.useMemo((): ShowcaseSearchEntry[] => buildShowcaseSearchEntries(SHOWCASE_ROUTES), []);
	const [query, setQuery] = React.useState<string>("");
	const groups = React.useMemo((): ResultGroup[] => groupShowcaseResults(searchShowcase(entries, query)), [entries, query]);
	const hasQuery = query.trim().length > 0;
	const onPick = React.useCallback(
		(entry: ShowcaseSearchEntry): void => {
			setQuery("");
			Keyboard.dismiss();
			router.push(entry.href);
		},
		[router],
	);
	return (
		<View className="gap-2" testID="showcase-search">
			<InputGroup
				value={query}
				onChange={setQuery}
				leadingIcon={SearchIcon}
				placeholder={PLACEHOLDER}
				accessibilityLabel="Search components and features"
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="search"
				testID="showcase-search-input"
			/>
			{hasQuery ? (
				<ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" className="rounded-card max-h-96 border border-border bg-popover" testID="showcase-search-results">
					{groups.length === 0 ? (
						<Text className="text-body px-3 py-3 font-sans text-muted-foreground">No component or feature matches.</Text>
					) : (
						groups.map((group: ResultGroup): React.JSX.Element => (
							<View key={group.kind} className="py-1">
								<Text accessibilityRole="header" className="text-overline font-sans-semibold px-3 py-1 text-muted-foreground uppercase">
									{group.title}
								</Text>
								{group.items.map((entry: ShowcaseSearchEntry): React.JSX.Element => (
									<ResultRow key={entry.key} entry={entry} onPick={onPick} />
								))}
							</View>
						))
					)}
				</ScrollView>
			) : null}
		</View>
	);
}
