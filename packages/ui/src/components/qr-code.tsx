"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import QRCodeSVG from "react-qr-code";

/** Default edge length of the code (px) — large enough for a POS scanner at arm's length. */
const DEFAULT_QR_SIZE_PX = 200;

/**
 * The modules are drawn in `currentColor` over a transparent background, so the
 * frame's `qr-foreground` / `qr-background` tokens (pure black on white in every
 * theme, tokens.css) decide the colours — SVG presentation attributes cannot
 * read CSS variables directly.
 */
const QR_MODULE_COLOR = "currentColor";
const QR_BACKGROUND_COLOR = "transparent";

export interface QrCodeProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Encoded string rendered as a scannable QR (high-contrast black on white for POS scanners). */
	readonly value: string;
	/** Edge length in px; defaults to {@link DEFAULT_QR_SIZE_PX}. */
	readonly size?: number;
	/** Accessible name of the code, e.g. "Reward redemption QR code" — supplied by the caller, never hardcoded. */
	readonly label: string;
}

/** Renders a scannable QR code — always black-on-white inside the frame for reliable merchant scanning. */
export const QrCode = React.forwardRef<HTMLDivElement, QrCodeProps>(function QrCode({ value, size = DEFAULT_QR_SIZE_PX, label, className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="qr-code"
			className={cn("inline-flex rounded-xl border border-border bg-qr-background p-4 text-qr-foreground shadow-sm", className)}
			role="img"
			aria-label={label}
			{...props}>
			<QRCodeSVG value={value} size={size} bgColor={QR_BACKGROUND_COLOR} fgColor={QR_MODULE_COLOR} />
		</div>
	);
});
