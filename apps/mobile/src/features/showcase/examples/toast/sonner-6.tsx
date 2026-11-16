import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function Sonner6Example(): React.JSX.Element {
	const toast = useToast();
	// Undo replaces the notice with its own confirmation.
	const undo = React.useCallback((): void => {
		toast.success("Action undone");
	}, [toast]);
	const show = React.useCallback((): void => {
		toast.show("default", "The conversation has been moved to archive.", {
			title: "Message archived",
			actions: <Button label="Undo" size="xs" variant="outline" onPress={undo} />,
		});
	}, [toast, undo]);
	return <Button label="Toast with Action" variant="outline" onPress={show} className="self-center" />;
}
