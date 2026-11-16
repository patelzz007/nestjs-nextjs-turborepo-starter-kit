import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function AlertDont1Example(): React.JSX.Element {
	return <Alert tone="error" title="Error" message="Error 0x80041." />;
}
