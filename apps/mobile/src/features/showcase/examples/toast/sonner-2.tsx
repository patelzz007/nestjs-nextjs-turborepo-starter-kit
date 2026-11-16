import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function Sonner2Example(): React.JSX.Element {
	const toast = useToast();
	const show = React.useCallback((): void => {
		toast.show("default", "Monday, January 3rd at 6:00pm", { title: "Event has been created" });
	}, [toast]);
	return <Button label="Show Toast with Description" variant="outline" onPress={show} className="self-center" />;
}
