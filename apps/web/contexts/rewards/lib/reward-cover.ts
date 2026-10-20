/*
 * Cover shapes and drawn widths shared by the reward surfaces and their
 * loading bones, so a bone and the cover that replaces it take the same space
 * (no layout shift), and each screen downloads only the rendition it needs.
 * Reward images are 16:9, Full HD to 4K, with WebP renditions from 640 up to
 * the upload's own width (3840 at most).
 */

/** Browse cards, galleries and the detail hero — the images' own wide shape. */
export const REWARD_CARD_COVER_RATIO = 16 / 9;

/** List-row thumbnails — a little taller than 16:9, so a small crop still shows the dish or product. */
export const REWARD_LIST_ROW_COVER_RATIO = 4 / 3;

/** A browse card's cover: a third of the grid on wide screens, half on tablets, the full width on phones. */
export const REWARD_CARD_COVER_SIZES = "(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw";

/** List-row and preview thumbnails are drawn about 6rem wide — the smallest rendition is plenty. */
export const REWARD_THUMBNAIL_SIZES = "96px";

/** The detail page's gallery: about 60% of a 72rem column on wide screens, the full width below. */
export const REWARD_GALLERY_SIZES = "(min-width: 1024px) 45rem, 100vw";
