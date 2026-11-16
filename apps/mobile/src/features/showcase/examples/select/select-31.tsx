import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import { cn } from "@workspace/ui-native/lib/cn";
import * as React from "react";
import { Text } from "react-native";

const FONTS: readonly SelectOption<string>[] = [
	{ value: "sans", label: "Geist", description: "The interface face", labelClassName: "font-sans" },
	{ value: "heading", label: "Geist SemiBold", description: "Headings", labelClassName: "font-heading" },
	{ value: "mono", label: "Geist Mono", description: "Figures and identifiers", labelClassName: "font-mono" },
	{ value: "code", label: "JetBrains Mono", description: "Blocks of code", labelClassName: "font-code" },
];

/** The field shows the chosen font's name in that font. */
function FontName(option: SelectOption<string>): React.JSX.Element {
	return <Text className={cn("text-body-lg text-foreground", option.labelClassName)}>{option.label}</Text>;
}

export function Select31Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("sans");
	return <SelectField label="Font" options={FONTS} value={value} onChange={setValue} renderValue={FontName} />;
}
