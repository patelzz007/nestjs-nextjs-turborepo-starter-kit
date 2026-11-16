import localFont from "next/font/local";

/** The code face: code blocks read `--font-code` and fall back to `--font-mono` (Geist Mono) without it. */
export const jetBrainsMono = localFont({
	src: [
		{ path: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", style: "normal" },
		{ path: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-italic.woff2", weight: "100 800", style: "italic" },
	],
	variable: "--font-code",
	display: "swap",
});
