import * as React from "react";
import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { RelativeTime } from "@workspace/ui/components/relative-time";

import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";

const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

export function RelativeTimeDont1Example(): React.JSX.Element {
	const now = useSampleNow();
	return (
		<p className="text-sm text-muted-foreground">
			Contract signed <RelativeTime epochMs={now - THREE_WEEKS_MS} region={PLATFORM_DISPLAY_REGION} />
		</p>
	);
}
