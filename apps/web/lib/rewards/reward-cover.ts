/*
 * Cover shapes shared by the reward surfaces and their loading bones, so a
 * bone and the cover that replaces it take the same space (no layout shift).
 * Covers are uploaded cropped to 16:9 (1200×675).
 */

/** Browse cards and the detail hero — the cover's own wide shape. */
export const REWARD_CARD_COVER_RATIO = 16 / 9;

/** List-row thumbnails — a little taller than 16:9, so a small crop still shows the dish or product. */
export const REWARD_LIST_ROW_COVER_RATIO = 4 / 3;
