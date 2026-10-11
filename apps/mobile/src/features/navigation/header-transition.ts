// Which way the header's title moves when the page changes — the same way the
// page itself moves. A tab switch drifts toward the side the new tab sits on
// in the tab bar (the tab transition); a screen pushed deeper comes in from
// the right and going back brings the previous one in from the left (the push
// transition). Pure: the paths in, a signed distance out.

import { PUSH_TITLE_DRIFT, TAB_DRIFT } from "../../lib/screen-transitions";
import { APP_TABS, type AppTab } from "./app-tabs";

const PATH_SEPARATOR = "/";
const NO_DRIFT = 0;
const FROM_RIGHT = 1;
const FROM_LEFT = -1;

/** The path's segments: "/settings/security" → ["settings", "security"]; Home ("/") → []. */
function segmentsOf(pathname: string): readonly string[] {
	return pathname.split(PATH_SEPARATOR).filter((segment: string): boolean => segment.length > 0);
}

/** The position in the tab bar of the tab a path lives under (Home for "/" and anything unknown). */
function tabIndexOf(pathname: string): number {
	const [first] = segmentsOf(pathname);
	const route = first === undefined ? PATH_SEPARATOR : `${PATH_SEPARATOR}${first}`;
	return Math.max(
		APP_TABS.findIndex((tab: AppTab): boolean => tab.route === route),
		0,
	);
}

/**
 * Where the incoming title starts, in points from its resting place: positive
 * comes in from the right, negative from the left, 0 for no page change. The
 * outgoing title leaves by the same distance the other way.
 */
export function headerTitleDriftOf(fromPath: string, toPath: string): number {
	if (fromPath === toPath) {
		return NO_DRIFT;
	}
	const fromTab = tabIndexOf(fromPath);
	const toTab = tabIndexOf(toPath);
	if (fromTab !== toTab) {
		return (toTab > fromTab ? FROM_RIGHT : FROM_LEFT) * TAB_DRIFT;
	}
	return (segmentsOf(toPath).length >= segmentsOf(fromPath).length ? FROM_RIGHT : FROM_LEFT) * PUSH_TITLE_DRIFT;
}
