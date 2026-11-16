import CopyIcon from "lucide-react-native/icons/copy";
import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import KeyRoundIcon from "lucide-react-native/icons/key-round";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

interface ApiKey {
	readonly id: string;
	readonly name: string;
	readonly hint: string;
}

const KEYS: readonly ApiKey[] = [
	{ id: "prod", name: "Production", hint: "sk_live_…4f2a" },
	{ id: "staging", name: "Staging", hint: "sk_test_…91c0" },
	{ id: "ci", name: "CI", hint: "sk_test_…7d3e" },
];
const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "copy", label: "Copy key", icon: CopyIcon },
	{ value: "delete", label: "Delete", icon: Trash2Icon, variant: "destructive" },
];

function KeyRow({ apiKey, onDelete }: { readonly apiKey: ApiKey; readonly onDelete: (id: string) => void }): React.JSX.Element {
	const act = React.useCallback(
		(action: string): void => {
			if (action === "delete") {
				onDelete(apiKey.id);
			}
		},
		[apiKey.id, onDelete],
	);
	return (
		<View className="flex-row items-center gap-3 py-2">
			<View className="flex-1">
				<Text className="text-body font-sans-medium text-foreground">{apiKey.name}</Text>
				<Text className="text-caption font-mono text-muted-foreground">{apiKey.hint}</Text>
			</View>
			<DropdownMenu label={`${apiKey.name} key actions`} icon={EllipsisVerticalIcon} size="icon" variant="ghost" items={ACTIONS} onSelect={act} />
		</View>
	);
}

export function Collapsible7Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(true);
	const [keys, setKeys] = React.useState<readonly ApiKey[]>(KEYS);
	const remove = React.useCallback((id: string): void => {
		setKeys((current: readonly ApiKey[]): readonly ApiKey[] => current.filter((apiKey: ApiKey): boolean => apiKey.id !== id));
	}, []);
	return (
		<Collapsible open={open} onOpenChange={setOpen} variant="card">
			<CollapsibleTrigger label="API keys" description={`${String(keys.length)} keys`} icon={KeyRoundIcon} />
			<CollapsibleContent>
				{keys.map((apiKey: ApiKey): React.JSX.Element => (
					<KeyRow key={apiKey.id} apiKey={apiKey} onDelete={remove} />
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}
