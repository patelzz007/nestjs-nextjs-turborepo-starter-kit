import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";

export function Progress3Example(): React.JSX.Element {
	return <Progress value={70} size="xl" label="Large progress" showValue accessibilityLabel="Large progress" />;
}
