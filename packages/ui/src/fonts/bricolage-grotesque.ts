import localFont from "next/font/local";

/** Display face for headings and large reward figures, shared by every app. */
export const bricolageGrotesque = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2", weight: "200 800", style: "normal" }],
	variable: "--font-heading",
	display: "swap",
});
