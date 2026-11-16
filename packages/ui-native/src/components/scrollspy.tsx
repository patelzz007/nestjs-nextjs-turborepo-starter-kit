// Section navigation that follows the scroll (the web kit's `Scrollspy`): a
// list of section links beside (or above) a scrolling panel; the link of the
// section in view is highlighted as the panel scrolls, and tapping a link
// scrolls to its section.
//
// Data-agnostic: `sections` in (a key, a label and the section's content).
// The section in view is the component's own display state, reported through
// `onActiveChange`. The caller sizes the panel (`panelClassName`, e.g. `h-96`).
// The ref reaches the root view.

import { cva } from "class-variance-authority";
import * as React from "react";
import {
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	Text,
	View,
	type ViewInstance,
} from "react-native";

import { cn } from "../lib/cn";

export interface ScrollspySection {
	readonly key: string;
	readonly label: string;
	readonly content: React.ReactNode;
}

export type ScrollspyNavigation = "vertical" | "horizontal";

export const scrollspyLinkVariants = cva("rounded-lg px-3 py-2", {
	variants: {
		active: { true: "bg-surface-selected", false: "active:bg-muted" },
	},
	defaultVariants: { active: false },
});

const scrollspyLinkLabelVariants = cva("text-body", {
	variants: {
		active: { true: "font-sans-semibold text-foreground", false: "font-sans text-muted-foreground" },
	},
	defaultVariants: { active: false },
});

/** How far below the panel's top a section still counts as the one in view. */
const IN_VIEW_SLOP = 24;
const SCROLL_THROTTLE_MS = 16;

/** The section in view: the last one whose top is at or above the scroll position. */
export function sectionInView(tops: readonly number[], offset: number): number {
	let active = 0;
	tops.forEach((top: number, index: number): void => {
		if (top <= offset + IN_VIEW_SLOP) {
			active = index;
		}
	});
	return active;
}

export interface ScrollspyProps {
	readonly sections: readonly ScrollspySection[];
	/** The links in a column beside the panel (default), or a row above it. */
	readonly navigation?: ScrollspyNavigation | undefined;
	readonly onActiveChange?: ((key: string) => void) | undefined;
	/** Extra classes for the scrolling panel (give it a height), merged last. */
	readonly panelClassName?: string | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface LinkProps {
	readonly index: number;
	readonly section: ScrollspySection;
	readonly active: boolean;
	readonly onPick: (index: number) => void;
}

function Link({ index, section, active, onPick }: LinkProps): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(index);
	}, [index, onPick]);
	const accessibilityState = React.useMemo(() => ({ selected: active }), [active]);
	return (
		<Pressable
			accessibilityRole="link"
			accessibilityLabel={section.label}
			accessibilityState={accessibilityState}
			onPress={pick}
			className={scrollspyLinkVariants({ active })}>
			<Text className={scrollspyLinkLabelVariants({ active })}>{section.label}</Text>
		</Pressable>
	);
}

interface SectionProps {
	readonly index: number;
	readonly section: ScrollspySection;
	readonly onMeasure: (index: number, top: number) => void;
}

function Section({ index, section, onMeasure }: SectionProps): React.JSX.Element {
	const measure = React.useCallback(
		(event: LayoutChangeEvent): void => {
			onMeasure(index, event.nativeEvent.layout.y);
		},
		[index, onMeasure],
	);
	return (
		<View onLayout={measure} accessibilityRole="summary" className="gap-2 pb-6">
			<Text accessibilityRole="header" className="text-body-lg font-sans-semibold text-foreground">
				{section.label}
			</Text>
			{section.content}
		</View>
	);
}

export const Scrollspy = React.memo(
	React.forwardRef<ViewInstance, ScrollspyProps>(function Scrollspy(
		{ sections, navigation = "vertical", onActiveChange, panelClassName, className, testID },
		ref,
	): React.JSX.Element {
		const scrollRef = React.useRef<ScrollViewInstance>(null);
		const [tops, setTops] = React.useState<readonly number[]>([]);
		const [active, setActive] = React.useState(0);
		const measure = React.useCallback((index: number, top: number): void => {
			setTops((current: readonly number[]): readonly number[] => {
				const next = [...current];
				next[index] = top;
				return next;
			});
		}, []);
		const follow = React.useCallback(
			(event: NativeSyntheticEvent<NativeScrollEvent>): void => {
				const next = sectionInView(tops, event.nativeEvent.contentOffset.y);
				if (next !== active) {
					setActive(next);
					const key = sections.at(next)?.key;
					if (key !== undefined) {
						onActiveChange?.(key);
					}
				}
			},
			[active, onActiveChange, sections, tops],
		);
		const pick = React.useCallback(
			(index: number): void => {
				setActive(index);
				scrollRef.current?.scrollTo({ y: tops.at(index) ?? 0, animated: true });
			},
			[tops],
		);
		const links = sections.map((section: ScrollspySection, index: number): React.JSX.Element => (
			<Link key={section.key} index={index} section={section} active={index === active} onPick={pick} />
		));
		return (
			<View ref={ref} testID={testID} className={cn(navigation === "vertical" ? "flex-row gap-3" : "gap-3", className)}>
				{navigation === "vertical" ? (
					<View accessibilityRole="menu" className="w-36 gap-1">
						{links}
					</View>
				) : (
					<ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="menu" contentContainerClassName="gap-1">
						{links}
					</ScrollView>
				)}
				<ScrollView ref={scrollRef} onScroll={follow} scrollEventThrottle={SCROLL_THROTTLE_MS} className={cn("flex-1", panelClassName)}>
					{sections.map((section: ScrollspySection, index: number): React.JSX.Element => (
						<Section key={section.key} index={index} section={section} onMeasure={measure} />
					))}
				</ScrollView>
			</View>
		);
	}),
);
