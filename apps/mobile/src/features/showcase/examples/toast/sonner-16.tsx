import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

/** The warning stays longer than a usual one, so there is time to react. */
const SESSION_WARNING_MS = 10_000;

export function Sonner16Example(): React.JSX.Element {
	const toast = useToast();
	const extend = React.useCallback((): void => {
		toast.success("Session extended");
	}, [toast]);
	const show = React.useCallback((): void => {
		toast.warning("Your session will expire in 5 minutes due to inactivity.", {
			title: "Session Expiring",
			look: "invert",
			durationMs: SESSION_WARNING_MS,
			actions: <Button label="Extend Session" size="xs" onPress={extend} />,
		});
	}, [extend, toast]);
	return <Button label="Session Warning Toast" variant="outline" onPress={show} className="self-center" />;
}
