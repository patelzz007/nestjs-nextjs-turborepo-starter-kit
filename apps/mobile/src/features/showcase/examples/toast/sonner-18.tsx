import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function Sonner18Example(): React.JSX.Element {
	const toast = useToast();
	const show = React.useCallback((): void => {
		// No timer: the close button is the only way it goes.
		toast.success("report-2025.pdf has been saved to your documents.", { title: "File uploaded successfully", durationMs: null, closeButton: true });
	}, [toast]);
	return <Button label="Toast with Close Button" variant="outline" onPress={show} className="self-center" />;
}
