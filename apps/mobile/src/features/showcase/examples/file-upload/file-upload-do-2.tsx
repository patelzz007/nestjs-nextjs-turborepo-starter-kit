import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";

export function FileUploadDo2Example(): React.JSX.Element {
	return <Progress value={60} accessibilityLabel="Uploading report.pdf" valueText="60%" />;
}
