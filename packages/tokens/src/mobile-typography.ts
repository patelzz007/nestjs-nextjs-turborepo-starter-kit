// ============================================
// mobile-typography.ts — the Expo app's type scale and radii (ADR 079)
// ============================================
// The mobile visual spec (owner, 2026-11-15), one entry per row. Sizes are points
// that follow the system text size (Android's sp), line heights are points (dp).
// mobile.css turns each role into one utility (`text-h1` sets the size and the line
// height), and each radius into `rounded-<name>`. The weight is the role's typeface:
// the kit's text roles (packages/ui-native text.tsx) and the button pair each size
// with its Geist family (`font-sans-bold` …), since React Native picks a font by
// family, not by weight. The web never reads these.

import type { MobileRadii, MobileTypeScale } from "./schema";
import { px } from "./value";

/** Regular, Medium, Semibold, Bold: the four weights the phone uses (body text, labels, buttons, headings). */
const REGULAR = 400;
const MEDIUM = 500;
const SEMIBOLD = 600;
const BOLD = 700;

export const MOBILE_TYPE_SCALE: MobileTypeScale = {
	/** A hero figure or the one big title of a screen. */
	display: { size: px(32), lineHeight: px(40), weight: BOLD },
	/** A screen's title. */
	h1: { size: px(28), lineHeight: px(36), weight: BOLD },
	/** A page heading. */
	h2: { size: px(24), lineHeight: px(32), weight: BOLD },
	/** A section heading. */
	h3: { size: px(20), lineHeight: px(28), weight: SEMIBOLD },
	/** A card's heading. */
	h4: { size: px(16), lineHeight: px(24), weight: SEMIBOLD },
	/** Running text that leads a screen. */
	"body-lg": { size: px(16), lineHeight: px(24), weight: REGULAR },
	/** Running text. */
	body: { size: px(14), lineHeight: px(21), weight: REGULAR },
	/** Running text that needs a little weight (a row's title). */
	"body-medium": { size: px(14), lineHeight: px(21), weight: MEDIUM },
	/** A form field's or a control's label. */
	label: { size: px(13), lineHeight: px(18), weight: MEDIUM },
	/** Hints, captions and metadata. */
	caption: { size: px(12), lineHeight: px(16), weight: REGULAR },
	/** A button's label. */
	button: { size: px(15), lineHeight: px(20), weight: SEMIBOLD },
	/** The tab bar's and the drawer's labels. */
	nav: { size: px(12), lineHeight: px(16), weight: MEDIUM },
	/** An uppercase group label above a list. */
	overline: { size: px(11), lineHeight: px(16), weight: SEMIBOLD },
};

export const MOBILE_RADII: MobileRadii = {
	/** Buttons. */
	button: px(10),
	/** Cards, grouped lists, fields' wells. */
	card: px(12),
	/** Large cards: hero panels, sheets' content. */
	"card-lg": px(16),
};
