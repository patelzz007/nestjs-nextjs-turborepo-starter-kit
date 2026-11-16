import PaletteIcon from "lucide-react-native/icons/palette";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

/** Inks: theme colours, so the signature reads in light and dark. */
const INKS: readonly DropdownMenuItemData<string>[] = [
	{ value: "accent-foreground", label: "Ink" },
	{ value: "accent-tone-blue", label: "Blue" },
	{ value: "accent-tone-violet", label: "Violet" },
];
const WEIGHTS: readonly DropdownMenuItemData<string>[] = [
	{ value: "1.5", label: "Fine" },
	{ value: "2.5", label: "Medium" },
	{ value: "4", label: "Bold" },
];

export function SignaturePad4Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [ink, setInk] = React.useState<string>("accent-foreground");
	const [weight, setWeight] = React.useState<number>(2.5);
	const pickWeight = React.useCallback((value: string): void => {
		setWeight(Number(value));
	}, []);
	return (
		<View className="gap-3">
			<SignaturePad strokes={signature.strokes} onChange={signature.onChange} inkClassName={ink} strokeWidth={weight} size="lg" />
			<View className="flex-row gap-2">
				<DropdownMenu label="Ink" icon={PaletteIcon} variant="ghost" items={INKS} onSelect={setInk} />
				<DropdownMenu label="Weight" variant="ghost" items={WEIGHTS} onSelect={pickWeight} />
			</View>
		</View>
	);
}
