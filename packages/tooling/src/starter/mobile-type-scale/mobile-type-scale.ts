/**
 * The phone sets its text in the mobile type scale only (packages/tokens mobile-typography.ts, ADR 079):
 * `text-display`, `text-h1` … `text-overline`, each a size and a line height from the mobile visual spec.
 * Tailwind's generic steps (`text-sm`, `text-lg`, …) and the web's chrome sizes (`text-badge-sm`, …) are
 * off that scale: some are a point or two away from a role (`text-lg` is 18 pt, between two roles), and
 * mobile.css does not define the web's chrome sizes at all. Jest compiles no styles, so no component
 * test can notice either.
 */
import { stripComments } from "../ui-native-kit-contract/ui-native-kit-contract.ts";

/** The source code of the phone: the app and its UI kit. */
export const MOBILE_TYPE_SOURCE_ROOTS = ["apps/mobile/src", "packages/ui-native/src"];

/** Tailwind's own text sizes and the web's chrome sizes: none of them is a mobile type role. */
const OFF_SCALE_SIZES = [
	"xs",
	"sm",
	"base",
	"lg",
	"xl",
	"2xl",
	"3xl",
	"4xl",
	"5xl",
	"6xl",
	"7xl",
	"8xl",
	"9xl",
	"sidebar-caption",
	"sidebar-section",
	"badge-xs",
	"badge-sm",
	"kbd",
	"micro",
	"chip",
	"toast-countdown",
	"calendar-caption",
];

/** A class token: preceded by the start, a space, a quote, a backtick or a variant's colon; followed by the end, a space, a quote or a backtick. */
const OFF_SCALE_CLASS = new RegExp(`(?<![\\w-])text-(?<size>${OFF_SCALE_SIZES.join("|")})(?![\\w-])`, "gu");

/** The off-scale text-size classes a source file uses (comments ignored). */
export function offScaleTextSizes(source: string): string[] {
	return [...stripComments(source).matchAll(OFF_SCALE_CLASS)].map((match) => `text-${match.groups?.size ?? ""}`);
}
