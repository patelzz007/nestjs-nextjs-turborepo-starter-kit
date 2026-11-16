import { Avatar } from "@workspace/ui-native/components/avatar";
import { Text } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

// A message from a teammate: their avatar leads, the message and its age follow.
const MESSAGE = "Hey! I've finished the design review. Let me know when you're free to discuss.";
const SENDER = <Avatar name="Alex Johnson" imageUrl={null} size="md" />;
const SENT = <Text className="text-caption font-sans text-muted-foreground">2m ago</Text>;

export function Sonner9Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.show("default", MESSAGE, {
			title: "Alex Johnson",
			leading: SENDER,
			content: SENT,
			actions: (
				<>
					<Button label="Reply" size="xs" onPress={close} />
					<Button label="Dismiss" size="xs" variant="outline" onPress={close} />
				</>
			),
		});
	}, [close, toast]);
	return <Button label="User Message Toast" variant="outline" onPress={show} className="self-center" />;
}
