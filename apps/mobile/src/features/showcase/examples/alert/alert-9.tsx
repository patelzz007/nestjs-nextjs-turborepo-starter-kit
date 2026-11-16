import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function Alert9Example(): React.JSX.Element {
	return <Alert tone="invert" icon={CircleCheckIcon} iconColorClassName="accent-success" title="Deployment complete" message="Your site is live." />;
}
