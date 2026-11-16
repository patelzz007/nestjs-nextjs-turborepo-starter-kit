import { QrCode } from "@workspace/ui-native/components/qr-code";
import * as React from "react";

export function QrCodeDo2Example(): React.JSX.Element {
	return <QrCode value="https://acme.example/r/42" label="QR code to open the receipt" className="self-center" />;
}
