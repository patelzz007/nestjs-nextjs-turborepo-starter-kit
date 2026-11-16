import SearchIcon from "lucide-react-native/icons/search";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";
import { View } from "react-native";

const STATUSES: readonly SelectOption<string>[] = [
	{ value: "all", label: "All" },
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
];

export function Select13Example(): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	const [status, setStatus] = React.useState<string | null>("all");
	return (
		<View className="flex-row items-center gap-2">
			<InputGroup value={query} onChange={setQuery} placeholder="Search…" accessibilityLabel="Search" leadingIcon={SearchIcon} className="flex-1" />
			<SelectField label="Status" hideLabel options={STATUSES} value={status} onChange={setStatus} size="sm" className="w-32" />
		</View>
	);
}
