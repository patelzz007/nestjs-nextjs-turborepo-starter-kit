import { iconSvg } from "@/lib/icons";
import { highlightTerms, queryTerms, SearchIndexSchema, searchIndex, type SearchEntry, type SearchHit } from "@/lib/search";

/** Where `src/pages/search-index.json.ts` is emitted. */
const SEARCH_INDEX_URL = "/search-index.json";
const RESULT_LIMIT = 12;
/** Placeholder rows shown while the index downloads — enough to fill the dialog's first screen. */
const SKELETON_RESULT_COUNT = 4;

let indexRequest: Promise<readonly SearchEntry[]> | null = null;
/** Set once the index has arrived, so a search with the index in hand never flashes placeholders. */
let indexLoaded = false;

/** Fetches and validates the index once; a failed request is retried on the next search. */
function loadIndex(): Promise<readonly SearchEntry[]> {
	indexRequest ??= fetch(SEARCH_INDEX_URL)
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(`Search index request failed with HTTP ${String(response.status)}`);
			}
			const index = SearchIndexSchema.parse(await response.json());
			indexLoaded = true;
			return index;
		})
		.catch((error: unknown) => {
			indexRequest = null;
			throw error;
		});
	return indexRequest;
}

function resultElement(hit: SearchHit, terms: readonly string[], selected: boolean): HTMLLIElement {
	const item = document.createElement("li");
	const link = document.createElement("a");
	link.className = "search-result";
	link.href = hit.entry.href;
	link.setAttribute("role", "option");
	link.setAttribute("aria-selected", String(selected));
	link.innerHTML = [
		`<span class="search-result__icon">${iconSvg(hit.entry.kind === "heading" ? "listChecks" : "fileText", 15)}</span>`,
		`<span class="search-result__body">`,
		`<span class="search-result__title">${highlightTerms(hit.entry.title, terms)}</span>`,
		`<span class="search-result__context">${highlightTerms(hit.entry.context, [])}</span>`,
		hit.excerpt.length > 0 ? `<span class="search-result__excerpt">${highlightTerms(hit.excerpt, terms)}</span>` : "",
		`</span>`,
	].join("");
	item.append(link);
	return item;
}

/** A result-shaped placeholder: icon, title and context lines (hidden from assistive tech — the list is `aria-busy`). */
function skeletonResultElement(): HTMLLIElement {
	const item = document.createElement("li");
	item.className = "search-result search-result--skeleton";
	item.setAttribute("aria-hidden", "true");
	item.innerHTML = [
		`<span class="search-result__icon"><span class="skeleton-bone skeleton-bone--icon"></span></span>`,
		`<span class="search-result__body">`,
		`<span class="skeleton-bone skeleton-bone--title"></span>`,
		`<span class="skeleton-bone skeleton-bone--line"></span>`,
		`</span>`,
	].join("");
	return item;
}

function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)
	);
}

function goTo(href: string): void {
	window.location.assign(href);
}

/**
 * Command-palette search dialog: ⌘K / Ctrl K / "/" to open, arrows + Enter to
 * navigate. `navigate` opens the chosen result (injectable for tests).
 */
export function initSearch(navigate: (href: string) => void = goTo): void {
	const dialog = document.querySelector<HTMLDialogElement>("[data-search-dialog]");
	const input = document.querySelector<HTMLInputElement>("[data-search-input]");
	const list = document.querySelector<HTMLUListElement>("[data-search-results]");
	const status = document.querySelector<HTMLElement>("[data-search-status]");
	if (dialog === null || input === null || list === null || status === null) {
		return;
	}

	const isMac = navigator.userAgent.includes("Mac");
	for (const shortcut of document.querySelectorAll<HTMLElement>("[data-search-shortcut]")) {
		shortcut.textContent = isMac ? "⌘K" : "Ctrl K";
	}

	let hits: readonly SearchHit[] = [];
	let selected = 0;
	let generation = 0;

	const setStatus = (message: string | null): void => {
		status.hidden = message === null;
		status.textContent = message ?? "";
	};

	const renderHits = (terms: readonly string[]): void => {
		list.removeAttribute("aria-busy");
		list.replaceChildren(...hits.map((hit, index) => resultElement(hit, terms, index === selected)));
		list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
	};

	const runSearch = async (): Promise<void> => {
		const query = input.value;
		const current = ++generation;
		if (queryTerms(query).length === 0) {
			hits = [];
			renderHits([]);
			setStatus("Type to search the guides.");
			return;
		}
		if (!indexLoaded) {
			hits = [];
			setStatus(null);
			list.setAttribute("aria-busy", "true");
			list.replaceChildren(...Array.from({ length: SKELETON_RESULT_COUNT }, skeletonResultElement));
		}
		try {
			const index = await loadIndex();
			if (current !== generation) {
				return;
			}
			hits = searchIndex(index, query, RESULT_LIMIT);
			selected = 0;
			renderHits(queryTerms(query));
			setStatus(hits.length === 0 ? `No results for “${query}”.` : null);
		} catch {
			if (current === generation) {
				hits = [];
				renderHits([]);
				setStatus("Search is unavailable right now. Please try again.");
			}
		}
	};

	const open = (): void => {
		if (!dialog.open) {
			dialog.showModal();
		}
		input.select();
		void loadIndex().catch(() => undefined);
	};

	for (const trigger of document.querySelectorAll<HTMLElement>("[data-search-open]")) {
		trigger.addEventListener("click", open);
	}
	document.querySelector<HTMLButtonElement>("[data-search-close]")?.addEventListener("click", () => {
		dialog.close();
	});
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) {
			dialog.close();
		}
	});
	input.addEventListener("input", () => {
		void runSearch();
	});
	input.addEventListener("keydown", (event) => {
		if (hits.length === 0) {
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			selected = (selected + step + hits.length) % hits.length;
			renderHits(queryTerms(input.value));
		} else if (event.key === "Enter") {
			const hit = hits[selected];
			if (hit !== undefined) {
				event.preventDefault();
				dialog.close();
				navigate(hit.entry.href);
			}
		}
	});
	list.addEventListener("click", (event) => {
		if (event.target instanceof Element && event.target.closest("a") !== null) {
			dialog.close();
		}
	});
	document.addEventListener("keydown", (event) => {
		const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
		const slash = event.key === "/" && !isTypingTarget(event.target);
		if (commandK || slash) {
			event.preventDefault();
			open();
		}
	});
}
