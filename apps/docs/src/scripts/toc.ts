/** Extra room below the sticky header before a heading counts as "current". */
const ACTIVE_OFFSET_PX = 96;

/**
 * "On this page" scroll spy: the active entry is the last heading whose top
 * has scrolled past the sticky header. Also wires the "Back to top" action.
 */
export function initToc(): void {
	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-scroll-top]")) {
		button.addEventListener("click", () => {
			window.scrollTo({ top: 0, behavior: "smooth" });
		});
	}

	const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]")];
	const headings = links.map((link) => document.getElementById(link.dataset.tocLink ?? "")).filter((heading): heading is HTMLElement => heading !== null);
	if (headings.length === 0) {
		return;
	}

	const update = (): void => {
		let current = headings[0]?.id ?? "";
		for (const heading of headings) {
			if (heading.getBoundingClientRect().top - ACTIVE_OFFSET_PX > 0) {
				break;
			}
			current = heading.id;
		}
		for (const link of links) {
			const isActive = link.dataset.tocLink === current;
			link.classList.toggle("is-active", isActive);
			if (isActive) {
				link.setAttribute("aria-current", "location");
			} else {
				link.removeAttribute("aria-current");
			}
		}
	};

	let scheduled = false;
	window.addEventListener(
		"scroll",
		() => {
			if (scheduled) {
				return;
			}
			scheduled = true;
			window.requestAnimationFrame(() => {
				scheduled = false;
				update();
			});
		},
		{ passive: true },
	);
	update();
}
