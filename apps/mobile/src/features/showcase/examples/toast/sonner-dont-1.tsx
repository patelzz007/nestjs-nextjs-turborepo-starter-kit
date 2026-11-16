import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function SonnerDont1Example(): React.JSX.Element {
	const toast = useToast();
	const show = React.useCallback((): void => {
		toast.success("Success! Your profile information has been successfully saved to our servers and will be visible to other members of your workspace shortly.");
	}, [toast]);
	return <Button label="Save" variant="outline" onPress={show} className="self-center" />;
}
