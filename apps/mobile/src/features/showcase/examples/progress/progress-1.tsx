import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";

export function Progress1Example(): React.JSX.Element {
	return <Progress value={56} label="Upload progress" showValue accessibilityLabel="Upload progress" />;
}
