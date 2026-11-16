// Shared sample photos for the Card examples. All are served from
// images.unsplash.com, the one remote host `next.config` allows for
// `next/image`; the intrinsic size is the source's, the card crops it.

/** The intrinsic size `next/image` reserves for each sample photo. */
export const CARD_PHOTO_WIDTH = 1000;
export const CARD_PHOTO_HEIGHT = 800;

const UNSPLASH_PARAMS = `?auto=format&fit=crop&w=${String(CARD_PHOTO_WIDTH)}&h=${String(CARD_PHOTO_HEIGHT)}&q=80`;

/** Abstract sample photos the examples share. */
export const CARD_PHOTOS: Readonly<Record<"gradient" | "waves" | "fluid" | "prism", string>> = {
	gradient: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809${UNSPLASH_PARAMS}`,
	waves: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe${UNSPLASH_PARAMS}`,
	fluid: `https://images.unsplash.com/photo-1620641788421-7a1c342ea42e${UNSPLASH_PARAMS}`,
	prism: `https://images.unsplash.com/photo-1620121692029-d088224ddc74${UNSPLASH_PARAMS}`,
};
