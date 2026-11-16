import * as React from "react";
import { QrCode } from "@workspace/ui/components/qr-code";

export function QrCodeDont1Example(): React.JSX.Element {
	return <QrCode value="https://acme.example/menu" size={160} label="QR code" />;
}
