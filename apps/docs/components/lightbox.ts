/**
 * Shared image lightbox helpers, ported from the admin docs renderer. Both the
 * inline `img` component and the image-gallery cards open the same full-view
 * overlay (a lazily-created native `<dialog>`), so the dialog factory + open
 * logic live here instead of being duplicated.
 *
 * The lightbox supports two zoom modes, toggled by clicking the image (or the
 * mode pill in the header): **Fit** (default) scales the image to the largest
 * size that fits the dialog; **1:1** renders it at natural pixel size inside a
 * scrollable box. Every open starts in Fit mode.
 *
 * This module is DOM-only and imported exclusively by client components.
 */

import { toast } from "sonner";

import type { MouseEvent } from "react";

import { downloadFilename } from "@/lib/dates";

/** The `src` of the image currently shown in the lightbox (for downloads). */
let currentSrc = "";

/** Fit-mode image classes — fill the box, contain the aspect ratio. */
const FIT_IMAGE_CLASSES = "block w-full h-full max-w-full max-h-full object-contain";

/** 1:1 image classes — natural pixel size, no constraints (parent scrolls). */
const ONE_TO_ONE_IMAGE_CLASSES = "block w-auto h-auto max-w-none max-h-none";

/**
 * Applies the given zoom mode to the lightbox's DOM. Flips the image classes,
 * the wrapper's scroll behavior + centering, the pill label, the image
 * cursor/aria, and the dialog's accessible name.
 */
function applyLightboxMode(dialog: HTMLDialogElement, img: HTMLImageElement, wrapper: HTMLDivElement, pill: HTMLButtonElement, mode: "fit" | "one-to-one"): void {
	img.className = mode === "fit" ? FIT_IMAGE_CLASSES : ONE_TO_ONE_IMAGE_CLASSES;
	wrapper.className =
		mode === "fit" ? "relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-4" : "relative block min-h-0 min-w-0 flex-1 overflow-auto p-4";
	img.style.cursor = mode === "fit" ? "zoom-in" : "zoom-out";
	img.title = mode === "fit" ? "Click for actual size (1:1)" : "Click to fit image";
	img.setAttribute("aria-label", mode === "fit" ? `Zoom to actual size — ${img.alt}` : `Fit image to window — ${img.alt}`);
	pill.textContent = mode === "fit" ? "Fit" : "1:1";
	pill.title = mode === "fit" ? "Show actual size (1:1)" : "Fit image to window";
	pill.setAttribute("aria-label", mode === "fit" ? "Switch to actual size (1:1)" : "Switch to fit image");
	dialog.setAttribute("aria-label", `Image preview — ${mode === "fit" ? "fit" : "actual size (1:1)"} mode`);
}

/** Creates the shared lightbox `<dialog>` (lazily, once) with backdrop-close wiring. */
function createLightboxDialog(): HTMLDialogElement {
	const dialog = document.createElement("dialog");
	dialog.setAttribute("data-docs-lightbox", "true");
	dialog.className =
		"fixed inset-0 z-50 m-auto w-[92vw] max-w-[92vw] h-[88vh] max-h-[88vh] flex flex-col rounded-2xl border border-border/60 bg-background/95 p-0 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm";
	dialog.addEventListener("click", (event): void => {
		if (event.target === dialog) {
			dialog.close();
		}
	});
	dialog.addEventListener("close", (): void => {
		dialog.setAttribute("data-lightbox-mode", "fit");
	});
	dialog.setAttribute("aria-label", "Image preview");
	dialog.setAttribute("data-lightbox-mode", "fit");
	return dialog;
}

/**
 * Opens the shared image lightbox (a native `<dialog>`, created on demand).
 * The trigger element carries the `data-lightbox-src` / `data-lightbox-alt`
 * attributes that define what to show.
 */
export function openLightbox(trigger: HTMLElement): void {
	const src = trigger.getAttribute("data-lightbox-src") ?? "";
	const alt = trigger.getAttribute("data-lightbox-alt") ?? "";
	let dialog = document.querySelector<HTMLDialogElement>("dialog[data-docs-lightbox]");
	if (dialog === null) {
		dialog = createLightboxDialog();
		document.body.appendChild(dialog);
	}
	dialog.replaceChildren();
	currentSrc = src;

	// ── Image ─────────────────────────────────────────────────────────────
	const img = document.createElement("img");
	img.src = src;
	img.alt = alt;
	img.addEventListener("click", (): void => {
		const mode = dialog.getAttribute("data-lightbox-mode");
		const next: "fit" | "one-to-one" = mode === "one-to-one" ? "fit" : "one-to-one";
		dialog.setAttribute("data-lightbox-mode", next);
		applyLightboxMode(dialog, img, wrapper, pill, next);
	});
	img.addEventListener("dblclick", (): void => {
		dialog.setAttribute("data-lightbox-mode", "fit");
		applyLightboxMode(dialog, img, wrapper, pill, "fit");
	});

	// ── Header row: mode pill + download + close ──────────────────────────
	const header = document.createElement("div");
	header.className = "flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5";
	const pill = document.createElement("button");
	pill.type = "button";
	pill.className =
		"inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground";
	pill.addEventListener("click", (): void => {
		const mode = dialog.getAttribute("data-lightbox-mode");
		const next: "fit" | "one-to-one" = mode === "one-to-one" ? "fit" : "one-to-one";
		dialog.setAttribute("data-lightbox-mode", next);
		applyLightboxMode(dialog, img, wrapper, pill, next);
	});
	const downloadButton = document.createElement("button");
	downloadButton.type = "button";
	downloadButton.title = "Download image";
	downloadButton.setAttribute("aria-label", "Download image");
	downloadButton.className =
		"inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground";
	downloadButton.innerHTML =
		'<svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>';
	downloadButton.append(" Download");
	downloadButton.addEventListener("click", (): void => {
		const filename = downloadFilename(currentSrc, alt);
		fetch(currentSrc, { credentials: "same-origin" })
			.then((response): Response => {
				if (!response.ok) {
					throw new Error(`Request failed with status ${String(response.status)}`);
				}
				return response;
			})
			.then((response): Promise<Blob> => response.blob())
			.then((blob): void => {
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = filename;
				document.body.appendChild(link);
				link.click();
				link.remove();
				URL.revokeObjectURL(url);
				toast.success(`Downloaded ${filename}`);
			})
			.catch((): void => {
				toast.error("Download failed — the image could not be fetched.");
			});
	});
	const closeButton = document.createElement("button");
	closeButton.type = "button";
	closeButton.textContent = "✕";
	closeButton.setAttribute("aria-label", "Close image");
	closeButton.title = "Close (Esc)";
	closeButton.className =
		"flex size-7 cursor-pointer items-center justify-center rounded-full text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground";
	closeButton.addEventListener("click", (): void => {
		dialog.close();
	});
	const headerActions = document.createElement("div");
	headerActions.className = "flex shrink-0 items-center gap-2";
	headerActions.append(downloadButton, closeButton);
	header.append(pill, headerActions);

	// ── Scrollable stage ──────────────────────────────────────────────────
	const wrapper = document.createElement("div");
	wrapper.append(img);
	dialog.append(header, wrapper);

	applyLightboxMode(dialog, img, wrapper, pill, "fit");
	dialog.showModal();
}

/**
 * React click handler for any element carrying `data-lightbox-src` /
 * `data-lightbox-alt` — shared by the inline `img` component and the gallery's
 * zoom buttons.
 */
export function handleLightboxClick(event: MouseEvent<HTMLElement>): void {
	event.preventDefault();
	openLightbox(event.currentTarget);
}
