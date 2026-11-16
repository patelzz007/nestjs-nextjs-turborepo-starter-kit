import { QrCode } from "@workspace/ui-native/components/qr-code";
import * as React from "react";

const LONG =
	"Thank you for your order. Your receipt number is R-2026-0042 and it covers two items shipped to the address on your account. Keep this for your records and contact support with the number above.";

export function QrCodeDont2Example(): React.JSX.Element {
	return <QrCode value={LONG} label="QR code of the whole receipt text" className="self-center" />;
}
