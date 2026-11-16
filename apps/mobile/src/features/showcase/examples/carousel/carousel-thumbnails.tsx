// The thumbnail examples' strip: one small photo per slide, the shown one outlined; a press jumps to it. The strip
// scrolls the shown thumbnail into view as the main carousel moves.

import * as React from "react";
import { Pressable, ScrollView, type ScrollViewInstance, View } from "react-native";

import { SlidePhoto, type CarouselSampleSlide } from "./carousel-sample";

/** A thumbnail's side and the space between thumbnails, in points. */
const THUMB = 56;
const THUMB_GAP = 8;

interface ThumbnailStripProps {
	readonly slides: readonly CarouselSampleSlide[];
	readonly index: number;
	readonly onSelect: (index: number) => void;
	/** `light`: outlined in white, for a strip over a photo. */
	readonly tone?: "default" | "light" | undefined;
}

export function ThumbnailStrip({ slides, index, onSelect, tone = "default" }: ThumbnailStripProps): React.JSX.Element {
	const strip = React.useRef<ScrollViewInstance | null>(null);
	React.useEffect((): void => {
		strip.current?.scrollTo({ x: Math.max(0, index * (THUMB + THUMB_GAP) - THUMB), animated: true });
	}, [index]);
	return (
		<ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-1">
			{slides.map((slide: CarouselSampleSlide, position: number): React.JSX.Element => (
				<Thumbnail key={slide.id} slide={slide} position={position} shown={position === index} total={slides.length} tone={tone} onSelect={onSelect} />
			))}
		</ScrollView>
	);
}

interface ThumbnailProps {
	readonly slide: CarouselSampleSlide;
	readonly position: number;
	readonly shown: boolean;
	readonly total: number;
	readonly tone: "default" | "light";
	readonly onSelect: (index: number) => void;
}

function Thumbnail({ slide, position, shown, total, tone, onSelect }: ThumbnailProps): React.JSX.Element {
	const select = React.useCallback((): void => {
		onSelect(position);
	}, [onSelect, position]);
	const accessibilityState = { selected: shown };
	const outline = shown ? (tone === "light" ? "border-white" : "border-primary") : "border-transparent opacity-70";
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Show slide ${String(slide.number)} of ${String(total)}`}
			accessibilityState={accessibilityState}
			onPress={select}
			className={`size-14 overflow-hidden rounded-lg border-2 ${outline}`}>
			<View className="size-full">
				<SlidePhoto slide={slide} width={120} height={120} prefix="Thumbnail" />
			</View>
		</Pressable>
	);
}
