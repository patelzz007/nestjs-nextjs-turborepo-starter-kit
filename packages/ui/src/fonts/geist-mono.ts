import localFont from "next/font/local";

/** Monospace face for code, IDs and keyboard hints, shared by every app. */
export const geistMono = localFont({
	src: [
		{ path: "../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
		{ path: "../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
	],
	variable: "--font-mono",
	display: "swap",
});
