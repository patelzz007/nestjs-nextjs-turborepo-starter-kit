import CircleHelpIcon from "lucide-react-native/icons/circle-help";
import { Icon } from "@workspace/ui-native/components/icon";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

const VISIBILITY: readonly RadioOption<string>[] = [
	{
		value: "public",
		label: "Public",
		trailing: (
			<Tooltip content="Anyone with the link can see it." accessibilityLabel="About public">
				<Icon icon={CircleHelpIcon} size="sm" colorClassName="accent-icon" />
			</Tooltip>
		),
	},
	{
		value: "private",
		label: "Private",
		trailing: (
			<Tooltip content="Only invited people can see it." accessibilityLabel="About private">
				<Icon icon={CircleHelpIcon} size="sm" colorClassName="accent-icon" />
			</Tooltip>
		),
	},
];

export function RadioGroup14Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("public");
	return <RadioGroup label="Visibility" options={VISIBILITY} value={value} onChange={setValue} />;
}
