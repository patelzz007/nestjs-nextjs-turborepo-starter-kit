import localFont from "next/font/local";

/** Monospace face for the merchant app. */
export const jetbrainsMono = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", style: "normal" }],
	variable: "--font-mono",
	display: "swap",
});
