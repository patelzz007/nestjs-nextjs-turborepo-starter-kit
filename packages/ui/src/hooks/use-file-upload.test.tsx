// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { formatBytes, isFileAccepted, useFileUpload, type FileMetadata, type FileUploadOptions, type FileUploadState, type FileUploadActions } from "./use-file-upload";

const LABELS = UI_KIT_LABELS_EN.fileUpload;
const KIB = 1024;
const MAX_SIZE = 2 * KIB;
const STORED: FileMetadata = { id: "stored-1", name: "avatar.png", size: KIB, type: "image/png", url: "https://cdn.example.test/avatar.png" };

function makeFile(name: string, type: string, size: number = KIB): File {
	return new File(["x".repeat(size)], name, { type });
}

let objectUrlCount = 0;
const createObjectURL = vi.fn((): string => {
	objectUrlCount += 1;
	return `blob:preview-${String(objectUrlCount)}`;
});
const revokeObjectURL = vi.fn();

beforeEach((): void => {
	objectUrlCount = 0;
	vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
});

afterEach((): void => {
	cleanup();
	createObjectURL.mockClear();
	revokeObjectURL.mockClear();
	vi.unstubAllGlobals();
});

function setup(options: FileUploadOptions = {}): { readonly result: { readonly current: [FileUploadState, FileUploadActions] }; readonly unmount: () => void } {
	return renderHook(() => useFileUpload(options), { wrapper: UiKitTestProviders });
}

function stateOf(result: { readonly current: [FileUploadState, FileUploadActions] }): FileUploadState {
	const [state] = result.current;
	return state;
}

function actionsOf(result: { readonly current: [FileUploadState, FileUploadActions] }): FileUploadActions {
	const [, actions] = result.current;
	return actions;
}

describe("useFileUpload", () => {
	it("starts with the initial stored files as previews", (): void => {
		const { result } = setup({ initialFiles: [STORED] });
		expect(stateOf(result).files).toEqual([{ file: STORED, id: "stored-1", preview: STORED.url }]);
		expect(stateOf(result).isDragging).toBe(false);
		expect(stateOf(result).errors).toEqual([]);
	});

	it("adds a valid file with an object-URL preview and reports it", (): void => {
		const onFilesAdded = vi.fn();
		const onFilesChange = vi.fn();
		const { result } = setup({ onFilesAdded, onFilesChange });
		const file = makeFile("photo.png", "image/png");

		act((): void => {
			actionsOf(result).addFiles([file]);
		});

		const [added] = stateOf(result).files;
		expect(added?.file).toBe(file);
		expect(added?.preview).toBe("blob:preview-1");
		expect(onFilesAdded).toHaveBeenCalledTimes(1);
		expect(onFilesChange).toHaveBeenCalledTimes(1);
	});

	it("replaces the file in single mode and revokes the old preview", (): void => {
		const { result } = setup();
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png")]);
		});
		act((): void => {
			actionsOf(result).addFiles([makeFile("b.png", "image/png")]);
		});
		expect(stateOf(result).files.map((entry): string => entry.file.name)).toEqual(["b.png"]);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
	});

	it("rejects a file over maxSize with a named, localized error", (): void => {
		const onError = vi.fn();
		const { result } = setup({ maxSize: MAX_SIZE, onError });
		act((): void => {
			actionsOf(result).addFiles([makeFile("huge.pdf", "application/pdf", MAX_SIZE + 1)]);
		});
		const expected = LABELS.fileTooLarge("huge.pdf", LABELS.formatSize(MAX_SIZE));
		expect(stateOf(result).files).toEqual([]);
		expect(stateOf(result).errors).toEqual([expected]);
		expect(onError).toHaveBeenCalledWith([expected]);
		expect(expected).toContain("2 kB");
	});

	it("rejects files outside `accept` (MIME, wildcard and extension entries)", (): void => {
		const { result } = setup({ accept: "image/*,.pdf", multiple: true });
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.jpg", "image/jpeg"), makeFile("b.PDF", ""), makeFile("c.exe", "application/x-msdownload")]);
		});
		expect(stateOf(result).files.map((entry): string => entry.file.name)).toEqual(["a.jpg", "b.PDF"]);
		expect(stateOf(result).errors).toEqual([LABELS.fileTypeNotAccepted("c.exe")]);
	});

	it("refuses a batch that would exceed maxFiles in multiple mode", (): void => {
		const { result } = setup({ multiple: true, maxFiles: 2 });
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png"), makeFile("b.png", "image/png"), makeFile("c.png", "image/png")]);
		});
		expect(stateOf(result).files).toEqual([]);
		expect(stateOf(result).errors).toEqual([LABELS.tooManyFiles(2)]);
	});

	it("skips duplicates without dropping the rest of the batch", (): void => {
		const { result } = setup({ multiple: true });
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png")]);
		});
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png"), makeFile("b.png", "image/png")]);
		});
		expect(stateOf(result).files.map((entry): string => entry.file.name)).toEqual(["a.png", "b.png"]);
	});

	it("sees files added earlier in the same tick", (): void => {
		const { result } = setup({ multiple: true, maxFiles: 1 });
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png")]);
			actionsOf(result).addFiles([makeFile("b.png", "image/png")]);
		});
		expect(stateOf(result).files.map((entry): string => entry.file.name)).toEqual(["a.png"]);
		expect(stateOf(result).errors).toEqual([LABELS.tooManyFiles(1)]);
	});

	it("removes one file and revokes its preview, then clears all and the errors", (): void => {
		const onFilesChange = vi.fn();
		const { result } = setup({ multiple: true, onFilesChange, initialFiles: [STORED] });
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png")]);
		});
		const picked = stateOf(result).files[LIST_SLOT_INDEX.second];
		act((): void => {
			actionsOf(result).removeFile(picked?.id ?? "");
		});
		expect(stateOf(result).files.map((entry): string => entry.id)).toEqual(["stored-1"]);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");

		act((): void => {
			actionsOf(result).addFiles([makeFile("b.png", "image/png")]);
			actionsOf(result).clearFiles();
		});
		expect(stateOf(result).files).toEqual([]);
		expect(stateOf(result).errors).toEqual([]);
		/* The stored file's URL is not the hook's to revoke. */
		expect(revokeObjectURL).not.toHaveBeenCalledWith(STORED.url);
		expect(onFilesChange.mock.lastCall?.at(LIST_SLOT_INDEX.first)).toEqual([]);
	});

	it("clears errors on demand", (): void => {
		const { result } = setup({ accept: ".pdf" });
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png")]);
		});
		expect(stateOf(result).errors).toHaveLength(1);
		act((): void => {
			actionsOf(result).clearErrors();
		});
		expect(stateOf(result).errors).toEqual([]);
	});

	it("tracks drag-over and adds only the first dropped file in single mode", (): void => {
		const first = makeFile("first.png", "image/png");
		render(<DropZone />, { wrapper: UiKitTestProviders });
		const zone = screen.getByTestId("zone");

		fireEvent.dragEnter(zone);
		expect(zone.dataset.dragging).toBe("true");
		fireEvent.drop(zone, { dataTransfer: { files: [first, makeFile("second.png", "image/png")] } });
		expect(zone.dataset.dragging).toBe("false");
		expect(screen.getByTestId("names").textContent).toBe("first.png");
	});

	it("ignores drops while the file input is disabled", (): void => {
		render(<DropZone disabled />, { wrapper: UiKitTestProviders });
		fireEvent.drop(screen.getByTestId("zone"), { dataTransfer: { files: [makeFile("a.png", "image/png")] } });
		expect(screen.getByTestId("names").textContent).toBe("");
	});

	it("opens the file dialog through the hidden input", (): void => {
		render(<DropZone />, { wrapper: UiKitTestProviders });
		const input = screen.getByTestId("input");
		const click = vi.spyOn(input, "click");
		fireEvent.click(screen.getByRole("button", { name: "Browse" }));
		expect(click).toHaveBeenCalledTimes(1);
	});

	it("adds files picked in the input", (): void => {
		render(<DropZone />, { wrapper: UiKitTestProviders });
		fireEvent.change(screen.getByTestId("input"), { target: { files: [makeFile("picked.png", "image/png")] } });
		expect(screen.getByTestId("names").textContent).toBe("picked.png");
	});

	it("builds file-input props that honour accept and multiple", (): void => {
		const { result } = setup({ accept: "image/*", multiple: true });
		const props = actionsOf(result).getInputProps({ id: "upload" });
		expect(props.type).toBe("file");
		expect(props.accept).toBe("image/*");
		expect(props.multiple).toBe(true);
		expect(props.id).toBe("upload");
		expect(actionsOf(result).getInputProps({ multiple: false }).multiple).toBe(false);
	});

	it("revokes every preview it created on unmount", (): void => {
		const { result, unmount } = setup({ multiple: true });
		act((): void => {
			actionsOf(result).addFiles([makeFile("a.png", "image/png"), makeFile("b.png", "image/png")]);
		});
		unmount();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-2");
	});
});

interface DropZoneProps {
	readonly disabled?: boolean | undefined;
}

function DropZone({ disabled = false }: DropZoneProps): React.JSX.Element {
	const [{ files, isDragging }, { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps }] = useFileUpload();
	return (
		<>
			<button
				type="button"
				data-testid="zone"
				data-dragging={String(isDragging)}
				onClick={openFileDialog}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}>
				Browse
			</button>
			<input data-testid="input" {...getInputProps({ disabled })} />
			<span data-testid="names">{files.map((entry): string => entry.file.name).join(",")}</span>
		</>
	);
}

describe("isFileAccepted", () => {
	it("matches MIME types, wildcards and extensions case-insensitively", (): void => {
		expect(isFileAccepted({ name: "a.png", type: "image/png" }, "*")).toBe(true);
		expect(isFileAccepted({ name: "a.png", type: "image/png" }, "image/*")).toBe(true);
		expect(isFileAccepted({ name: "a.PNG", type: "" }, ".png")).toBe(true);
		expect(isFileAccepted({ name: "a.txt", type: "text/plain" }, "image/*, .pdf")).toBe(false);
		expect(isFileAccepted({ name: "README", type: "" }, ".md")).toBe(false);
	});
});

describe("formatBytes (re-export)", () => {
	it("formats with locale-aware units", (): void => {
		expect(formatBytes(0)).toBe("0 bytes");
		expect(formatBytes(KIB * KIB * 1.5)).toBe("1.5 MB");
	});
});
