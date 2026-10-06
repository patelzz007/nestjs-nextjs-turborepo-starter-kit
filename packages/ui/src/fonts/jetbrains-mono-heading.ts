import localFont from "next/font/local";

/** JetBrains Mono bound to the heading role, used by the admin app. */
export const jetbrainsMonoHeading = localFont({
	src: [{ path: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", style: "normal" }],
	variable: "--font-heading",
	display: "swap",
});
