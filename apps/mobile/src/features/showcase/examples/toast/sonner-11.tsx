import { Text, View } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

// A deployment report: the details as label and value rows.
interface DeploymentDetail {
	readonly label: string;
	readonly value: string;
	readonly code?: boolean | undefined;
}

const DEPLOYMENT_DETAILS: readonly DeploymentDetail[] = [
	{ label: "Environment", value: "Production" },
	{ label: "Duration", value: "42s" },
	{ label: "Commit", value: "a1b2c3d", code: true },
];

const DETAILS = (
	<View className="gap-1">
		{DEPLOYMENT_DETAILS.map((detail: DeploymentDetail): React.JSX.Element => (
			<View key={detail.label} className="flex-row justify-between gap-4">
				<Text className="text-caption font-sans text-muted-foreground">{detail.label}</Text>
				<Text className={detail.code === true ? "text-caption font-code text-foreground" : "text-caption font-sans-medium text-foreground"}>{detail.value}</Text>
			</View>
		))}
	</View>
);

export function Sonner11Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.success("Your changes are live.", {
			title: "Deployment Successful",
			content: DETAILS,
			actions: (
				<>
					<Button label="View Logs" size="xs" variant="outline" onPress={close} />
					<Button label="Open Site" size="xs" onPress={close} />
				</>
			),
		});
	}, [close, toast]);
	return <Button label="Deployment Toast" variant="outline" onPress={show} className="self-center" />;
}
