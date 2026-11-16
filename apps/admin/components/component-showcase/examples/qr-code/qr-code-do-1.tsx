import * as React from "react";
import { QrCode } from "@workspace/ui/components/qr-code";

export function QrCodeDo1Example(): React.JSX.Element {
	return <QrCode value="https://acme.example/menu" size={160} label="Scan to open the menu" />;
}
