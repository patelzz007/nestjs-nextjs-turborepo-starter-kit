import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function Sonner12Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.info("v2.4.0 includes performance improvements and bug fixes.", {
			title: "New Version Available",
			look: "accent",
			actions: (
				<>
					<Button label="Later" size="xs" variant="ghost" onPress={close} />
					<Button label="Update Now" size="xs" onPress={close} />
				</>
			),
		});
	}, [close, toast]);
	return <Button label="Update Available Toast" variant="outline" onPress={show} className="self-center" />;
}
