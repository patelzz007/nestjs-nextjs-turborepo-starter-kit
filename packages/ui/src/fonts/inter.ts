import localFont from "next/font/local";

/** Body face for the web app. */
export const inter = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
	variable: "--font-sans",
	display: "swap",
});
