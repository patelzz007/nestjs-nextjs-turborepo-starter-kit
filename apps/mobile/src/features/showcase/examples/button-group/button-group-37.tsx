import ZoomInIcon from "lucide-react-native/icons/zoom-in";
import ZoomOutIcon from "lucide-react-native/icons/zoom-out";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

const STEP = 10;
const MIN = 10;
const MAX = 200;

export function ButtonGroup37Example(): React.JSX.Element {
	const [zoom, setZoom] = React.useState<number>(100);
	const zoomOut = React.useCallback((): void => {
		setZoom((value: number): number => Math.max(MIN, value - STEP));
	}, []);
	const zoomIn = React.useCallback((): void => {
		setZoom((value: number): number => Math.min(MAX, value + STEP));
	}, []);
	return (
		<ButtonGroup accessibilityLabel="Zoom" className="self-start">
			<IconButton icon={ZoomOutIcon} label="Zoom out" disabled={zoom === MIN} onPress={zoomOut} />
			<ButtonGroupText label={`${String(zoom)}%`} className="w-20" />
			<IconButton icon={ZoomInIcon} label="Zoom in" disabled={zoom === MAX} onPress={zoomIn} />
		</ButtonGroup>
	);
}
