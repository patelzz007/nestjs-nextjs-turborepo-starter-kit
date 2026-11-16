import CodeXmlIcon from "lucide-react-native/icons/code-xml";
import EyeIcon from "lucide-react-native/icons/eye";
import { FieldSurfaceProvider } from "@workspace/ui-native/lib/field-surface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";
import { Text, View, type ScrollViewInstance, type ViewInstance } from "react-native";

import { FeatureCode } from "./feature-code";
import type { ShowcaseFeature } from "./showcase-feature";

/** The tabs of one example. */
export type FeatureView = "preview" | "code";
const DEFAULT_VIEW: FeatureView = "preview";

/** Previews mounted with the first frame, and added on each frame after it (a long page never blocks its first paint). */
export const PREVIEW_BATCH = 4;

/**
 * How many previews are mounted: a batch at first (and at least up to `atLeast`, the linked one), then one more
 * batch every frame until all `total` are. A page of 60 examples paints its first screen at once and fills in the
 * rest while it is being read, the web's mount-ahead previews on a phone.
 */
export function useProgressiveCount(total: number, atLeast: number): number {
	const [count, setCount] = React.useState<number>((): number => Math.min(total, Math.max(PREVIEW_BATCH, atLeast)));
	React.useEffect((): (() => void) | undefined => {
		if (count >= total) {
			return undefined;
		}
		const frame = requestAnimationFrame((): void => {
			setCount((current: number): number => Math.min(total, current + PREVIEW_BATCH));
		});
		return (): void => {
			cancelAnimationFrame(frame);
		};
	}, [count, total]);
	return count;
}

interface FeatureSectionProps {
	readonly slug: string;
	readonly feature: ShowcaseFeature;
	/** `false` until the progressive mount reaches it: a placeholder of the preview's height holds its place. */
	readonly mounted: boolean;
	readonly sectionRef?: React.Ref<ViewInstance> | undefined;
}

/**
 * One feature: its name and what it is for, then its example under two tabs —
 * Preview (running live, on a card surface) and Code (its exact source). The
 * code mounts only when its tab is opened.
 */
const FeatureSection = React.memo(function FeatureSection({ slug, feature, mounted, sectionRef }: FeatureSectionProps): React.JSX.Element {
	const [view, setView] = React.useState<string>(DEFAULT_VIEW);
	return (
		<View ref={sectionRef} className="gap-3" testID={`showcase-feature-${feature.anchor}`}>
			<View className="gap-1">
				<Text accessibilityRole="header" className="text-h4 font-heading text-foreground">
					{feature.label}
				</Text>
				<Text className="text-body font-sans text-muted-foreground">{feature.description}</Text>
			</View>
			<Tabs value={view} onChange={setView} variant="line" size="sm">
				<View className="flex-row items-center justify-between gap-3">
					<TabsList>
						<TabsTrigger value="preview" label="Preview" icon={EyeIcon} />
						<TabsTrigger value="code" label="Code" icon={CodeXmlIcon} />
					</TabsList>
					<Text numberOfLines={1} className="text-caption shrink font-mono text-muted-foreground">
						{feature.id}
					</Text>
				</View>
				<TabsContent value="preview">
					<View accessibilityLabel={`${feature.label} preview`} className="rounded-card min-h-40 justify-center border border-border bg-card p-4">
						<FieldSurfaceProvider surface="card">{mounted ? feature.render() : null}</FieldSurfaceProvider>
					</View>
				</TabsContent>
				<TabsContent value="code">
					<FeatureCode slug={slug} file={feature.file} source={feature.source} testID={`showcase-code-${feature.anchor}`} />
				</TabsContent>
			</Tabs>
		</View>
	);
});

/** The feature to scroll to (a link's `?feature=soft-wrap`, or a tapped chip), and which request this is (a chip tapped twice scrolls twice). */
export interface FeatureTarget {
	readonly anchor: string | undefined;
	readonly request: number;
}

export interface ShowcaseFeatureListProps {
	/** The component the features belong to. */
	readonly slug: string;
	readonly features: readonly ShowcaseFeature[];
	/** The feature to mount first and scroll to. */
	readonly target?: FeatureTarget | undefined;
	/** The screen's scroll view, to scroll the linked feature into view. */
	readonly scrollRef?: React.RefObject<ScrollViewInstance | null> | undefined;
}

/** Room left above a linked feature when it is scrolled to, in pt: the pinned search's height. */
const SCROLL_TARGET_OFFSET = 72;

/**
 * Every feature of one component, in order. Previews mount progressively
 * (`useProgressiveCount`), and a linked feature is mounted first and scrolled
 * into view once it has been laid out.
 */
export function ShowcaseFeatureList({ slug, features, target, scrollRef }: ShowcaseFeatureListProps): React.JSX.Element {
	const targetAnchor = target?.anchor;
	const request = target?.request ?? 0;
	const targetIndex = targetAnchor === undefined ? -1 : features.findIndex((feature: ShowcaseFeature): boolean => feature.anchor === targetAnchor);
	const count = useProgressiveCount(features.length, targetIndex + 1);
	const targetRef = React.useRef<ViewInstance | null>(null);
	React.useEffect((): void => {
		const section = targetRef.current;
		const scroller = scrollRef?.current;
		if (section === null || scroller === null || scroller === undefined) {
			return;
		}
		const content = scroller.getInnerViewRef();
		if (content === null) {
			return;
		}
		section.measureLayout(content, (_x: number, y: number): void => {
			scroller.scrollTo({ y: Math.max(y - SCROLL_TARGET_OFFSET, 0), animated: false });
		});
	}, [request, scrollRef, targetIndex]);
	return (
		<View className="gap-12">
			{features.map((feature: ShowcaseFeature, index: number): React.JSX.Element => (
				<FeatureSection key={feature.id} slug={slug} feature={feature} mounted={index < count} sectionRef={index === targetIndex ? targetRef : undefined} />
			))}
		</View>
	);
}
