import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import * as React from "react";
import { View } from "react-native";

const ENVIRONMENTS: readonly string[] = ["Dev", "Staging", "Production"];

interface EnvironmentButtonProps {
	readonly name: string;
	readonly picked: boolean;
	readonly onPick: (name: string) => void;
}

function EnvironmentButton({ name, picked, onPick }: EnvironmentButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(name);
	}, [name, onPick]);
	return <Button label={name} variant={picked ? "secondary" : "outline"} size="sm" onPress={press} className="flex-1" />;
}

export function ButtonGroup45Example(): React.JSX.Element {
	const [environment, setEnvironment] = React.useState<string>("Staging");
	return (
		<View className="gap-2">
			<ButtonGroup accessibilityLabel="Environment">
				{ENVIRONMENTS.map((name: string): React.JSX.Element => (
					<EnvironmentButton key={name} name={name} picked={environment === name} onPick={setEnvironment} />
				))}
			</ButtonGroup>
			{environment === "Production" ? (
				<StatusBadge icon={CircleDotIcon} label="Live" accessibilityLabel="Production is live" tone="success" pulsing className="self-start" />
			) : null}
		</View>
	);
}
