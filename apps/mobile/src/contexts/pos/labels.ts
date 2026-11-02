// Copy of the till screen (features/till): pair this phone as a POS terminal
// with the merchant console's code, then scan customers' reward QR codes and
// redeem them on the bill. The redemption wording matches the merchant console.

import type { RedemptionInvalidReason, RewardType } from "@workspace/shared";

import type { QrScannerLabels } from "@workspace/ui-native/components/qr-scanner";

export const TILL_TITLE = "Till";

export const REWARD_TYPE_LABELS: Readonly<Record<RewardType, string>> = {
	DISCOUNT: "Discount",
	FREE_ITEM: "Free item",
	CASHBACK: "Cashback",
	POINTS: "Points",
	BOGO: "Buy one, get one",
};

export const INVALID_REASON_LABELS: Readonly<Record<RedemptionInvalidReason, string>> = {
	ALREADY_REDEEMED: "This reward has already been redeemed.",
	EXPIRED: "This reward has expired.",
	NOT_VALID_AT_STORE: "This reward can't be redeemed at this store.",
	STORE_REQUIRED: "This till isn't registered to a store yet, and this reward is limited to selected stores.",
	CUSTOMER_BANNED: "This business has banned this customer from its rewards.",
};

export const TILL_COPY = {
	description: "Scan customers' reward QR codes at the counter and redeem them on the bill.",
	loading: "Loading this till…",
	loadError: "This phone's till settings couldn't be read. Try again.",
	retry: "Try again",

	pairTitle: "Pair this phone as a till",
	pairDescription: "In the merchant console, open Terminals, add a terminal and show its pairing code. Scan that QR code here, or type the code.",
	scanPairing: "Scan pairing QR",
	pairingCodeLabel: "Pairing code",
	pairingCodeHint: "8 characters, shown next to the QR code. It works once and expires after 15 minutes.",
	pairingCodeInvalid: "Enter the 8-character code shown in the merchant console.",
	pair: "Pair",
	paired: (terminalName: string): string => `Paired as ${terminalName}.`,
	notPairingCode: "That isn't a terminal pairing QR code. Scan the code shown in the merchant console.",

	terminalTitle: "This till",
	terminalLabel: "Terminal",
	storeLabel: "Store",
	businessLabel: "Business",
	unpair: "Unpair this phone",
	unpairTitle: "Unpair this phone?",
	unpairDescription: "It stops redeeming rewards for this store. To use it as a till again, pair it with a new code from the merchant console.",
	unpairConfirm: "Unpair",
	unpaired: "This phone is no longer a till.",
	cancel: "Cancel",

	scanTitle: "Redeem a reward",
	scanDescription: "Ask the customer to open the reward in their wallet and show its QR code.",
	scanCustomer: "Scan customer QR",
	scanWithGoogle: "Scan with Google scanner",
	scanWithCamera: "Scan with this app's camera",
	scanChoiceHint: "Google's scanner (ML Kit) opens fastest. This app's camera can also read a code from a photo.",
	googleScannerUnavailable: "Google's scanner isn't available on this phone (it needs Google Play services). Use this app's camera.",
	backupCodeLabel: "Or type their backup code",
	backupCodeHint: "8 characters, shown under the customer's QR code.",
	backupCodeInvalid: "Backup codes are 8 letters and digits.",
	checkCode: "Check code",
	notRedemptionCode: "That QR code isn't a reward. Ask the customer to open the reward in their wallet.",
	scannedPairingInstead: "That's a terminal pairing code. Scan the customer's reward QR code instead.",

	expiresLabel: "Valid until",
	typeLabel: "Type",
	minSpendLabel: "Minimum bill",
	offerLabel: "Gives",
	itemLabel: "Item",
	skuLabel: "SKU",
	termsLabel: "Terms",
	offerDiscount: (percent: string): string => `${percent}% off the bill`,
	offerCashback: (amount: string): string => `${amount} cashback`,
	offerPoints: (points: string): string => `${points} bonus points`,
	offerFreeItem: (quantity: string, item: string): string => `${quantity} × ${item} free`,
	offerBogo: (item: string, freeQuantity: string): string => `Buy a ${item}, get ${freeQuantity} free`,
	validMessage: "Valid — enter the bill to redeem it.",
	billLabel: "Bill total",
	billHint: (currencyCode: string): string => `The amount the customer paid, in ${currencyCode}.`,
	billInvalid: "Enter the bill total, e.g. 25.50.",
	billBelowMinSpend: (minimum: string): string => `This reward needs a bill of at least ${minimum}.`,
	redeem: "Redeem",
	scanAnother: "Scan another code",

	successTitle: "Redeemed",
	successMessage: (rewardTitle: string, bill: string): string => `${rewardTitle} redeemed on a ${bill} bill.`,
	next: "Next customer",

	exchangeTitle: "What the till sent",
	exchangeDescription: (method: string, path: string): string => `${method} ${path}. The API key is shortened so a screenshot never shows it.`,
	checkoutExchangeTitle: "What the till sent to redeem it",
	requestHeadersCaption: "Request headers",
	requestBodyCaption: "Request body",
	responseBodyCaption: "Response body",
};

/** The scanner's words at the till: the same scanner reads pairing and customer codes. */
export const TILL_SCANNER_LABELS: Partial<QrScannerLabels> = {
	hint: "Fit the QR code inside the frame",
	permissionDescription: "The camera is used only while the scanner is open, to read customers' reward QR codes.",
};
