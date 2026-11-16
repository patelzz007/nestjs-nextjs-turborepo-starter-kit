import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { FieldSurfaceProvider } from "@workspace/ui-native/lib/field-surface";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { FeatureCode } from "./feature-code";
import type { ShowcaseGuideline, ShowcaseGuidelineSide } from "./showcase-feature";
import { ShowcaseMarkdown } from "./showcase-markdown";

/** Which side of a pair: the right way or the wrong way. */
export type GuidelineVerdict = "do" | "dont";

/** How each side of a pair is told apart: its heading, its glyph and their colour, and the card's edge. */
interface VerdictLook {
	readonly title: string;
	readonly icon: LucideIcon;
	readonly color: string;
	readonly cardClassName: string;
}

const VERDICT: Readonly<Record<GuidelineVerdict, VerdictLook>> = {
	do: { title: "Do", icon: CircleCheckIcon, color: "accent-success", cardClassName: "rounded-card flex-1 gap-3 border border-success bg-card p-4" },
	dont: { title: "Don't", icon: CircleXIcon, color: "accent-destructive", cardClassName: "rounded-card flex-1 gap-3 border border-destructive bg-card p-4" },
};

interface GuidelineSideCardProps {
	readonly slug: string;
	readonly verdict: GuidelineVerdict;
	readonly side: ShowcaseGuidelineSide;
}

/** One side of a pair: its verdict, a live render of it, what it says, and its code one tap away. */
const GuidelineSideCard = React.memo(function GuidelineSideCard({ slug, verdict, side }: GuidelineSideCardProps): React.JSX.Element {
	const [showCode, setShowCode] = React.useState<boolean>(false);
	const toggleCode = React.useCallback((): void => {
		setShowCode((shown: boolean): boolean => !shown);
	}, []);
	const meta = VERDICT[verdict];
	const codeState = React.useMemo((): { readonly expanded: boolean } => ({ expanded: showCode }), [showCode]);
	return (
		<View className={meta.cardClassName} testID={`showcase-guideline-${side.file}`}>
			<View className="flex-row items-center gap-2">
				<Icon icon={meta.icon} size="sm" colorClassName={meta.color} />
				<Text className="text-label font-sans-semibold text-foreground">{meta.title}</Text>
			</View>
			<View className="min-h-24 justify-center rounded-lg border border-border bg-background p-3">
				<FieldSurfaceProvider surface="page">{side.render()}</FieldSurfaceProvider>
			</View>
			<ShowcaseMarkdown source={side.text} />
			<Pressable
				accessibilityRole="button"
				accessibilityState={codeState}
				accessibilityLabel={showCode ? `Hide the code of "${side.text}"` : `Show the code of "${side.text}"`}
				onPress={toggleCode}
				className="min-h-11 justify-center self-start active:opacity-60">
				<Text className="text-label font-sans-medium text-link">{showCode ? "Hide code" : "Show code"}</Text>
			</Pressable>
			{showCode ? <FeatureCode slug={slug} file={side.file} source={side.source} /> : null}
		</View>
	);
});

export interface ShowcaseGuidelinesProps {
	readonly slug: string;
	readonly guidelines: readonly ShowcaseGuideline[];
}

/** The component's Do / Don't pairs: for each, the right way and the wrong way, both live. */
export function ShowcaseGuidelines({ slug, guidelines }: ShowcaseGuidelinesProps): React.JSX.Element {
	return (
		<View className="gap-6" testID="showcase-guidelines">
			<Text accessibilityRole="header" className="text-h2 font-sans-bold text-foreground">
				Do and don&apos;t
			</Text>
			{guidelines.map((guideline: ShowcaseGuideline): React.JSX.Element => (
				<View key={guideline.title} className="gap-3">
					<Text accessibilityRole="header" className="text-h4 font-heading text-foreground">
						{guideline.title}
					</Text>
					<View className="gap-3">
						<GuidelineSideCard slug={slug} verdict="do" side={guideline.do} />
						<GuidelineSideCard slug={slug} verdict="dont" side={guideline.dont} />
					</View>
				</View>
			))}
		</View>
	);
}
