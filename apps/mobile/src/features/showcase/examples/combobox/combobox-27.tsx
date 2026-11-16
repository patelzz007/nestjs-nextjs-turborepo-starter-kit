import BanIcon from "lucide-react-native/icons/ban";
import CodeIcon from "lucide-react-native/icons/code";
import PaletteIcon from "lucide-react-native/icons/palette";
import MegaphoneIcon from "lucide-react-native/icons/megaphone";
import HeadsetIcon from "lucide-react-native/icons/headset";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";

const TEAMS: readonly ComboboxOption<string>[] = [
	{ value: "none", label: "No team", leading: <IconTile icon={BanIcon} tone="neutral" size="sm" /> },
	{ value: "engineering", label: "Engineering", leading: <IconTile icon={CodeIcon} tone="blue" size="sm" /> },
	{ value: "design", label: "Design", leading: <IconTile icon={PaletteIcon} tone="violet" size="sm" /> },
	{ value: "marketing", label: "Marketing", leading: <IconTile icon={MegaphoneIcon} tone="orange" size="sm" /> },
	{ value: "support", label: "Support", leading: <IconTile icon={HeadsetIcon} tone="green" size="sm" /> },
];

export function Combobox27Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("engineering");
	return <Combobox label="Team" options={TEAMS} value={value} onChange={setValue} searchPlaceholder="Set team…" />;
}
