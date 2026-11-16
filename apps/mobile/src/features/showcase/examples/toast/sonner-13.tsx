import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

export function Sonner13Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.success("Invoice #INV-2025-0042 has been paid. $2,400.00 received.", {
			title: "Payment Successful",
			look: "invert",
			actions: <Button label="View Receipt" size="xs" variant="secondary" onPress={close} />,
		});
	}, [close, toast]);
	return <Button label="Payment Success Toast" variant="outline" onPress={show} className="self-center" />;
}
