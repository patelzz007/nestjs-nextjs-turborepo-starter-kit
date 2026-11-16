import { RelativeTime } from "@workspace/ui-native/components/relative-time";
import * as React from "react";

import { SAMPLE_LOCALE } from "../example-support";

const NOW_MS = Date.UTC(2026, 10, 15, 9, 30);
const FIVE_MINUTES_MS = 300_000;

export function RelativeTimeDo1Example(): React.JSX.Element {
	return <RelativeTime value={NOW_MS - FIVE_MINUTES_MS} now={NOW_MS} locale={SAMPLE_LOCALE} timeZone="UTC" />;
}
