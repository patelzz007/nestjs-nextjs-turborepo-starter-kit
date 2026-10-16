"use client";

import { encodeQr, qrMatrixToSvgPath, type QrSvgPath } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** Default edge length of the code (px) — large enough for a POS scanner at arm's length. */
const DEFAULT_QR_SIZE_PX = 200;

/**
 * No quiet zone inside the SVG: the frame's own padding (`p-4`) and `qr-background` fill
 * are the light margin around the code, so the modules use the whole drawing area.
 */
const FRAMED_QUIET_ZONE_MODULES = 0;

export interface QrCodeProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Encoded string rendered as a scannable QR (high-contrast black on white for POS scanners). */
	readonly value: string;
	/** Edge length in px; defaults to {@link DEFAULT_QR_SIZE_PX}. */
	readonly size?: number;
	/** Accessible name of the code, e.g. "Reward redemption QR code" — supplied by the caller, never hardcoded. */
	readonly label: string;
}

/**
 * Renders a scannable QR code — always black-on-white inside the frame for reliable merchant
 * scanning. The modules come from the shared in-house encoder (`encodeQr`, ISO/IEC 18004) as
 * one SVG path drawn in `currentColor`, so the frame's `qr-foreground` / `qr-background`
 * tokens (pure black on white in every theme, packages/tokens) decide the colours.
 */
export const QrCode = React.forwardRef<HTMLDivElement, QrCodeProps>(function QrCode({ value, size = DEFAULT_QR_SIZE_PX, label, className, ...props }, ref): React.JSX.Element {
	const { path, viewBoxSize } = React.useMemo((): QrSvgPath => qrMatrixToSvgPath(encodeQr(value), { quietZoneModules: FRAMED_QUIET_ZONE_MODULES }), [value]);
	return (
		<div
			ref={ref}
			data-slot="qr-code"
			className={cn("inline-flex rounded-xl border border-border bg-qr-background p-4 text-qr-foreground shadow-sm", className)}
			role="img"
			aria-label={label}
			{...props}>
			<svg
				data-slot="qr-code-symbol"
				width={size}
				height={size}
				viewBox={`0 0 ${String(viewBoxSize)} ${String(viewBoxSize)}`}
				shapeRendering="crispEdges"
				aria-hidden="true"
				focusable="false">
				<path fill="currentColor" d={path} />
			</svg>
		</div>
	);
});
