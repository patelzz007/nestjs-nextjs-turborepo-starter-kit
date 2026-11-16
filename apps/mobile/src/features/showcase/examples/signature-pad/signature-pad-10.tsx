import { Button } from "@workspace/ui-native/components/button";
import { isSignatureEmpty, SignaturePad, type SignatureStroke } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const CLAUSES: readonly string[] = ["Payment terms", "Delivery", "Returns", "Liability"];

interface ClauseInitialsProps {
	readonly clause: string;
	readonly initials: readonly SignatureStroke[];
	readonly onChange: (strokes: readonly SignatureStroke[]) => void;
}

function ClauseInitials({ clause, initials, onChange }: ClauseInitialsProps): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<Text className="text-body flex-1 font-sans text-foreground">{clause}</Text>
			<SignaturePad strokes={initials} onChange={onChange} size="sm" strokeWidth={1.5} labels={INITIALS_LABELS} className="w-28" />
		</View>
	);
}

const INITIALS_LABELS = { placeholder: "Initials" };

export function SignaturePad10Example(): React.JSX.Element {
	const [initials, setInitials] = React.useState<Readonly<Record<string, readonly SignatureStroke[]>>>({});
	const setFor = React.useCallback(
		(clause: string) =>
			(strokes: readonly SignatureStroke[]): void => {
				setInitials((current: Readonly<Record<string, readonly SignatureStroke[]>>): Readonly<Record<string, readonly SignatureStroke[]>> => ({
					...current,
					[clause]: strokes,
				}));
			},
		[],
	);
	return (
		<View className="gap-3">
			{CLAUSES.map((clause: string): React.JSX.Element => (
				<ClauseInitials key={clause} clause={clause} initials={initials[clause] ?? []} onChange={setFor(clause)} />
			))}
			<Button label="Submit" disabled={CLAUSES.some((clause: string): boolean => isSignatureEmpty(initials[clause] ?? []))} onPress={ignorePress} />
		</View>
	);
}
