import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Badge } from "@workspace/ui-native/components/badge";
import { View } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = (
	<View className="flex-row items-center gap-3">
		<IconTile icon={RefreshCwIcon} tone="blue" size="md" />
		<Badge label="v2.4.0" tone="info" />
	</View>
);

export function AlertDialog11Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Check for updates" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Update ready"
				description="Restart the app to finish installing. It takes about a minute."
				confirmLabel="Restart now"
				cancelLabel="Later"
				media={MEDIA}
			/>
		</>
	);
}
