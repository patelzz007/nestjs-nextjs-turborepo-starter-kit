// The Home screen's "Discover" carousel: a row of cards, each pointing to a part of the app
// (highlights.ts), built on the kit's generic `Carousel` (@workspace/ui-native/components/carousel).
// Each card takes the full width of the row, one per page, with a gap so the cards' borders never
// touch while they are swiped; the row moves on by itself every few seconds while Home is the screen
// in front, and stops for good once the person swipes or picks a card (the carousel's own rule). A
// card's button opens its screen the way the drawer does.

import { useIsFocused, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@workspace/ui-native/components/button";
import { Carousel } from "@workspace/ui-native/components/carousel";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { MutedText, Subheading } from "@workspace/ui-native/components/text";

import { HOME_HIGHLIGHTS, type HomeHighlight } from "./highlights";
import { HOME_HIGHLIGHTS_COPY, homeHighlightSlideLabel } from "./labels";

/** How long each card stays before the row moves on. */
export const HOME_HIGHLIGHTS_AUTO_PLAY_MS = 6000;
/** Points between two cards while the row is swiped (each still fills the row when it settles). */
export const HOME_HIGHLIGHTS_GAP = 16;
const FIRST_SLIDE = 0;

export function HomeHighlights(): React.JSX.Element {
	const router = useRouter();
	// Home stays mounted under its stack and behind other tabs: the row only moves while it is seen.
	const focused = useIsFocused();
	const [index, setIndex] = React.useState(FIRST_SLIDE);
	const open = React.useCallback(
		(highlight: HomeHighlight): void => {
			if (highlight.isTab) {
				router.navigate(highlight.route);
			} else {
				// `withAnchor`: the tab's first screen (Settings) goes underneath, so "back" lands on it.
				router.push(highlight.route, { withAnchor: true });
			}
		},
		[router],
	);

	return (
		<View className="gap-3" testID="home-highlights">
			<View className="gap-0.5">
				<Subheading>{HOME_HIGHLIGHTS_COPY.title}</Subheading>
				<MutedText>{HOME_HIGHLIGHTS_COPY.description}</MutedText>
			</View>
			<Carousel
				index={index}
				onChange={setIndex}
				gap={HOME_HIGHLIGHTS_GAP}
				autoPlayIntervalMs={focused ? HOME_HIGHLIGHTS_AUTO_PLAY_MS : undefined}
				slideLabel={homeHighlightSlideLabel}
				size="sm"
				testID="home-highlights-carousel">
				{HOME_HIGHLIGHTS.map((highlight: HomeHighlight): React.JSX.Element => (
					<HighlightCard key={highlight.key} highlight={highlight} onOpen={open} />
				))}
			</Carousel>
		</View>
	);
}

interface HighlightCardProps {
	readonly highlight: HomeHighlight;
	readonly onOpen: (highlight: HomeHighlight) => void;
}

function HighlightCard({ highlight, onOpen }: HighlightCardProps): React.JSX.Element {
	const openThis = React.useCallback((): void => {
		onOpen(highlight);
	}, [highlight, onOpen]);
	return (
		<View className="flex-1 gap-3 rounded-xl border border-border bg-card p-4" testID={`home-highlight-${highlight.key}`}>
			<IconTile icon={highlight.icon} tone={highlight.tone} />
			<View className="flex-1 gap-1">
				<Subheading numberOfLines={1}>{highlight.title}</Subheading>
				<MutedText numberOfLines={3}>{highlight.body}</MutedText>
			</View>
			<View className="flex-row">
				<Button label={highlight.action} accessibilityLabel={`${highlight.action}: ${highlight.title}`} onPress={openThis} variant="secondary" size="sm" />
			</View>
		</View>
	);
}
