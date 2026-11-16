import MonitorIcon from "lucide-react-native/icons/monitor";
import MoonIcon from "lucide-react-native/icons/moon";
import SunIcon from "lucide-react-native/icons/sun";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const THEMES: readonly ToggleGroupOption<string>[] = [
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
	{ value: "system", label: "System", icon: MonitorIcon },
];

export function ToggleGroup10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("light");
	return <ToggleGroup type="single" label="Theme" options={THEMES} value={value} onChange={setValue} variant="outline" />;
}
