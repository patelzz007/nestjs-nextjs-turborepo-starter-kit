import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function Alert2Example(): React.JSX.Element {
	return <Alert tone="neutral" icon={CircleCheckIcon} title="Success! Your changes have been saved" message="This is an alert with an icon, a title and a description." />;
}
