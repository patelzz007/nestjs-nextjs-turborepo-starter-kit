// A scannable QR code (the web kit's `QrCode`): react-qr-code drawn with
// react-native-svg inside a framed tile. Always dark modules on a light tile,
// in every theme, from the `qr-foreground` / `qr-background` tokens, so a
// scanner reads it reliably. Data-agnostic: the caller gives the encoded
// `value` and the accessible name (`label`, "Reward redemption QR code").
//
// Colours: react-qr-code takes colour VALUES (`fgColor`, `bgColor`), not
// classes. `withUniwind` maps any `…Color` prop from a matching `…ColorClassName`
// holding an `accent-*` token utility, so the tokens resolve per theme with no
// colour literal here (the same mechanism as `Icon`'s `colorClassName`).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View } from "react-native";
import QRCode from "react-qr-code";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";

/** react-qr-code with Uniwind's `fgColorClassName` / `bgColorClassName`. */
const ThemedQRCode = withUniwind(QRCode);

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
	React.forwardRef<View, QrCodeProps>(function QrCode({ value, label, variant = "framed", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} accessible accessibilityRole="image" accessibilityLabel={label} className={cn(qrCodeVariants({ variant, size }), className)}>
				<ThemedQRCode value={value} size={QR_CODE_SIZES[size]} fgColorClassName="accent-qr-foreground" bgColorClassName="accent-qr-background" />
			</View>
		);
	}),
);
