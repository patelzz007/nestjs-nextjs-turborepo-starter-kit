import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import { ErrorState } from "@workspace/ui-native/components/empty";
import { Icon } from "@workspace/ui-native/components/icon";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Screen } from "../../components/screen";
import { FeatureCode } from "./feature-code";
import { SHOWCASE_API } from "./generated/api";
import { SHOWCASE_CONTENT } from "./generated/content";
import type { ApiEntry } from "./showcase-api";
import { ShowcaseApiReference } from "./showcase-api-reference";
import type { ShowcaseCatalogItem } from "./showcase-catalog";
import { API_FENCE, EXAMPLE_FENCE, type ShowcaseContent, type ShowcaseDocsExample } from "./showcase-content";
import { FeatureSetLoading } from "./showcase-loading";
import { ShowcaseMarkdown, type MarkdownFences } from "./showcase-markdown";
import { SHOWCASE_ROUTES } from "./showcase-routes";
import { ShowcaseSearch } from "./showcase-search";
import { useLoaded } from "./use-loaded";

/** A component's docs and API reference, loaded together. */
interface DocsData {
	readonly content: ShowcaseContent | null;
	readonly api: readonly ApiEntry[];
}

interface DocsExampleProps {
	readonly slug: string;
	readonly example: ShowcaseDocsExample;
}

/** An example a docs screen walks through: its exact source, and a link to it running live on the component screen. */
function DocsExample({ slug, example }: DocsExampleProps): React.JSX.Element {
	const router = useRouter();
	const viewLive = React.useCallback((): void => {
		router.push(SHOWCASE_ROUTES.feature(slug, example.anchor));
	}, [example.anchor, router, slug]);
	return (
		<View className="gap-2" testID={`showcase-docs-example-${example.id}`}>
			<FeatureCode slug={slug} file={example.file} source={example.source} />
			<View className="flex-row items-center justify-between gap-3">
				<Text className="text-body shrink font-sans text-muted-foreground">{example.label}</Text>
				<Pressable accessibilityRole="link" accessibilityLabel={`View ${example.label} live`} onPress={viewLive} className="min-h-11 flex-row items-center gap-1">
					<Text className="font-sans-medium text-label text-foreground">View it live</Text>
					<Icon icon={ArrowUpRightIcon} size="sm" colorClassName="accent-foreground" />
				</Pressable>
			</View>
		</View>
	);
}

export interface ShowcaseDocsScreenProps {
	readonly item: ShowcaseCatalogItem;
}

/** What the docs' own fenced blocks draw: the API reference, and an example the body names by id. */
function docsFencesOf(slug: string, examples: readonly ShowcaseDocsExample[], api: readonly ApiEntry[]): MarkdownFences {
	const examplesById = new Map(examples.map((example: ShowcaseDocsExample): [string, ShowcaseDocsExample] => [example.id, example]));
	return {
		[API_FENCE]: (): React.ReactNode => <ShowcaseApiReference entries={api} />,
		[EXAMPLE_FENCE]: (id: string): React.ReactNode => {
			const example = examplesById.get(id.trim());
			return example === undefined ? null : <DocsExample slug={slug} example={example} />;
		},
	};
}

/**
 * One component's docs, like the web's: installation, usage, how it is put
 * together, its guides, the generated API reference, and its accessibility
 * notes. An example block shows its code with a link to it running live.
 */
export function ShowcaseDocsScreen({ item }: ShowcaseDocsScreenProps): React.JSX.Element {
	const router = useRouter();
	const { entry } = item;
	const load = React.useCallback(async (): Promise<DocsData> => {
		const [content, api] = await Promise.all([SHOWCASE_CONTENT.get(entry.slug)?.() ?? Promise.resolve(null), SHOWCASE_API.get(entry.slug)?.() ?? Promise.resolve([])]);
		return { content, api };
	}, [entry.slug]);
	const { state, retry } = useLoaded(load);
	const backToExamples = React.useCallback((): void => {
		router.navigate(SHOWCASE_ROUTES.component(entry.slug));
	}, [entry.slug, router]);
	const fences = React.useMemo((): MarkdownFences | null => {
		if (state.status !== "ready" || state.value.content === null) {
			return null;
		}
		const { content, api } = state.value;
		return docsFencesOf(entry.slug, content.docs.examples, api);
	}, [entry.slug, state]);
	return (
		<Screen stickyHeader={<ShowcaseSearch />} testID={`showcase-docs-${entry.slug}`}>
			<View className="gap-3 border-b border-border pb-6">
				<Pressable
					accessibilityRole="link"
					accessibilityLabel={`${entry.name} examples`}
					onPress={backToExamples}
					className="min-h-11 flex-row items-center gap-1.5 self-start">
					<Icon icon={ArrowLeftIcon} size="sm" colorClassName="accent-icon" />
					<Text className="text-body font-sans text-muted-foreground">{`${entry.name} examples`}</Text>
				</Pressable>
				<Text accessibilityRole="header" className="text-h1 font-mono text-foreground">
					{entry.name}
				</Text>
				<Text className="text-body-lg font-sans text-muted-foreground">{entry.description}</Text>
			</View>
			{state.status === "loading" ? <FeatureSetLoading /> : null}
			{state.status === "failed" ? <ErrorState message="The docs could not load." retryLabel="Try again" onRetry={retry} /> : null}
			{state.status === "ready" && state.value.content !== null && fences !== null ? (
				<ShowcaseMarkdown source={state.value.content.docs.body} fences={fences} testID="showcase-docs-body" />
			) : null}
			{state.status === "ready" && state.value.content === null ? <Text className="text-body font-sans text-muted-foreground">This component has no docs yet.</Text> : null}
		</Screen>
	);
}
