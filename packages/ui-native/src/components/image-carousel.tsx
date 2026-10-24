// A swipeable gallery of pictures (the web kit's `ImageCarousel`): a
// `Carousel` whose slides are `CoverImage`s in one shared aspect ratio, each
// with a "2 / 5" position counter in its corner (`showCounter`), and previous /
// next arrows on request (`showControls`). One picture renders as a plain
// `CoverImage` — nothing to swipe, so no dots, arrows or counter.
// Controlled like `Carousel`: the caller owns the shown picture (`index`) and
// hears every change (`onChange`). Each picture's `alt` describes it to screen
// readers; a missing or broken picture shows the cover's placeholder.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Carousel, type CarouselSize } from "./carousel";
import { CoverImage, type CoverImageRatio } from "./cover-image";

/** The gallery's own classes; the `Carousel` it renders is styled by `carouselVariants`. */
export const imageCarouselVariants = cva("w-full", {
	variants: {
		/** `rounded`: pictures with rounded corners on the page. `card`: pictures flush inside a bordered card. */
		variant: {
			rounded: "",
			card: "",
		},
	},
	defaultVariants: { variant: "rounded" },
});

type ImageCarouselVariantProps = VariantProps<typeof imageCarouselVariants>;
export type ImageCarouselVariant = NonNullable<ImageCarouselVariantProps["variant"]>;

export interface ImageCarouselImage {
	/** Stable identity of the picture (its key). */
	readonly id: string;
	/** The picture's address; `null` (a picture still processing) shows the cover's placeholder. */
	readonly uri: string | null;
	/** What the picture shows, for screen readers. */
	readonly alt: string;
}

export interface ImageCarouselProps {
	readonly images: readonly ImageCarouselImage[];
	/** The picture that shows (zero-based). */
	readonly index: number;
	/** A swipe or a dot asked for another picture (zero-based). */
	readonly onChange: (index: number) => void;
	/** Every picture's frame shape. */
	readonly ratio?: CoverImageRatio | undefined;
	/** Names a picture's dot for screen readers: `(2, 5)` → "Slide 2 of 5". */
	readonly slideLabel?: ((position: number, total: number) => string) | undefined;
	/** Show the "2 / 5" counter on each picture (default on; the dots already tell screen readers the position). */
	readonly showCounter?: boolean | undefined;
	/** Show previous / next buttons either side of the dots. */
	readonly showControls?: boolean | undefined;
	/** The arrows' accessible names. */
	readonly previousLabel?: string | undefined;
	readonly nextLabel?: string | undefined;
	readonly variant?: ImageCarouselVariant | undefined;
	readonly size?: CarouselSize | undefined;
	/** Extra classes for the container, merged last (layout: `mt-4`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A picture's place in the gallery as people count it ("2 / 5"). */
const POSITION_OFFSET = 1;
const ONE_PICTURE = 1;

export const ImageCarousel = React.memo(
	React.forwardRef<ViewInstance, ImageCarouselProps>(function ImageCarousel(
		{
			images,
			index,
			onChange,
			ratio = "video",
			slideLabel,
			showCounter = true,
			showControls = false,
			previousLabel,
			nextLabel,
			variant = "rounded",
			size = "md",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const total = images.length;
		const coverVariant = variant === "card" ? "flush" : "rounded";
		const [only] = images;
		if (total === ONE_PICTURE && only !== undefined) {
			return (
				<CoverImage
					ref={ref}
					uri={only.uri}
					alt={only.alt}
					ratio={ratio}
					variant={coverVariant}
					testID={testID === undefined ? undefined : `${testID}-${only.id}`}
					className={cn(imageCarouselVariants({ variant }), className)}
				/>
			);
		}
		return (
			<Carousel
				ref={ref}
				index={index}
				onChange={onChange}
				slideLabel={slideLabel}
				showControls={showControls}
				previousLabel={previousLabel}
				nextLabel={nextLabel}
				variant={variant === "card" ? "card" : "plain"}
				size={size}
				testID={testID}
				className={cn(imageCarouselVariants({ variant }), className)}>
				{images.map((image: ImageCarouselImage, imageIndex: number): React.JSX.Element => (
					<View key={image.id}>
						<CoverImage uri={image.uri} alt={image.alt} ratio={ratio} variant={coverVariant} testID={testID === undefined ? undefined : `${testID}-${image.id}`} />
						{showCounter ? (
							<View
								pointerEvents="none"
								accessibilityElementsHidden
								importantForAccessibility="no-hide-descendants"
								className="absolute top-3 right-3 rounded-full bg-background/80 px-2.5 py-1">
								<Text className="font-sans-medium text-xs text-foreground">{`${String(imageIndex + POSITION_OFFSET)} / ${String(total)}`}</Text>
							</View>
						) : null}
					</View>
				))}
			</Carousel>
		);
	}),
);
