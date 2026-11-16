import { RelativeTime } from "@workspace/ui-native/components/relative-time";
import * as React from "react";

import { SAMPLE_LOCALE } from "../example-support";

const NOW_MS = Date.UTC(2026, 10, 15, 9, 30);
const HOUR_MS = 3_600_000;

export function RelativeTimeDo2Example(): React.JSX.Element {
	return <RelativeTime value={NOW_MS - HOUR_MS} now={NOW_MS} locale={SAMPLE_LOCALE} timeZone="UTC" />;
}
