import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

export function BadgeDont2Example(): React.JSX.Element {
	return <Badge variant="warning-light">This invoice is due in three days, so send a reminder</Badge>;
}
