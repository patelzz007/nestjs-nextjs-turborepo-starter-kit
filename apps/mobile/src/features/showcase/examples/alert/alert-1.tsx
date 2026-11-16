import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function Alert1Example(): React.JSX.Element {
	return <Alert tone="neutral" title="Heads up!" message="You can add components to your app with the kit." />;
}
