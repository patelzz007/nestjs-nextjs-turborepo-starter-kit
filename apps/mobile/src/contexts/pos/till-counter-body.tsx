// The paired till at the counter: scan the customer's reward QR (or type its
// backup code), see what it is and whether it can be redeemed here
// (`POST /integration/redemptions/validate`), enter the bill, and redeem it
// (`POST /integration/redemptions/checkout`). The checkout is idempotent: a retry after a
// lost answer reuses the same Idempotency-Key, so a reward is never redeemed
// twice for one bill (rules/09), and the API stays the authority on every rule
// (minimum spend, store, expiry) — the checks here only spare a round trip.
//
// Loaded lazily with the camera scanner it opens: the screen renders
// `TillCounter` (till-counter.tsx), never this module directly.

import { useMutation } from "@tanstack/react-query";
import type { PosCaller } from "@workspace/api-client";
import { DEFAULT_SALE_CURRENCY, RewardBackupCodeSchema, type RedemptionCheckoutResponse, type RedemptionCode, type RedemptionPreviewResponse } from "@workspace/shared";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { DetailList, type DetailItem } from "@workspace/ui-native/components/detail-list";
import { QrScanner } from "@workspace/ui-native/components/qr-scanner";
import { TextField } from "@workspace/ui-native/components/text-field";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import ScanQrCodeIcon from "lucide-react-native/icons/scan-qr-code";
import * as React from "react";
import { View } from "react-native";

import { errorMessageOf } from "../../lib/error-messages";
import { useIdempotencyKeys } from "../../lib/idempotency-keys";
import { formatDateTime } from "../../lib/time-format";
import { formatBillAmount, parseBillAmount } from "./bill-amount";
import { INVALID_REASON_LABELS, REWARD_TYPE_LABELS, TILL_COPY, TILL_SCANNER_LABELS } from "./labels";
import type { PairedTerminal } from "./paired-terminal";
import { classifyScannedCode, TILL_CODE_LENGTH } from "./scanned-code";
import { useTillApi } from "./use-till-api";

/** Where the counter is: waiting for a code, showing a checked code, or done. */
type CounterStep =
	| { readonly step: "ready" }
	| { readonly step: "preview"; readonly code: RedemptionCode; readonly preview: RedemptionPreviewResponse }
	| { readonly step: "redeemed"; readonly receipt: RedemptionCheckoutResponse };

const READY: CounterStep = { step: "ready" };

export interface TillCounterProps {
	readonly terminal: PairedTerminal;
}

export function TillCounterBody({ terminal }: TillCounterProps): React.JSX.Element {
	const till = useTillApi(terminal.credentials);
	const [counter, setCounter] = React.useState<CounterStep>(READY);

	const backToReady = React.useCallback((): void => {
		setCounter(READY);
	}, []);
	const showPreview = React.useCallback((code: RedemptionCode, preview: RedemptionPreviewResponse): void => {
		setCounter({ step: "preview", code, preview });
	}, []);
	const showReceipt = React.useCallback((receipt: RedemptionCheckoutResponse): void => {
		setCounter({ step: "redeemed", receipt });
	}, []);

	switch (counter.step) {
		case "ready":
			return <CodeEntry till={till} onChecked={showPreview} />;
		case "preview":
			return <Checkout till={till} code={counter.code} preview={counter.preview} onRedeemed={showReceipt} onCancel={backToReady} />;
		case "redeemed":
			return <Receipt receipt={counter.receipt} onNext={backToReady} />;
	}
}

interface CodeEntryProps {
	readonly till: PosCaller;
	readonly onChecked: (code: RedemptionCode, preview: RedemptionPreviewResponse) => void;
}

/** Scan the customer's QR code, or type the backup code read out instead. */
function CodeEntry({ till, onChecked }: CodeEntryProps): React.JSX.Element {
	const [isScannerOpen, setScannerOpen] = React.useState(false);
	const [backupCode, setBackupCode] = React.useState("");
	const [scanProblem, setScanProblem] = React.useState<string | null>(null);
	const [typedProblem, setTypedProblem] = React.useState<string | null>(null);

	const validation = useMutation({
		mutationFn: async (code: RedemptionCode): Promise<void> => {
			const preview = await till.validate.mutate(code);
			onChecked(code, preview.data);
		},
	});

	const openScanner = React.useCallback((): void => {
		setScanProblem(null);
		validation.reset();
		setScannerOpen(true);
	}, [validation]);
	const closeScanner = React.useCallback((): void => {
		setScannerOpen(false);
	}, []);
	const handleScan = React.useCallback(
		(text: string): void => {
			setScannerOpen(false);
			const scanned = classifyScannedCode(text);
			switch (scanned.kind) {
				case "redemption":
					validation.mutate(scanned.code);
					return;
				case "pairing":
					setScanProblem(TILL_COPY.scannedPairingInstead);
					return;
				case "unrecognised":
					setScanProblem(TILL_COPY.notRedemptionCode);
					return;
			}
		},
		[validation],
	);
	const changeBackupCode = React.useCallback((text: string): void => {
		setTypedProblem(null);
		setBackupCode(text.trim().toUpperCase());
	}, []);
	const checkBackupCode = React.useCallback((): void => {
		setScanProblem(null);
		const code = RewardBackupCodeSchema.safeParse(backupCode);
		if (!code.success) {
			setTypedProblem(TILL_COPY.backupCodeInvalid);
			return;
		}
		validation.mutate({ backupCode: code.data });
	}, [backupCode, validation]);

	const problem = scanProblem ?? (validation.isError ? errorMessageOf(validation.error) : null);
	return (
		<Card title={TILL_COPY.scanTitle} description={TILL_COPY.scanDescription}>
			<View className="gap-4">
				{problem === null ? null : <Alert tone="error" message={problem} />}
				<Button label={TILL_COPY.scanCustomer} icon={ScanQrCodeIcon} onPress={openScanner} loading={validation.isPending} />
				<TextField
					label={TILL_COPY.backupCodeLabel}
					value={backupCode}
					onChange={changeBackupCode}
					hint={TILL_COPY.backupCodeHint}
					error={typedProblem ?? undefined}
					autoCapitalize="characters"
					autoCorrect={false}
					maxLength={TILL_CODE_LENGTH}
					returnKeyType="done"
					onSubmitEditing={checkBackupCode}
				/>
				<Button label={TILL_COPY.checkCode} variant="secondary" onPress={checkBackupCode} disabled={validation.isPending} />
			</View>
			<QrScanner visible={isScannerOpen} onScan={handleScan} onClose={closeScanner} labels={{ ...TILL_SCANNER_LABELS, title: TILL_COPY.scanCustomer }} />
		</Card>
	);
}

interface CheckoutProps {
	readonly till: PosCaller;
	readonly code: RedemptionCode;
	readonly preview: RedemptionPreviewResponse;
	readonly onRedeemed: (receipt: RedemptionCheckoutResponse) => void;
	readonly onCancel: () => void;
}

/** The checked code: what it is, whether it can be redeemed, and the bill to redeem it on. */
function Checkout({ till, code, preview, onRedeemed, onCancel }: CheckoutProps): React.JSX.Element {
	const currency = DEFAULT_SALE_CURRENCY;
	const [billText, setBillText] = React.useState("");
	const [billProblem, setBillProblem] = React.useState<string | null>(null);
	const idempotencyKeys = useIdempotencyKeys();

	const checkout = useMutation({
		mutationFn: async (billTotalMinor: number): Promise<RedemptionCheckoutResponse> => {
			const idempotencyKey = idempotencyKeys.keyFor(JSON.stringify({ code, billTotalMinor, currency }));
			const receipt = await till.checkout.mutate({ idempotencyKey, billTotalMinor, currency, codes: [code] });
			idempotencyKeys.spend();
			return receipt.data;
		},
		onSuccess: onRedeemed,
	});

	const changeBill = React.useCallback((text: string): void => {
		setBillProblem(null);
		setBillText(text);
	}, []);
	const redeem = React.useCallback((): void => {
		const billTotalMinor = parseBillAmount(billText, currency);
		if (billTotalMinor === null) {
			setBillProblem(TILL_COPY.billInvalid);
			return;
		}
		if (preview.minSpendMinor !== null && billTotalMinor < preview.minSpendMinor) {
			setBillProblem(TILL_COPY.billBelowMinSpend(formatBillAmount(preview.minSpendMinor, currency)));
			return;
		}
		checkout.mutate(billTotalMinor);
	}, [billText, checkout, currency, preview.minSpendMinor]);

	const details: DetailItem[] = [
		{ label: TILL_COPY.typeLabel, value: REWARD_TYPE_LABELS[preview.rewardType] },
		{ label: TILL_COPY.expiresLabel, value: formatDateTime(preview.claimExpiresAt) },
	];
	if (preview.minSpendMinor !== null) {
		details.push({ label: TILL_COPY.minSpendLabel, value: formatBillAmount(preview.minSpendMinor, currency) });
	}

	return (
		<Card title={preview.rewardTitle} description={TILL_COPY.previewTitle}>
			<View className="gap-4">
				<DetailList items={details} />
				{preview.valid ? (
					<Alert tone="success" message={TILL_COPY.validMessage} />
				) : (
					<Alert tone="error" message={preview.invalidReason === null ? TILL_COPY.notRedemptionCode : INVALID_REASON_LABELS[preview.invalidReason]} />
				)}
				{checkout.isError ? <Alert tone="error" message={errorMessageOf(checkout.error)} /> : null}
				{preview.valid ? (
					<>
						<TextField
							label={TILL_COPY.billLabel}
							value={billText}
							onChange={changeBill}
							hint={TILL_COPY.billHint(currency)}
							error={billProblem ?? undefined}
							keyboardType="decimal-pad"
							returnKeyType="done"
							onSubmitEditing={redeem}
						/>
						<Button label={TILL_COPY.redeem} onPress={redeem} loading={checkout.isPending} />
					</>
				) : null}
				<Button label={TILL_COPY.scanAnother} variant="secondary" onPress={onCancel} disabled={checkout.isPending} />
			</View>
		</Card>
	);
}

interface ReceiptProps {
	readonly receipt: RedemptionCheckoutResponse;
	readonly onNext: () => void;
}

/** The redemption went through. */
function Receipt({ receipt, onNext }: ReceiptProps): React.JSX.Element {
	const bill = formatBillAmount(receipt.billTotalMinor, receipt.currency);
	return (
		<Card title={TILL_COPY.successTitle}>
			<View className="gap-4">
				{receipt.redemptions.map((redemption): React.JSX.Element => (
					<Alert key={redemption.redemptionId} tone="success" icon={CircleCheckIcon} message={TILL_COPY.successMessage(redemption.rewardTitle, bill)} />
				))}
				<Button label={TILL_COPY.next} icon={ScanQrCodeIcon} onPress={onNext} />
			</View>
		</Card>
	);
}
