import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function Sonner1Example(): React.JSX.Element {
	const toast = useToast();
	const show = React.useCallback((): void => {
		toast.show("default", "Event has been created");
	}, [toast]);
	return <Button label="Show Toast" variant="outline" onPress={show} className="self-center" />;
}
