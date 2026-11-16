import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function Alert6Example(): React.JSX.Element {
	return <Alert tone="success" icon={CircleCheckIcon} title="All systems working" message="Everything is set up. You can carry on." />;
}
