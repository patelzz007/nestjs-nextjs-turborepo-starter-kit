import localFont from "next/font/local";

/** Monospace face for the admin app. */
export const geistMono = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
	variable: "--font-mono",
	display: "swap",
});
