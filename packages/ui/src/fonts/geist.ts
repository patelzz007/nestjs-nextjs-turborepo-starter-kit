import localFont from "next/font/local";

/** Body face for the admin app. */
export const geist = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
	variable: "--font-sans",
	display: "swap",
});
