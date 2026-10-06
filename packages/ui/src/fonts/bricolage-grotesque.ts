import localFont from "next/font/local";

/** Display face for buttons and button-styled controls across all apps. */
export const bricolageGrotesque = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2", weight: "200 800", style: "normal" }],
	variable: "--font-button",
	display: "swap",
});
