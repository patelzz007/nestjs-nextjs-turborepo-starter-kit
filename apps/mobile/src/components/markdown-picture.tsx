// A picture in a comment, drawn the way GitHub draws one: as wide as the text
// (never wider than the picture itself, so a badge stays small), in its own
// proportions — known from `<img width height>`, otherwise once it has loaded —
// on a muted tile while it loads. A very tall one is shown whole inside a
// portrait frame. Tapping it opens it full screen, or, when the author linked
// it (a badge), opens the link. Until the caller knows where it loads from
// (`source` null), its tile shows. A picture that cannot load says so in words
// and offers its address in the browser, where GitHub's own sign-in applies;
// the caller hears of it (`onFailed`), and a new source is tried afresh.

import { Image, type ImageLoadEventData } from "expo-image";
import ImageOffIcon from "lucide-react-native/icons/image-off";
import * as React from "react";
import { Linking, Pressable, Text, View, type ImageStyle, type ViewStyle } from "react-native";
import { withUniwind } from "uniwind";

import type { ImageSource } from "../lib/api-image-authorization";
import { openableHref, type MarkdownImage } from "../lib/markdown";
import { Icon } from "@workspace/ui-native/components/icon";
import { ImageViewer } from "./image-viewer";

const StyledImage = withUniwind(Image);

/** The shape a picture is drawn in before its size is known. */
const DEFAULT_ASPECT_RATIO = 16 / 9;
/** The tallest frame drawn (3:4 portrait); a taller picture is shown whole inside it. */
const TALLEST_ASPECT_RATIO = 3 / 4;
/** How long a loaded picture takes to fade in over its tile, in milliseconds. */
const FADE_IN_MS = 150;

interface PixelSize {
	readonly width: number;
	readonly height: number;
}

function sizeGiven(image: MarkdownImage): PixelSize | null {
	return image.width === null || image.height === null ? null : { width: image.width, height: image.height };
}

/** One key per address and credentials: a failure is remembered for that source only. */
function keyOf(source: ImageSource): string {
	return `${source.uri} ${source.headers?.Authorization ?? ""}`;
}

function openInBrowser(href: string): void {
	const safe = openableHref(href);
	if (safe !== null) {
		Linking.openURL(safe).catch((): void => undefined);
	}
}

export interface MarkdownPictureProps {
	readonly image: MarkdownImage;
	/** Where it loads from (the API, signed in, for a picture GitHub shows only to signed-in readers; otherwise its own address); `null` while not known yet. */
	readonly source: ImageSource | null;
	/** Where a tap goes when the author linked the picture; `null` opens it full screen. */
	readonly link: string | null;
	/** The picture could not be loaded from `source`. */
	readonly onFailed?: ((source: ImageSource) => void) | undefined;
}

export function MarkdownPicture({ image, source, link, onFailed }: MarkdownPictureProps): React.JSX.Element {
	const [loadedSize, setLoadedSize] = React.useState<PixelSize | null>(null);
	// Keyed by source: a new one (a renewed session) gets a fresh try.
	const [failedKey, setFailedKey] = React.useState<string | null>(null);
	const [viewing, setViewing] = React.useState(false);
	const description = image.alt.trim().length > 0 ? image.alt : "Image";
	const size = sizeGiven(image) ?? loadedSize;
	const frame = React.useMemo(
		(): ImageStyle => ({
			width: "100%",
			maxWidth: size?.width,
			aspectRatio: size === null ? DEFAULT_ASPECT_RATIO : Math.max(size.width / size.height, TALLEST_ASPECT_RATIO),
		}),
		[size],
	);
	// The same box, drawn as a tile while it is not known yet where the picture loads from.
	const pendingFrame = React.useMemo((): ViewStyle => ({ width: "100%", aspectRatio: DEFAULT_ASPECT_RATIO }), []);

	const load = React.useCallback((event: ImageLoadEventData): void => {
		setLoadedSize({ width: event.source.width, height: event.source.height });
	}, []);
	const fail = React.useCallback((): void => {
		if (source !== null) {
			setFailedKey(keyOf(source));
			onFailed?.(source);
		}
	}, [onFailed, source]);
	const press = React.useCallback((): void => {
		if (link !== null) {
			openInBrowser(link);
			return;
		}
		// Nothing to show full screen until it is known where the picture loads from.
		if (source !== null) {
			setViewing(true);
		}
	}, [link, source]);
	const close = React.useCallback((): void => {
		setViewing(false);
	}, []);
	const openSource = React.useCallback((): void => {
		openInBrowser(image.href);
	}, [image.href]);

	if (source !== null && failedKey === keyOf(source)) {
		return (
			<View className="flex-row items-center gap-3 rounded-md border border-border bg-muted px-3 py-3" testID="markdown-picture-failed">
				<Icon icon={ImageOffIcon} size="md" colorClassName="accent-muted-foreground" />
				<View className="flex-1 gap-1">
					<Text className="font-sans text-sm text-foreground">{`${description} can't be shown here.`}</Text>
					{openableHref(image.href) === null ? null : (
						<Text accessibilityRole="link" accessibilityHint="Opens in your browser" onPress={openSource} className="font-sans-medium text-sm text-info-foreground underline">
							Open in browser
						</Text>
					)}
				</View>
			</View>
		);
	}
	return (
		<>
			<Pressable
				accessibilityRole={link === null ? "imagebutton" : "link"}
				accessibilityLabel={description}
				accessibilityHint={link === null ? "Opens the image full screen" : "Opens in your browser"}
				onPress={press}
				className="active:opacity-80"
				testID="markdown-picture">
				{source === null ? (
					<View className="rounded-md bg-muted" style={pendingFrame} testID="markdown-picture-pending" />
				) : (
					<StyledImage
						source={source}
						contentFit="contain"
						onLoad={load}
						onError={fail}
						transition={FADE_IN_MS}
						accessible={false}
						className="rounded-md bg-muted"
						style={frame}
						testID="markdown-picture-image"
					/>
				)}
			</Pressable>
			<ImageViewer source={viewing ? source : null} description={description} browserUrl={image.href} onClose={close} />
		</>
	);
}
