// The paired till at the counter: scan the customer's reward QR (or type its
// backup code), see what it is and whether it can be redeemed here
// (`POST /integration/redemptions/validate`), enter the bill, and redeem it
// (`POST /integration/redemptions/checkout`). The checkout is idempotent: a retry after a
// lost answer reuses the same Idempotency-Key, so a reward is never redeemed
// twice for one bill (rules/09), and the API stays the authority on every rule
// (minimum spend, store, expiry) — the checks here only spare a round trip.
//
// Under the result it shows what was sent and what came back (request headers, request body, response
// body — api-exchange.ts): for the scanned code, then for the redemption on the bill. The code is read
// by Google's scanner (ML Kit; disabled on a phone without Google Play services) or by the app's own
// camera scanner, which also reads a code from a photo; "Scan from gallery" beside them does that too.
// What the reward gives — and the free item's name and SKU — shows on the checkout card and the receipt.
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
import { deviceQrScannerEngine, QrScanFromGalleryButton, QrScanner, type QrScannerLabels } from "@workspace/ui-native/components/qr-scanner";
import type { QrScannerEngine } from "@workspace/ui-native/lib/qr-scanner-engine";
import { TextField } from "@workspace/ui-native/components/text-field";
import CameraIcon from "lucide-react-native/icons/camera";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import ScanQrCodeIcon from "lucide-react-native/icons/scan-qr-code";
import * as React from "react";
import { Text, View } from "react-native";

import { errorMessageOf } from "../../lib/error-messages";
import { useToast } from "../../features/toast/facade";
import { useIdempotencyKeys } from "../../lib/idempotency-keys";
import { formatDateTime } from "../../lib/time-format";
import { checkoutExchange, validateExchange, type ApiExchange } from "./api-exchange";
import { MAX_QUEUED_CHECKOUTS, wasUnanswered, type QueuedCheckout } from "./checkout-queue";
import { formatBillAmount, parseBillAmount } from "./bill-amount";
import { INVALID_REASON_LABELS, REWARD_TYPE_LABELS, TILL_COPY, TILL_SCANNER_LABELS } from "./labels";
import type { PairedTerminal } from "./paired-terminal";
import { offerDetails } from "./offer-terms";
import { classifyScannedCode, TILL_CODE_LENGTH } from "./scanned-code";
import { TillApiExchange } from "./till-api-exchange";
import { useCheckoutQueue, type CheckoutQueue, type SentCheckout } from "./use-checkout-queue";
import { useTillApi } from "./use-till-api";

/** Where the counter is: waiting for a code, showing a checked code, or done. */
type CounterStep =
	| { readonly step: "ready" }
	| { readonly step: "preview"; readonly code: RedemptionCode; readonly preview: RedemptionPreviewResponse }
	| { readonly step: "redeemed"; readonly receipt: RedemptionCheckoutResponse }
	/** Saved on the till for the connection (6.4): its key, so the step follows that redemption when it is sent. */
	| { readonly step: "queued"; readonly idempotencyKey: string };

const READY: CounterStep = { step: "ready" };

/** Both scanners' words at the counter. */
const SCANNER_LABELS: Partial<QrScannerLabels> = { ...TILL_SCANNER_LABELS, title: TILL_COPY.scanCustomer };

export interface TillCounterProps {
	readonly terminal: PairedTerminal;
}

export function TillCounterBody({ terminal }: TillCounterProps): React.JSX.Element {
	const till = useTillApi(terminal.credentials);
	const [counter, setCounter] = React.useState<CounterStep>(READY);
	// The last validate call's request and answer, shown under the step it led to.
	const [exchange, setExchange] = React.useState<ApiExchange | null>(null);

	const backToReady = React.useCallback((): void => {
		setCounter(READY);
		setExchange(null);
	}, []);
	const showPreview = React.useCallback((code: RedemptionCode, preview: RedemptionPreviewResponse): void => {
		setCounter({ step: "preview", code, preview });
	}, []);
	// The redemption's own request and answer, shown under its step (the receipt, or the failed checkout).
	const [redeemExchange, setRedeemExchange] = React.useState<ApiExchange | null>(null);
	const showReceipt = React.useCallback((receipt: RedemptionCheckoutResponse): void => {
		setCounter({ step: "redeemed", receipt });
	}, []);
	const startOver = React.useCallback((): void => {
		setRedeemExchange(null);
		backToReady();
	}, [backToReady]);
	const showQueued = React.useCallback((idempotencyKey: string): void => {
		setCounter({ step: "queued", idempotencyKey });
	}, []);
	// The saved redemption the counter shows, read when the queue reports a send (outside render).
	const shownQueuedKey = React.useRef<string | null>(null);
	React.useEffect((): void => {
		shownQueuedKey.current = counter.step === "queued" ? counter.idempotencyKey : null;
	}, [counter]);
	const toast = useToast();
	const announceSent = React.useCallback(
		({ request, response }: SentCheckout): void => {
			const receipt = response.data;
			const bill = formatBillAmount(receipt.billTotalMinor, receipt.currency);
			for (const redemption of receipt.redemptions) {
				toast.success(TILL_COPY.queueSent(redemption.rewardTitle, bill));
			}
			// The redemption the counter shows as saved went through: its receipt, with the send that did it under it
			// (not the attempt that got no answer).
			if (shownQueuedKey.current === request.idempotencyKey) {
				setRedeemExchange(checkoutExchange(terminal.credentials, request, { ok: true, body: response }));
				setCounter({ step: "redeemed", receipt });
			}
		},
		[terminal.credentials, toast],
	);
	const queue = useCheckoutQueue(till, { onSent: announceSent });
	// The redemption the counter is showing as saved was refused: the counter is ready again, the refusal listed.
	const queuedKey = counter.step === "queued" ? counter.idempotencyKey : null;
	const refusedHere = queue.entries.some((entry): boolean => entry.request.idempotencyKey === queuedKey && entry.refusal !== null);
	const shown: CounterStep = refusedHere ? READY : counter;
	const queueCard = queue.entries.length === 0 ? null : <QueuedCheckouts queue={queue} />;

	const exchangeCard = exchange === null ? null : <TillApiExchange exchange={exchange} />;
	switch (shown.step) {
		case "ready":
			return (
				<View className="gap-4">
					<CodeEntry till={till} credentials={terminal.credentials} onChecked={showPreview} onExchange={setExchange} />
					{queueCard}
					{exchangeCard}
				</View>
			);
		case "preview":
			return (
				<View className="gap-4">
					<Checkout
						till={till}
						credentials={terminal.credentials}
						code={shown.code}
						preview={shown.preview}
						onRedeemed={showReceipt}
						onQueued={showQueued}
						onKeep={queue.keep}
						onExchange={setRedeemExchange}
						onCancel={startOver}
					/>
					{queueCard}
					{redeemExchange === null ? null : <TillApiExchange exchange={redeemExchange} title={TILL_COPY.checkoutExchangeTitle} testID="till-checkout-exchange" />}
					{exchangeCard}
				</View>
			);
		case "queued":
			return (
				<View className="gap-4">
					<Card title={TILL_COPY.queuedTitle}>
						<View className="gap-4">
							<Alert tone="warning" message={TILL_COPY.queuedMessage} />
							<Button label={TILL_COPY.next} icon={ScanQrCodeIcon} onPress={startOver} />
						</View>
					</Card>
					{queueCard}
				</View>
			);
		case "redeemed":
			return (
				<View className="gap-4">
					<Receipt receipt={shown.receipt} onNext={startOver} />
					{redeemExchange === null ? null : <TillApiExchange exchange={redeemExchange} title={TILL_COPY.checkoutExchangeTitle} testID="till-checkout-exchange" />}
				</View>
			);
	}
}

interface CodeEntryProps {
	readonly till: PosCaller;
	/** The till's credentials, for the shown request headers (the API key masked). */
	readonly credentials: PairedTerminal["credentials"];
	readonly onChecked: (code: RedemptionCode, preview: RedemptionPreviewResponse) => void;
	/** What was sent and what came back, success or not. */
	readonly onExchange: (exchange: ApiExchange) => void;
}

/** Scan the customer's QR code, or type the backup code read out instead. */
function CodeEntry({ till, credentials, onChecked, onExchange }: CodeEntryProps): React.JSX.Element {
	// Which scanner is open: Google's (ML Kit) or the app's own camera scanner; null when neither.
	const [openScanner, setOpenScanner] = React.useState<QrScannerEngine | null>(null);
	// Google's scanner needs Play services; without it the button is disabled (decided once per screen).
	const [hasGoogleScanner] = React.useState((): boolean => deviceQrScannerEngine() === "google");
	const [backupCode, setBackupCode] = React.useState("");
	const [scanProblem, setScanProblem] = React.useState<string | null>(null);
	const [typedProblem, setTypedProblem] = React.useState<string | null>(null);

	const validation = useMutation({
		mutationFn: async (code: RedemptionCode): Promise<void> => {
			try {
				const preview = await till.validate.mutate(code);
				onExchange(validateExchange(credentials, code, { ok: true, body: preview }));
				onChecked(code, preview.data);
			} catch (error: unknown) {
				if (error instanceof Error) {
					onExchange(validateExchange(credentials, code, { ok: false, error }));
				}
				throw error;
			}
		},
	});

	const open = React.useCallback(
		(engine: QrScannerEngine): void => {
			setScanProblem(null);
			validation.reset();
			setOpenScanner(engine);
		},
		[validation],
	);
	const openGoogleScanner = React.useCallback((): void => {
		open("google");
	}, [open]);
	const openCameraScanner = React.useCallback((): void => {
		open("camera");
	}, [open]);
	const closeScanner = React.useCallback((): void => {
		setOpenScanner(null);
	}, []);
	const handleScan = React.useCallback(
		(text: string): void => {
			setOpenScanner(null);
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
				<View className="gap-2">
					<Button
						label={TILL_COPY.scanWithGoogle}
						icon={ScanQrCodeIcon}
						onPress={openGoogleScanner}
						loading={validation.isPending}
						disabled={!hasGoogleScanner}
						testID="till-scan-google"
					/>
					<Button
						label={TILL_COPY.scanWithCamera}
						icon={CameraIcon}
						variant="secondary"
						onPress={openCameraScanner}
						disabled={validation.isPending}
						testID="till-scan-camera"
					/>
					<Text className="font-sans text-xs text-muted-foreground">{hasGoogleScanner ? TILL_COPY.scanChoiceHint : TILL_COPY.googleScannerUnavailable}</Text>
				</View>
				<QrScanFromGalleryButton onScan={handleScan} testID="till-scan-gallery" />
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
			<QrScanner engine="google" visible={openScanner === "google"} onScan={handleScan} onClose={closeScanner} labels={SCANNER_LABELS} />
			<QrScanner engine="camera" visible={openScanner === "camera"} onScan={handleScan} onClose={closeScanner} labels={SCANNER_LABELS} testID="till-camera-scanner" />
		</Card>
	);
}

interface CheckoutProps {
	readonly till: PosCaller;
	/** The till's credentials, for the shown request headers (the API key masked). */
	readonly credentials: PairedTerminal["credentials"];
	readonly code: RedemptionCode;
	readonly preview: RedemptionPreviewResponse;
	readonly onRedeemed: (receipt: RedemptionCheckoutResponse) => void;
	/** What the redeem call sent and what came back, success or not. */
	readonly onExchange: (exchange: ApiExchange) => void;
	readonly onCancel: () => void;
	/** The checkout got no answer and the till kept it, to send when the connection is back. */
	readonly onQueued: (idempotencyKey: string) => void;
	/** Keeps a checkout that got no answer (false: the till already holds as many as it can). */
	readonly onKeep: CheckoutQueue["keep"];
}

/** What a redeem press came to: redeemed now, kept for the connection, or not kept (the queue is full). */
type CheckoutOutcome =
	| { readonly kind: "redeemed"; readonly receipt: RedemptionCheckoutResponse }
	| { readonly kind: "queued"; readonly idempotencyKey: string }
	| { readonly kind: "queueFull" };

/** The checked code: what it is and gives, whether it can be redeemed, and the bill to redeem it on. */
function Checkout({ till, credentials, code, preview, onRedeemed, onExchange, onCancel, onQueued, onKeep }: CheckoutProps): React.JSX.Element {
	const currency = DEFAULT_SALE_CURRENCY;
	const [billText, setBillText] = React.useState("");
	const [billProblem, setBillProblem] = React.useState<string | null>(null);
	const idempotencyKeys = useIdempotencyKeys();

	const checkout = useMutation({
		mutationFn: async (billTotalMinor: number): Promise<CheckoutOutcome> => {
			const idempotencyKey = idempotencyKeys.keyFor(JSON.stringify({ code, billTotalMinor, currency }));
			const request = { idempotencyKey, billTotalMinor, currency, codes: [code] };
			try {
				const receipt = await till.checkout.mutate(request);
				onExchange(checkoutExchange(credentials, request, { ok: true, body: receipt }));
				idempotencyKeys.spend();
				return { kind: "redeemed", receipt: receipt.data };
			} catch (error: unknown) {
				if (!(error instanceof Error)) {
					throw error;
				}
				onExchange(checkoutExchange(credentials, request, { ok: false, error }));
				// No answer at all (no connection): kept with its key, sent when the connection is back (6.4).
				if (!wasUnanswered(error)) {
					throw error;
				}
				if (!(await onKeep(request, preview.rewardTitle))) {
					return { kind: "queueFull" };
				}
				idempotencyKeys.spend();
				return { kind: "queued", idempotencyKey };
			}
		},
		onSuccess: (outcome: CheckoutOutcome): void => {
			if (outcome.kind === "redeemed") {
				onRedeemed(outcome.receipt);
			} else if (outcome.kind === "queued") {
				onQueued(outcome.idempotencyKey);
			}
		},
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
		...offerDetails(preview.offer),
		{ label: TILL_COPY.expiresLabel, value: formatDateTime(preview.claimExpiresAt) },
	];
	if (preview.minSpendMinor !== null) {
		details.push({ label: TILL_COPY.minSpendLabel, value: formatBillAmount(preview.minSpendMinor, currency) });
	}

	return (
		<Card title={preview.rewardTitle} description={preview.rewardDescription}>
			<View className="gap-4">
				<DetailList items={details} />
				{preview.termsConditions === null ? null : <DetailList items={[{ label: TILL_COPY.termsLabel, value: preview.termsConditions }]} variant="stacked" />}
				{preview.valid ? (
					<Alert tone="success" message={TILL_COPY.validMessage} />
				) : (
					<Alert tone="error" message={preview.invalidReason === null ? TILL_COPY.notRedemptionCode : INVALID_REASON_LABELS[preview.invalidReason]} />
				)}
				{checkout.isError ? <Alert tone="error" message={errorMessageOf(checkout.error)} /> : null}
				{checkout.data?.kind === "queueFull" ? <Alert tone="error" message={TILL_COPY.queueFull(MAX_QUEUED_CHECKOUTS)} /> : null}
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
					<View key={redemption.redemptionId} className="gap-2" testID={`till-receipt-${redemption.redemptionId}`}>
						<Alert tone="success" icon={CircleCheckIcon} message={TILL_COPY.successMessage(redemption.rewardTitle, bill)} />
						<DetailList items={offerDetails(redemption.offer)} />
					</View>
				))}
				<Button label={TILL_COPY.next} icon={ScanQrCodeIcon} onPress={onNext} />
			</View>
		</Card>
	);
}

interface QueuedCheckoutsProps {
	readonly queue: CheckoutQueue;
}

/** The checkouts the till keeps for the connection, and any the API refused once sent (6.4). */
function QueuedCheckouts({ queue }: QueuedCheckoutsProps): React.JSX.Element {
	return (
		<Card title={TILL_COPY.queueTitle} testID="till-checkout-queue">
			<View className="gap-3">
				{queue.entries.map((entry: QueuedCheckout): React.JSX.Element => (
					<QueuedCheckoutRow key={entry.request.idempotencyKey} entry={entry} onDismiss={queue.dismiss} />
				))}
				<Button label={TILL_COPY.queueSendNow} variant="secondary" onPress={queue.sendNow} loading={queue.sending} />
			</View>
		</Card>
	);
}

interface QueuedCheckoutRowProps {
	readonly entry: QueuedCheckout;
	readonly onDismiss: CheckoutQueue["dismiss"];
}

/** One kept checkout: waiting to be sent, or refused by the API (dismissed once the cashier has seen it). */
function QueuedCheckoutRow({ entry, onDismiss }: QueuedCheckoutRowProps): React.JSX.Element {
	const { idempotencyKey, billTotalMinor, currency } = entry.request;
	const dismiss = React.useCallback((): void => {
		onDismiss(idempotencyKey);
	}, [idempotencyKey, onDismiss]);
	return (
		<View className="gap-2">
			<Alert
				tone={entry.refusal === null ? "warning" : "error"}
				title={entry.rewardTitle}
				message={entry.refusal === null ? TILL_COPY.queueWaiting(formatBillAmount(billTotalMinor, currency)) : TILL_COPY.queueRefused(entry.refusal)}
			/>
			{entry.refusal === null ? null : <Button label={TILL_COPY.queueDismiss(entry.rewardTitle)} variant="secondary" onPress={dismiss} />}
		</View>
	);
}
