import { ListGroup } from "@workspace/ui-native/components/list-group";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const LANGUAGES: readonly RadioOption<string>[] = [
	{ value: "en", label: "English" },
	{ value: "ms", label: "Bahasa Melayu" },
	{ value: "zh", label: "中文" },
	{ value: "ta", label: "தமிழ்" },
];

export function RadioGroup10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("en");
	return (
		<ListGroup title="Language">
			<RadioGroup label="Language" options={LANGUAGES} value={value} onChange={setValue} controlPosition="end" className="px-4" />
		</ListGroup>
	);
}
