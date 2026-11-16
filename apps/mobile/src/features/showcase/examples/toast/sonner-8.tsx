import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function Sonner8Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const remove = React.useCallback((): void => {
		toast.success("Item deleted");
	}, [toast]);
	const show = React.useCallback((): void => {
		// No timer: the notice waits for a decision.
		shownId.current = toast.show("default", "This item will be permanently deleted.", {
			title: "Confirm deletion",
			durationMs: null,
			actions: (
				<>
					<Button label="Delete" size="xs" variant="destructive" onPress={remove} />
					<Button label="Cancel" size="xs" variant="outline" onPress={close} />
				</>
			),
		});
	}, [close, remove, toast]);
	return <Button label="Confirm Action" variant="outline" onPress={show} className="self-center" />;
}
