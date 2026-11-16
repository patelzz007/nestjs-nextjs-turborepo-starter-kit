import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";

export function Progress2Example(): React.JSX.Element {
	return <Progress value={30} size="sm" label="Small progress" showValue accessibilityLabel="Small progress" />;
}
