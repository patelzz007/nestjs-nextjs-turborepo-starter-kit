// A picture in a fixed aspect ratio that fills its frame (the web kit's
// `CoverImage`): a product shot, a banner, one slide of an `ImageCarousel`.
// Data-agnostic and controlled: the caller gives the address (`uri`) and the
// description (`alt`). With no address — or once the picture fails to load — a
// token-coloured placeholder holds the same space, so the layout never jumps.
//
// expo-image draws the picture (cached, decoded off the main thread); it is a
// third-party component, so it takes classes through `withUniwind` (rules/04).

import { cva, type VariantProps } from "class-variance-authority";
import { Image } from "expo-image";
import ImageOffIcon from "lucide-react-native/icons/image-off";
import * as React from "react";
import { View } from "react-native";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { Icon } from "./icon";

/** expo-image's view with Uniwind's `className`. */
const StyledImage = withUniwind(Image);

export const coverImageVariants = cva("w-full overflow-hidden bg-muted", {
	variants: {
		/** `rounded`: a standalone picture. `flush`: a picture inside a frame that already clips it (a card, a carousel). */
		variant: {
			rounded: "rounded-xl",
			flush: "rounded-none",
		},
		/** The frame's shape: `video` 16:9, `photo` 4:3, `square` 1:1, `portrait` 3:4. */
		ratio: {
			video: "aspect-video",
			photo: "aspect-4/3",
			square: "aspect-square",
			portrait: "aspect-3/4",
		},
	},
	defaultVariants: { variant: "rounded", ratio: "video" },
});

type CoverImageVariantProps = VariantProps<typeof coverImageVariants>;
export type CoverImageVariant = NonNullable<CoverImageVariantProps["variant"]>;
export type CoverImageRatio = NonNullable<CoverImageVariantProps["ratio"]>;

/** How long a newly loaded picture fades in, in milliseconds. */
const FADE_IN_MS = 200;

export interface CoverImageProps {
	/** The picture's address; `null` (or a failed load) shows the placeholder. */
	readonly uri: string | null;
	/** What the picture shows, for screen readers. */
	readonly alt: string;
	readonly variant?: CoverImageVariant | undefined;
	readonly ratio?: CoverImageRatio | undefined;
	/** Shown in place of the picture when there is none; defaults to a muted "no image" glyph. */
	readonly fallback?: React.ReactNode;
	/** Extra classes for the frame, merged last (layout: `w-40`, `flex-1`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const CoverImage = React.memo(
	React.forwardRef<View, CoverImageProps>(function CoverImage({ uri, alt, variant = "rounded", ratio = "video", fallback, className, testID }, ref): React.JSX.Element {
		// Display state only: the address that failed, so a new address tries again.
		const [failedUri, setFailedUri] = React.useState<string | null>(null);
		const showsPicture = uri !== null && uri !== failedUri;
		const source = React.useMemo((): { readonly uri: string } | null => (uri === null ? null : { uri }), [uri]);
		const markFailed = React.useCallback((): void => {
			setFailedUri(uri);
		}, [uri]);

		return (
			<View ref={ref} testID={testID} className={cn(coverImageVariants({ variant, ratio }), className)}>
				{showsPicture ? (
					<StyledImage
						source={source}
						accessible
						accessibilityLabel={alt}
						contentFit="cover"
						transition={FADE_IN_MS}
						onError={markFailed}
						className="size-full"
						testID={testID === undefined ? undefined : `${testID}-image`}
					/>
				) : (
					<View accessible accessibilityRole="image" accessibilityLabel={alt} className="size-full items-center justify-center">
						{fallback ?? <Icon icon={ImageOffIcon} size="xl" colorClassName="accent-muted-foreground" />}
					</View>
				)}
			</View>
		);
	}),
);
