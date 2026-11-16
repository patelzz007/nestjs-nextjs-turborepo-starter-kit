import SearchIcon from "lucide-react-native/icons/search";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

const CATEGORIES: readonly DropdownMenuItemData<string>[] = [
	{ value: "All", label: "All" },
	{ value: "Shoes", label: "Shoes" },
	{ value: "Bags", label: "Bags" },
];

export function InputGroup29Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const [category, setCategory] = React.useState<string>("All");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leadingIcon={SearchIcon}
			placeholder="Search products"
			accessibilityLabel="Search products"
			className="rounded-full pr-1.5 pl-4"
			trailing={<DropdownMenu label={category} title="Category" size="sm" items={CATEGORIES} onSelect={setCategory} />}
		/>
	);
}
