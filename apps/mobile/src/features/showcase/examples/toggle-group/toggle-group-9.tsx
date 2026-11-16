import BluetoothIcon from "lucide-react-native/icons/bluetooth";
import MapPinIcon from "lucide-react-native/icons/map-pin";
import PlaneIcon from "lucide-react-native/icons/plane";
import WifiIcon from "lucide-react-native/icons/wifi";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const CONNECTIONS: readonly ToggleGroupOption<string>[] = [
	{ value: "wifi", label: "Wi-Fi", icon: WifiIcon },
	{ value: "bluetooth", label: "Bluetooth", icon: BluetoothIcon },
	{ value: "airplane", label: "Airplane mode", icon: PlaneIcon },
	{ value: "location", label: "Location", icon: MapPinIcon },
];

export function ToggleGroup9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<readonly string[]>(["wifi", "location"]);
	return <ToggleGroup type="multiple" label="Connections" options={CONNECTIONS} value={value} onChange={setValue} orientation="vertical" />;
}
