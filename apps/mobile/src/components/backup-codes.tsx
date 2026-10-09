// The backup codes, shown once (§10.5 step 4, §10.10): copy all, share, and a
// required "I saved my backup codes" confirmation before continuing.

import * as React from "react";
import { Text, View } from "react-native";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { MutedText } from "./text";

export interface BackupCodesProps {
	readonly codes: readonly string[];
	readonly confirmed: boolean;
	readonly onConfirmedChange: (confirmed: boolean) => void;
	readonly onCopy: () => void;
	readonly onShare: () => void;
	readonly onContinue: () => void;
	readonly continueLabel: string;
	readonly continuePending?: boolean;
}

export function BackupCodes({
	codes,
	confirmed,
	onConfirmedChange,
	onCopy,
	onShare,
	onContinue,
	continueLabel,
	continuePending = false,
}: BackupCodesProps): React.JSX.Element {
	return (
		<View className="gap-4">
			<MutedText>Each code signs you in once if you lose your authenticator. Store them somewhere safe — they are shown only now.</MutedText>
			<View accessibilityLabel={`Backup codes: ${codes.join(", ")}`} accessible className="flex-row flex-wrap gap-2">
				{codes.map((code: string): React.JSX.Element => (
					<View key={code} className="min-w-[46%] flex-1 rounded-md border border-border bg-muted px-2 py-1.5">
						<Text selectable className="text-center font-mono text-sm text-foreground">
							{code}
						</Text>
					</View>
				))}
			</View>
			<View className="flex-row gap-2">
				<View className="flex-1">
					<Button label="Copy all" variant="secondary" onPress={onCopy} />
				</View>
				<View className="flex-1">
					<Button label="Share" variant="secondary" onPress={onShare} />
				</View>
			</View>
			<Checkbox label="I saved my backup codes" checked={confirmed} onChange={onConfirmedChange} />
			<Button label={continueLabel} onPress={onContinue} disabled={!confirmed} loading={continuePending} />
		</View>
	);
}
