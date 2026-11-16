import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";

export function ProgressDo1Example(): React.JSX.Element {
	return <Progress value={3} max={5} label="Uploading photos" showValue valueText="3 of 5" accessibilityLabel="Uploading photos" />;
}
