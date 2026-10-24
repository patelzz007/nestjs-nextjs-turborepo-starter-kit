// A scannable QR code (the web kit's `QrCode`): the shared in-house encoder
// (`encodeQr` from @workspace/shared, ISO/IEC 18004) drawn with react-native-svg
// as one path inside a framed tile. Always dark modules on a light tile, in every
// theme, from the `qr-foreground` / `qr-background` tokens, so a scanner reads it
// reliably. Data-agnostic: the caller gives the encoded `value` and the
// accessible name (`label`, "Reward redemption QR code").
//
// Colours: the tile's `bg-qr-background` is the light side. The modules are a
// `currentColor` path inside an `Svg` whose `color` comes from Uniwind:
// `withUniwind` maps `colorClassName` (an `accent-*` token utility) onto the
// `color` prop, so the token resolves per theme with no colour literal here (the
// same mechanism as `Icon`'s `colorClassName`). Unresolved (no stylesheet, as
// under Jest), `currentColor` falls back to react-native-svg's default, black.

import { encodeQr, qrMatrixToSvgPath, type QrSvgPath } from "@workspace/shared";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";

/** No quiet zone inside the drawing: the tile's padding and `qr-background` are the light margin. */
const TILE_QUIET_ZONE_MODULES = 0;

export const qrCodeVariants = cva("items-center justify-center self-start bg-qr-background", {
	variants: {
		/** `framed`: a bordered tile that stands on its own. `plain`: just the quiet zone, inside a frame the caller draws. */
		variant: {
			framed: "rounded-xl border border-border",
			plain: "rounded-none",
		},
		size: {
			sm: "p-2",
			md: "p-3",
			lg: "p-4",
		},
	},
	defaultVariants: { variant: "framed", size: "md" },
});

type QrCodeVariantProps = VariantProps<typeof qrCodeVariants>;
export type QrCodeVariant = NonNullable<QrCodeVariantProps["variant"]>;
export type QrCodeSize = NonNullable<QrCodeVariantProps["size"]>;

/** Edge of the code per size, in points: `lg` is readable by a POS scanner at arm's length (the web's 200 px). */
export const QR_CODE_SIZES: Readonly<Record<QrCodeSize, number>> = {
	sm: 120,
	md: 160,
	lg: 200,
};

/** react-native-svg's `Svg` with Uniwind's `colorClassName`: the token sets the `color` the path's `currentColor` reads. */
const ThemedSvg = withUniwind(Svg);

export interface QrCodeProps {
	/** The string the code encodes. */
	readonly value: string;
	/** The accessible name, supplied by the caller ("Reward redemption QR code"). */
	readonly label: string;
	readonly variant?: QrCodeVariant | undefined;
	readonly size?: QrCodeSize | undefined;
	/** Extra classes for the tile, merged last (layout: `self-center`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const QrCode = React.memo(
	React.forwardRef<ViewInstance, QrCodeProps>(function QrCode({ value, label, variant = "framed", size = "md", className, testID }, ref): React.JSX.Element {
		const symbol = React.useMemo((): QrSvgPath => qrMatrixToSvgPath(encodeQr(value), { quietZoneModules: TILE_QUIET_ZONE_MODULES }), [value]);
		return (
			<View ref={ref} testID={testID} accessible accessibilityRole="image" accessibilityLabel={label} className={cn(qrCodeVariants({ variant, size }), className)}>
				<ThemedSvg
					width={QR_CODE_SIZES[size]}
					height={QR_CODE_SIZES[size]}
					viewBox={`0 0 ${String(symbol.viewBoxSize)} ${String(symbol.viewBoxSize)}`}
					colorClassName="accent-qr-foreground">
					<Path d={symbol.path} fill="currentColor" />
				</ThemedSvg>
			</View>
		);
	}),
);
