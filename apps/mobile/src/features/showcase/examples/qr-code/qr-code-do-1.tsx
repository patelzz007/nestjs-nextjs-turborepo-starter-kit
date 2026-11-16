import { QrCode } from "@workspace/ui-native/components/qr-code";
import * as React from "react";

export function QrCodeDo1Example(): React.JSX.Element {
	return <QrCode value="https://acme.example/claim/R-2026-0042" label="QR code to claim your refund" className="self-center" />;
}
