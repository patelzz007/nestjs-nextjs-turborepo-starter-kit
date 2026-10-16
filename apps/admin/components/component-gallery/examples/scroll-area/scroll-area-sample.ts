// Shared sample photos for the Scroll Area examples. All are served from
// images.unsplash.com, the one remote host `next.config` allows for
// `next/image`; the strip repeats a small set of abstract photos.

/** The intrinsic size `next/image` reserves for each sample photo. */
export const SCROLL_PHOTO_WIDTH = 400;
export const SCROLL_PHOTO_HEIGHT = 300;

export interface ScrollPhoto {
	readonly id: string;
	readonly src: string;
	readonly alt: string;
}

const UNSPLASH_PARAMS = `?auto=format&fit=crop&w=${String(SCROLL_PHOTO_WIDTH)}&h=${String(SCROLL_PHOTO_HEIGHT)}&q=80`;

const PHOTO_IDS: readonly string[] = [
	"photo-1579546929518-9e396f3cc809",
	"photo-1618005182384-a83a8bd57fbe",
	"photo-1620641788421-7a1c342ea42e",
	"photo-1620121692029-d088224ddc74",
	"photo-1541701494587-cb58502866ab",
];

/** How many photos the scrolling strips hold. */
const SCROLL_PHOTO_COUNT = 10;

export const SCROLL_PHOTOS: readonly ScrollPhoto[] = Array.from({ length: SCROLL_PHOTO_COUNT }, (_: undefined, position: number): ScrollPhoto => {
	const photoId = PHOTO_IDS.at(position % PHOTO_IDS.length) ?? "";
	const number = String(position + 1);
	return { id: `sample-${number}`, src: `https://images.unsplash.com/${photoId}${UNSPLASH_PARAMS}`, alt: `Abstract sample artwork ${number}` };
});
