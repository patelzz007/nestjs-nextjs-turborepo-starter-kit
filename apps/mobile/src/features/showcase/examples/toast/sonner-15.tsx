import { Avatar } from "@workspace/ui-native/components/avatar";
import { Text } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

const INVITER = <Avatar name="Sarah Chen" imageUrl={null} size="md" />;
const SENT = <Text className="text-caption font-sans text-invert-foreground opacity-70">Just now</Text>;

export function Sonner15Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const accept = React.useCallback((): void => {
		toast.success("Invitation accepted");
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.info('Invited you to collaborate on "Design System v2"', {
			title: "Sarah Chen",
			look: "invert",
			leading: INVITER,
			content: SENT,
			actions: (
				<>
					<Button label="Decline" size="xs" variant="secondary" onPress={close} />
					<Button label="Accept" size="xs" onPress={accept} />
				</>
			),
		});
	}, [accept, close, toast]);
	return <Button label="Invite Toast" variant="outline" onPress={show} className="self-center" />;
}
