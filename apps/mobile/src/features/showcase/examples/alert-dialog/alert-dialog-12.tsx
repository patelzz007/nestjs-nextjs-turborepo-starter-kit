import BellRingIcon from "lucide-react-native/icons/bell-ring";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Badge } from "@workspace/ui-native/components/badge";
import { View } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = (
	<View className="flex-row items-center gap-3">
		<IconTile icon={BellRingIcon} tone="red" size="md" />
		<Badge label="Expires in 2 days" tone="destructive" variant="soft" />
	</View>
);

export function AlertDialog12Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Billing alert" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Your plan expires soon"
				description="Your payment failed. Update your card to keep the Pro features."
				confirmLabel="Update payment"
				cancelLabel="Remind me later"
				media={MEDIA}
			/>
		</>
	);
}
