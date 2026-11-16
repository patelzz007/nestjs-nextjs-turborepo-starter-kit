import { act, renderHook } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { acceptsFile, formatFileSize, pickDocuments, pickImages, useFileUpload, type PickedFile } from "../use-file-upload";

jest.mock("expo-document-picker", (): { readonly getDocumentAsync: jest.Mock } => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-image-picker", (): { readonly launchImageLibraryAsync: jest.Mock } => ({ launchImageLibraryAsync: jest.fn() }));

const PDF: PickedFile = { uri: "file:///cache/report.pdf", name: "report.pdf", size: 2048, mimeType: "application/pdf" };
const PHOTO: PickedFile = { uri: "file:///cache/photo.jpg", name: "photo.jpg", size: 5_000_000, mimeType: "image/jpeg" };

describe("the file helpers", () => {
	it("write a size as people read it", () => {
		expect(formatFileSize(512)).toBe("512 B");
		expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
	});

	it("match a file against types, families and extensions", () => {
		expect(acceptsFile([], "x.bin", null)).toBe(true);
		expect(acceptsFile(["image/*"], "photo.jpg", "image/jpeg")).toBe(true);
		expect(acceptsFile([".pdf"], "REPORT.PDF", null)).toBe(true);
		expect(acceptsFile(["application/pdf"], "photo.jpg", "image/jpeg")).toBe(false);
	});
});

describe("the pickers", () => {
	it("read the document picker's answer, and nothing when it was cancelled", async () => {
		jest
			.mocked(DocumentPicker.getDocumentAsync)
			.mockResolvedValueOnce({ canceled: false, assets: [{ uri: PDF.uri, name: PDF.name, size: 2048, mimeType: "application/pdf", lastModified: 0 }] });
		expect(await pickDocuments({ accept: ["application/pdf", ".pdf"], multiple: false })).toStrictEqual([PDF]);
		expect(DocumentPicker.getDocumentAsync).toHaveBeenLastCalledWith({ type: ["application/pdf"], multiple: false, copyToCacheDirectory: true });
		jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null });
		expect(await pickDocuments({ accept: [], multiple: true })).toStrictEqual([]);
	});

	it("read the photo library's answer", async () => {
		jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
			canceled: false,
			assets: [{ uri: "file:///cache/IMG_1.jpg", width: 10, height: 10, fileName: null, fileSize: 100, mimeType: "image/jpeg" }],
		});
		expect(await pickImages({ accept: [], multiple: true })).toStrictEqual([{ uri: "file:///cache/IMG_1.jpg", name: "IMG_1.jpg", size: 100, mimeType: "image/jpeg" }]);
	});
});

describe("useFileUpload", () => {
	it("keeps the files that pass the checks and says why the others did not", async () => {
		const pick = jest.fn().mockResolvedValue([PDF, PHOTO]);
		const { result } = await renderHook(() => useFileUpload({ accept: ["application/pdf"], maxSize: 1024 * 1024, pick }));
		await act(async (): Promise<void> => {
			await result.current.openPicker();
		});
		expect(result.current.files.map((file) => file.name)).toStrictEqual(["report.pdf"]);
		expect(result.current.errors).toStrictEqual(["photo.jpg is not a type of file this accepts."]);
	});

	it("refuses a file that is too large, and files past the limit", async () => {
		const { result } = await renderHook(() => useFileUpload({ maxSize: 4096, maxFiles: 1 }));
		await act((): void => {
			result.current.addFiles([PHOTO]);
		});
		expect(result.current.errors).toStrictEqual(["photo.jpg is larger than 4.0 KB."]);
		await act((): void => {
			result.current.addFiles([PDF]);
		});
		expect(result.current.isFull).toBe(true);
		await act((): void => {
			result.current.addFiles([PDF]);
		});
		expect(result.current.files).toHaveLength(1);
	});

	it("tracks each upload's progress and outcome, and removes, moves and clears files", async () => {
		const { result } = await renderHook(() => useFileUpload());
		await act((): void => {
			result.current.addFiles([PDF, PHOTO]);
		});
		const [first, second] = result.current.files;
		await act((): void => {
			result.current.setProgress(first?.id ?? "", 0.4);
		});
		expect(result.current.files.at(0)).toMatchObject({ status: "uploading", progress: 0.4 });
		await act((): void => {
			result.current.setStatus(first?.id ?? "", "error", "Network");
			result.current.setStatus(second?.id ?? "", "done");
		});
		expect(result.current.files.map((file) => [file.status, file.error, file.progress])).toStrictEqual([
			["error", "Network", 0.4],
			["done", null, 1],
		]);
		await act((): void => {
			result.current.moveFile(second?.id ?? "", 0);
		});
		expect(result.current.files.at(0)?.name).toBe("photo.jpg");
		await act((): void => {
			result.current.removeFile(second?.id ?? "");
		});
		expect(result.current.files).toHaveLength(1);
		await act((): void => {
			result.current.clearFiles();
		});
		expect(result.current.files).toHaveLength(0);
	});

	it("replaces the one file when it takes a single file", async () => {
		const { result } = await renderHook(() => useFileUpload({ multiple: false, source: "images", pick: jest.fn().mockResolvedValue([PHOTO]) }));
		await act((): void => {
			result.current.addFiles([PDF]);
		});
		await act(async (): Promise<void> => {
			await result.current.openPicker();
		});
		expect(result.current.files.map((file) => file.name)).toStrictEqual(["photo.jpg"]);
	});
});
