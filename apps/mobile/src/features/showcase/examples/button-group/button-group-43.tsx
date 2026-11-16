import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

const STANCES: readonly string[] = ["Buy", "Hold", "Sell"];

interface StanceButtonProps {
	readonly name: string;
	readonly picked: boolean;
	readonly onPick: (name: string) => void;
}

function StanceButton({ name, picked, onPick }: StanceButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(name);
	}, [name, onPick]);
	return <Button label={name} accessibilityLabel={picked ? `${name}, picked` : name} variant={picked ? "primary" : "outline"} onPress={press} />;
}

export function ButtonGroup43Example(): React.JSX.Element {
	const [stance, setStance] = React.useState<string | null>(null);
	const pick = React.useCallback((name: string): void => {
		setStance((current: string | null): string | null => (current === name ? null : name));
	}, []);
	return (
		<ButtonGroup accessibilityLabel="Stance" className="self-start">
			{STANCES.map((name: string): React.JSX.Element => (
				<StanceButton key={name} name={name} picked={stance === name} onPick={pick} />
			))}
		</ButtonGroup>
	);
}
