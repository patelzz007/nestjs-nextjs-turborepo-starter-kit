import localFont from "next/font/local";

/** Sidebar navigation face shared by every app. */
export const rubik = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2", weight: "300 900", style: "normal" }],
	variable: "--font-sidebar",
	display: "swap",
});
