import Volume2Icon from "lucide-react-native/icons/volume-2";
import VolumeXIcon from "lucide-react-native/icons/volume-x";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function Toggle14Example(): React.JSX.Element {
	const [muted, setMuted] = React.useState<boolean>(false);
	return (
		<Toggle
			label="Sound"
			pressedLabel="Muted"
			icon={Volume2Icon}
			pressedIcon={VolumeXIcon}
			variant="outline"
			size="lg"
			pressed={muted}
			onChange={setMuted}
			className="self-start"
		/>
	);
}
