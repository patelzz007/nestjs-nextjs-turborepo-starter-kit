import { currentTheme, THEME_CHANGE_EVENT } from "./theme";

/** Mermaid palette matched to the site's lavender accent (light theme). */
const LIGHT_THEME_VARIABLES: Readonly<Record<string, string>> = {
	primaryColor: "#f3eefe",
	primaryBorderColor: "#9373ee",
	primaryTextColor: "#1a1922",
	lineColor: "#7a57e6",
	secondaryColor: "#fbf9ff",
	tertiaryColor: "#ffffff",
	fontFamily: "inherit",
};

/**
 * Renders `<pre class="mermaid">` diagrams (emitted by `remarkMermaid`). The
 * library is only downloaded on pages that contain a diagram, and diagrams are
 * re-rendered when the theme changes. On failure the diagram source stays
 * visible as text.
 */
export function initMermaid(): void {
	const blocks = [...document.querySelectorAll<HTMLElement>("pre.mermaid")];
	if (blocks.length === 0) {
		return;
	}
	for (const block of blocks) {
		block.dataset.source ??= block.textContent;
	}

	const render = async (): Promise<void> => {
		const { default: mermaid } = await import("mermaid");
		const dark = currentTheme() === "dark";
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			theme: dark ? "dark" : "base",
			themeVariables: dark ? { fontFamily: "inherit" } : { ...LIGHT_THEME_VARIABLES },
		});
		for (const block of blocks) {
			block.removeAttribute("data-processed");
			block.textContent = block.dataset.source ?? "";
		}
		await mermaid.run({ nodes: blocks, suppressErrors: true });
	};

	const renderSafely = (): void => {
		render().catch(() => {
			for (const block of blocks) {
				block.dataset.error = "true";
			}
		});
	};

	renderSafely();
	document.addEventListener(THEME_CHANGE_EVENT, renderSafely);
}
