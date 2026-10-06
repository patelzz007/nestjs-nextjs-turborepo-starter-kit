import localFont from "next/font/local";

/** Italic heading face for the web app. */
export const playfairDisplayItalic = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-italic.woff2", weight: "400 900", style: "italic" }],
	variable: "--font-heading",
	display: "swap",
});
