import * as React from "react";
import { BluetoothIcon, MapPinIcon, PlaneIcon, WifiIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup multiple orientation="vertical" spacing={1} defaultValue={["wifi", "bluetooth"]}>
				<ToggleGroupItem value="wifi" aria-label="Wi-Fi" className="w-full">
					<WifiIcon />
					Wi-Fi
				</ToggleGroupItem>
				<ToggleGroupItem value="bluetooth" aria-label="Bluetooth" className="w-full">
					<BluetoothIcon />
					Bluetooth
				</ToggleGroupItem>
				<ToggleGroupItem value="airplane" aria-label="Airplane Mode" className="w-full">
					<PlaneIcon />
					Airplane Mode
				</ToggleGroupItem>
				<ToggleGroupItem value="location" aria-label="Location" className="w-full">
					<MapPinIcon />
					Location
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
