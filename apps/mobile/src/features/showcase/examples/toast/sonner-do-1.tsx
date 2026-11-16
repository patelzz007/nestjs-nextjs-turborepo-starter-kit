import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function SonnerDo1Example(): React.JSX.Element {
	const toast = useToast();
	const show = React.useCallback((): void => {
		toast.success("Profile saved.");
	}, [toast]);
	return <Button label="Save" variant="outline" onPress={show} className="self-center" />;
}
