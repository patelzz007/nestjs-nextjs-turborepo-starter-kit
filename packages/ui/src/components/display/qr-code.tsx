"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";
import QRCodeSVG from "react-qr-code";

export interface QrCodeProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Encoded string rendered as a scannable QR (high-contrast black on white for POS scanners). */
	readonly value: string;
	readonly size?: number;
	/** Accessible name when the QR is decorative/contextual. */
	readonly label?: string;
}

/** Renders a scannable QR code — always black-on-white inside the frame for reliable merchant scanning. */
export const QrCode = React.forwardRef<HTMLDivElement, QrCodeProps>(function QrCode({ value, size = 200, label, className, ...props }, ref): React.JSX.Element {
	return (
		<div ref={ref} className={cn("inline-flex rounded-xl border border-border bg-white p-4 shadow-sm", className)} role="img" aria-label={label ?? "QR code"} {...props}>
			<QRCodeSVG value={value} size={size} bgColor="#ffffff" fgColor="#000000" />
		</div>
	);
});
