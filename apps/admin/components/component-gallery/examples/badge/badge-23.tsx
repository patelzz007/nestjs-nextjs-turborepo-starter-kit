import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

/** The badge renders as a link back to the gallery's Badge section. */
const BADGE_LINK: React.JSX.Element = <a href="#component-badge" aria-label="Badge" />;

export function Badge23Example(): React.JSX.Element {
	return (
		<Badge variant="outline" render={BADGE_LINK}>
			Badge
		</Badge>
	);
}
