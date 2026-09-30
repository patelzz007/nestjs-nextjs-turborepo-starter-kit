const STORAGE_PREFIX = "docs:feedback:";

function storageKey(): string {
	return `${STORAGE_PREFIX}${window.location.pathname}`;
}

function readVote(): string | null {
	try {
		return window.localStorage.getItem(storageKey());
	} catch {
		return null;
	}
}

function writeVote(value: string): void {
	try {
		window.localStorage.setItem(storageKey(), value);
	} catch {
		// Storage unavailable: the thank-you still shows, the vote is just not remembered.
	}
}

/** "Was this page helpful?" — remembered per page in localStorage. */
export function initFeedback(): void {
	const root = document.querySelector<HTMLElement>("[data-feedback]");
	if (root === null) {
		return;
	}
	const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-feedback-value]")];
	const thanks = root.querySelector<HTMLElement>("[data-feedback-thanks]");

	const show = (value: string | null): void => {
		for (const button of buttons) {
			button.setAttribute("aria-pressed", String(button.dataset.feedbackValue === value));
		}
		if (thanks !== null) {
			thanks.hidden = value === null;
		}
	};

	for (const button of buttons) {
		button.addEventListener("click", () => {
			const value = button.dataset.feedbackValue ?? null;
			if (value !== null) {
				writeVote(value);
			}
			show(value);
		});
	}
	show(readVote());
}
