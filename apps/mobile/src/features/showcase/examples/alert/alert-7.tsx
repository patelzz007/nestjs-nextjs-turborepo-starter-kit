import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function Alert7Example(): React.JSX.Element {
	return <Alert tone="warning" icon={TriangleAlertIcon} title="Your trial ends soon" message="Go to Settings to choose a plan, or contact support." />;
}
