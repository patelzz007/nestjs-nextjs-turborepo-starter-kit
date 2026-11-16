import CircleXIcon from "lucide-react-native/icons/circle-x";
import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function AlertDont2Example(): React.JSX.Element {
	return <Alert tone="error" icon={CircleXIcon} title="Saved" message="Your changes were saved." />;
}
