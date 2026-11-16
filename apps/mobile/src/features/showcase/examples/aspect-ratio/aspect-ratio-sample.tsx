// What the Aspect Ratio examples share: the web examples' abstract sample photos (served from images.unsplash.com,
// the same sources), and one framed photo at a ratio.

import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import * as React from "react";
import { Image } from "react-native";

const UNSPLASH_PARAMS = "?auto=format&fit=crop&w=1000&h=800&q=80";

export const SAMPLE_PHOTOS: Readonly<Record<"gradient" | "waves" | "fluid" | "prism" | "marble" | "code", string>> = {
	gradient: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809${UNSPLASH_PARAMS}`,
	waves: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe${UNSPLASH_PARAMS}`,
	fluid: `https://images.unsplash.com/photo-1620641788421-7a1c342ea42e${UNSPLASH_PARAMS}`,
	prism: `https://images.unsplash.com/photo-1620121692029-d088224ddc74${UNSPLASH_PARAMS}`,
	marble: `https://images.unsplash.com/photo-1541701494587-cb58502866ab${UNSPLASH_PARAMS}`,
	code: `https://images.unsplash.com/photo-1555066931-4365d14bab8c${UNSPLASH_PARAMS}`,
};

/** A photo cropped to `ratio`, in a rounded, bordered frame; `narrow` frames are kept to a column's width. */
export function FramedPhoto({
	ratio,
	photo,
	alt,
	narrow = false,
}: {
	readonly ratio: number;
	readonly photo: string;
	readonly alt: string;
	readonly narrow?: boolean;
}): React.JSX.Element {
	const source = React.useMemo(() => ({ uri: photo }), [photo]);
	return (
		<AspectRatio
			ratio={ratio}
			className={narrow ? "max-w-80 self-center overflow-hidden rounded-xl border border-border bg-muted" : "overflow-hidden rounded-xl border border-border bg-muted"}>
			<Image source={source} accessibilityLabel={alt} resizeMode="cover" className="size-full" />
		</AspectRatio>
	);
}
