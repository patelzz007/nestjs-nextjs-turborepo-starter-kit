import * as React from "react";
import { QrCode } from "@workspace/ui/components/qr-code";

const LONG_TEXT =
	"Acme Coffee menu. Latte RM 12, flat white RM 12, long black RM 10, cold brew RM 14, matcha latte RM 15, chai RM 13, croissant RM 9, banana bread RM 8, granola bowl RM 18, avocado toast RM 22. Open weekdays 8 to 6, Saturday 9 to 2.";

export function QrCodeDont2Example(): React.JSX.Element {
	return <QrCode value={LONG_TEXT} size={160} label="Scan to read the menu" />;
}
