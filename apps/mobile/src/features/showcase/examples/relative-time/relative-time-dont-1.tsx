import { RelativeTime } from "@workspace/ui-native/components/relative-time";
import * as React from "react";

import { SAMPLE_LOCALE } from "../example-support";

const NOW_MS = Date.UTC(2026, 10, 15, 9, 30);
const TWO_YEARS_MS = 63_072_000_000;

// "2 years ago" for a contract's signing date: the reader needs the date itself.
export function RelativeTimeDont1Example(): React.JSX.Element {
	return <RelativeTime value={NOW_MS - TWO_YEARS_MS} now={NOW_MS} locale={SAMPLE_LOCALE} timeZone="UTC" />;
}
