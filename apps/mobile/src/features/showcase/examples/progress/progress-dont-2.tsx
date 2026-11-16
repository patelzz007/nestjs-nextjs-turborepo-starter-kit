import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";

export function ProgressDont2Example(): React.JSX.Element {
	return <Progress value={100} variant="destructive" label="Backup complete" showValue accessibilityLabel="Backup complete" />;
}
