import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Badge } from "@workspace/ui-native/components/badge";
import { Text, View } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = <IconTile icon={ShieldCheckIcon} tone="blue" size="md" />;

interface Check {
	readonly name: string;
	readonly done: boolean;
}

const CHECKS: readonly Check[] = [
	{ name: "Two-factor sign-in", done: true },
	{ name: "Password strength", done: false },
	{ name: "Active sessions", done: false },
];

function CheckRow({ check }: { readonly check: Check }): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-between py-1">
			<Text className="text-body font-sans text-foreground">{check.name}</Text>
			<Badge label={check.done ? "Done" : "Pending"} tone={check.done ? "success" : "warning"} size="sm" />
		</View>
	);
}

export function AlertDialog14Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Run security audit" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Run the security audit?"
				description="We check 3 areas and email you the report."
				confirmLabel="Run audit"
				cancelLabel="Not now"
				media={MEDIA}>
				<View>
					{CHECKS.map((check: Check): React.JSX.Element => (
						<CheckRow key={check.name} check={check} />
					))}
				</View>
			</AlertDialog>
		</>
	);
}
