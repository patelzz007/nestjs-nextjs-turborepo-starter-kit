// The unpaired till: pair this phone as a POS terminal with the one-time code
// the merchant console shows — scanned from its QR code, or typed. The API
// answers with the terminal's own API key, which the screen keeps.

import { useMutation } from "@tanstack/react-query";
import { PosPairingCodeSchema, type PosPairingCode } from "@workspace/shared";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { QrScanner } from "@workspace/ui-native/components/qr-scanner";
import { TextField } from "@workspace/ui-native/components/text-field";
import ScanQrCodeIcon from "lucide-react-native/icons/scan-qr-code";
import * as React from "react";
import { View } from "react-native";

import { errorMessageOf } from "../../lib/error-messages";
import { TILL_COPY, TILL_SCANNER_LABELS } from "./labels";
import { pairedTerminalOf, type PairedTerminal } from "./paired-terminal";
import { classifyScannedCode } from "./scanned-code";
import { useTillApi } from "./use-till-api";

export interface TillPairingProps {
	/** The API paired this phone: keep the terminal. */
	readonly onPaired: (terminal: PairedTerminal) => Promise<void>;
}

/** Pairing (and backup) codes are 8 characters (`RewardBackupCodeSchema`). */
export const TILL_CODE_LENGTH = 8;

/** Pairing codes are typed in capitals; the field upper-cases what the cashier types. */
function normalisePairingCode(text: string): string {
	return text.trim().toUpperCase();
}

export function TillPairing({ onPaired }: TillPairingProps): React.JSX.Element {
	const till = useTillApi(null);
	const [typedCode, setTypedCode] = React.useState("");
	const [isScannerOpen, setScannerOpen] = React.useState(false);
	const [scanProblem, setScanProblem] = React.useState<string | null>(null);
	const [typedProblem, setTypedProblem] = React.useState<string | null>(null);

	const pairing = useMutation({
		mutationFn: async (pairingCode: PosPairingCode): Promise<void> => {
			const paired = await till.pairTerminal.mutate({ pairingCode });
			await onPaired(pairedTerminalOf(paired.data));
		},
	});

	const startPairing = React.useCallback(
		(pairingCode: PosPairingCode): void => {
			pairing.mutate(pairingCode);
		},
		[pairing],
	);
	const openScanner = React.useCallback((): void => {
		setScanProblem(null);
		pairing.reset();
		setScannerOpen(true);
	}, [pairing]);
	const closeScanner = React.useCallback((): void => {
		setScannerOpen(false);
	}, []);
	const handleScan = React.useCallback(
		(text: string): void => {
			setScannerOpen(false);
			const scanned = classifyScannedCode(text);
			if (scanned.kind !== "pairing") {
				setScanProblem(TILL_COPY.notPairingCode);
				return;
			}
			startPairing(scanned.pairingCode);
		},
		[startPairing],
	);
	const changeTypedCode = React.useCallback((text: string): void => {
		setTypedProblem(null);
		setTypedCode(normalisePairingCode(text));
	}, []);
	const submitTypedCode = React.useCallback((): void => {
		setScanProblem(null);
		const code = PosPairingCodeSchema.safeParse(typedCode);
		if (!code.success) {
			setTypedProblem(TILL_COPY.pairingCodeInvalid);
			return;
		}
		startPairing(code.data);
	}, [startPairing, typedCode]);

	const problem = scanProblem ?? (pairing.isError ? errorMessageOf(pairing.error) : null);
	return (
		<Card title={TILL_COPY.pairTitle} description={TILL_COPY.pairDescription}>
			<View className="gap-4">
				{problem === null ? null : <Alert tone="error" message={problem} />}
				<Button label={TILL_COPY.scanPairing} icon={ScanQrCodeIcon} onPress={openScanner} loading={pairing.isPending} />
				<TextField
					label={TILL_COPY.pairingCodeLabel}
					value={typedCode}
					onChange={changeTypedCode}
					hint={TILL_COPY.pairingCodeHint}
					error={typedProblem ?? undefined}
					autoCapitalize="characters"
					autoCorrect={false}
					maxLength={TILL_CODE_LENGTH}
					returnKeyType="done"
					onSubmitEditing={submitTypedCode}
				/>
				<Button label={TILL_COPY.pair} variant="secondary" onPress={submitTypedCode} disabled={pairing.isPending} />
			</View>
			<QrScanner visible={isScannerOpen} onScan={handleScan} onClose={closeScanner} labels={TILL_SCANNER_LABELS} />
		</Card>
	);
}
