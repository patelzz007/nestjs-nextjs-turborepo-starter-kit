import * as React from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup10Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["light"]} variant="outline">
				<ToggleGroupItem value="light" aria-label="Light theme">
					<SunIcon />
					Light
				</ToggleGroupItem>
				<ToggleGroupItem value="dark" aria-label="Dark theme">
					<MoonIcon />
					Dark
				</ToggleGroupItem>
				<ToggleGroupItem value="system" aria-label="System theme">
					<MonitorIcon />
					System
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
