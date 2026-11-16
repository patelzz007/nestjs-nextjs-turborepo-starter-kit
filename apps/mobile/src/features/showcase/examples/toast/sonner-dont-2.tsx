import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function SonnerDont2Example(): React.JSX.Element {
	const toast = useToast();
	const show = React.useCallback((): void => {
		// The only way back is a button on a toast that leaves on its own.
		toast.show("default", "Project deleted.", { durationMs: 2_000 });
	}, [toast]);
	return <Button label="Delete" variant="outline" onPress={show} className="self-center" />;
}
