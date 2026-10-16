// A swipeable gallery of pictures (the web kit's `ImageCarousel`): a
// `Carousel` whose slides are `CoverImage`s in one shared aspect ratio.
// Controlled like `Carousel`: the caller owns the shown picture (`index`) and
// hears every change (`onChange`). Each picture's `alt` describes it to screen
// readers; a missing or broken picture shows the cover's placeholder.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import type { View } from "react-native";

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
	readonly variant?: ImageCarouselVariant | undefined;
	readonly size?: CarouselSize | undefined;
	/** Extra classes for the container, merged last (layout: `mt-4`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const ImageCarousel = React.memo(
	React.forwardRef<View, ImageCarouselProps>(function ImageCarousel(
		{ images, index, onChange, ratio = "video", slideLabel, variant = "rounded", size = "md", className, testID },
		ref,
	): React.JSX.Element {
		return (
			<Carousel
				ref={ref}
				index={index}
				onChange={onChange}
				slideLabel={slideLabel}
				variant={variant === "card" ? "card" : "plain"}
				size={size}
				testID={testID}
				className={cn(imageCarouselVariants({ variant }), className)}>
				{images.map((image: ImageCarouselImage): React.JSX.Element => (
					<CoverImage
						key={image.id}
						uri={image.uri}
						alt={image.alt}
						ratio={ratio}
						variant={variant === "card" ? "flush" : "rounded"}
						testID={testID === undefined ? undefined : `${testID}-${image.id}`}
					/>
				))}
			</Carousel>
		);
	}),
);
