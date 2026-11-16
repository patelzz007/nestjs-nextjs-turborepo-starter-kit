import MinusIcon from "lucide-react-native/icons/minus";
import PlusIcon from "lucide-react-native/icons/plus";
import Volume2Icon from "lucide-react-native/icons/volume-2";
import VolumeXIcon from "lucide-react-native/icons/volume-x";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

const STEP = 5;
const MAX = 100;

export function ButtonGroup28Example(): React.JSX.Element {
	const [volume, setVolume] = React.useState<number>(50);
	const [muted, setMuted] = React.useState<boolean>(false);
	const down = React.useCallback((): void => {
		setVolume((value: number): number => Math.max(0, value - STEP));
	}, []);
	const up = React.useCallback((): void => {
		setVolume((value: number): number => Math.min(MAX, value + STEP));
	}, []);
	const toggleMute = React.useCallback((): void => {
		setMuted((value: boolean): boolean => !value);
	}, []);
	return (
		<ButtonGroup accessibilityLabel="Volume" className="self-start">
			<IconButton icon={MinusIcon} label="Volume down" disabled={volume === 0} onPress={down} />
			<Button
				label={muted ? "Muted" : `${String(volume)}%`}
				variant="outline"
				icon={muted ? VolumeXIcon : Volume2Icon}
				accessibilityHint="Mutes or unmutes"
				onPress={toggleMute}
			/>
			<IconButton icon={PlusIcon} label="Volume up" disabled={volume === MAX} onPress={up} />
		</ButtonGroup>
	);
}
