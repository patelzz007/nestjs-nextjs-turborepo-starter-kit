// Shared sample photos for the Aspect Ratio examples. All are served from
// images.unsplash.com, the one remote host `next.config` allows for
// `next/image`; the intrinsic size is the source's, the frame crops it.

/** The intrinsic size `next/image` reserves for each sample photo. */
export const SAMPLE_PHOTO_WIDTH = 1000;
export const SAMPLE_PHOTO_HEIGHT = 800;

const UNSPLASH_PARAMS = `?auto=format&fit=crop&w=${String(SAMPLE_PHOTO_WIDTH)}&h=${String(SAMPLE_PHOTO_HEIGHT)}&q=80`;

/** Abstract sample photos the examples share. */
export const SAMPLE_PHOTOS: Readonly<Record<"gradient" | "waves" | "fluid" | "prism" | "marble" | "code", string>> = {
	gradient: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809${UNSPLASH_PARAMS}`,
	waves: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe${UNSPLASH_PARAMS}`,
	fluid: `https://images.unsplash.com/photo-1620641788421-7a1c342ea42e${UNSPLASH_PARAMS}`,
	prism: `https://images.unsplash.com/photo-1620121692029-d088224ddc74${UNSPLASH_PARAMS}`,
	marble: `https://images.unsplash.com/photo-1541701494587-cb58502866ab${UNSPLASH_PARAMS}`,
	code: `https://images.unsplash.com/photo-1555066931-4365d14bab8c${UNSPLASH_PARAMS}`,
};
