import * as React from "react";
import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { RelativeTime } from "@workspace/ui/components/relative-time";

import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function RelativeTimeDont2Example(): React.JSX.Element {
	const now = useSampleNow();
	return <RelativeTime epochMs={now - FIVE_MINUTES_MS} region={PLATFORM_DISPLAY_REGION} aria-label="Recently" />;
}
