import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

const INTERVALS: readonly string[] = ["1m", "5m", "1h", "1D", "1W", "Auto"];

interface IntervalButtonProps {
	readonly name: string;
	readonly picked: boolean;
	readonly onPick: (name: string) => void;
}

function IntervalButton({ name, picked, onPick }: IntervalButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(name);
	}, [name, onPick]);
	return <Button label={name} variant={picked ? "secondary" : "outline"} size="xs" onPress={press} />;
}

export function ButtonGroup46Example(): React.JSX.Element {
	const [interval, setInterval] = React.useState<string>("1h");
	return (
		<ButtonGroup accessibilityLabel="Interval" className="self-start">
			{INTERVALS.map((name: string): React.JSX.Element => (
				<IntervalButton key={name} name={name} picked={interval === name} onPick={setInterval} />
			))}
		</ButtonGroup>
	);
}
