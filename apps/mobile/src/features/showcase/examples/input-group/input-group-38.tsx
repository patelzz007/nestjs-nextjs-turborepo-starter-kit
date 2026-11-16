import GlobeIcon from "lucide-react-native/icons/globe";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

const REGIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "Global", label: "Global" },
	{ value: "United States", label: "United States" },
	{ value: "Europe", label: "Europe" },
	{ value: "Asia Pacific", label: "Asia Pacific" },
];

export function InputGroup38Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const [region, setRegion] = React.useState<string>("Global");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leading={<DropdownMenu label={region} title="Region" icon={GlobeIcon} variant="ghost" size="sm" items={REGIONS} onSelect={setRegion} />}
			placeholder="Search companies"
			accessibilityLabel="Search companies"
		/>
	);
}
