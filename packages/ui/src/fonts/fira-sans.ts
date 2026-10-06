import localFont from "next/font/local";

/** Body face for the merchant app. Fira Sans has no variable cut, so each weight is its own file. */
export const firaSans = localFont({
	src: [
		{ path: "../../node_modules/@fontsource/fira-sans/files/fira-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
		{ path: "../../node_modules/@fontsource/fira-sans/files/fira-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
		{ path: "../../node_modules/@fontsource/fira-sans/files/fira-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
		{ path: "../../node_modules/@fontsource/fira-sans/files/fira-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
	],
	variable: "--font-sans",
	display: "swap",
});
