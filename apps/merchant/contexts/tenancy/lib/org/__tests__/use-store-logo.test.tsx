// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { epochMs, type CompleteFileUploadResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STORE_LOGO_FILE_RULES, STORE_LOGO_HINT, STORE_LOGO_IMAGE_RULES, useRemoveStoreLogo, useUploadStoreLogo, type UseStoreLogoOptions } from "../use-store-logo";

const ORG_SLUG = "jonker-street-kitchen";
const TENANT_ID = "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f";
const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";

const { uploadFileDirect, waitForFileReady, deleteMutation } = vi.hoisted(() => ({
	uploadFileDirect: vi.fn(),
	waitForFileReady: vi.fn<(api: object, fileId: string) => Promise<CompleteFileUploadResponse>>(),
	deleteMutation: vi.fn<(options: { readonly onSuccess: () => Promise<void>; readonly onError: (error: Error) => void }) => object>(),
}));

const API = { files: { delete: { useMutation: deleteMutation } } };

vi.mock("@workspace/client/lib/contexts/identity", () => ({ useAuth: (): object => ({ api: API }) }));
vi.mock("@workspace/client/lib/storage/direct-upload", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@workspace/client/lib/storage/direct-upload")>();
	return { ...actual, uploadFileDirect, waitForFileReady };
});

function readyLogo(): CompleteFileUploadResponse {
	return {
		file: {
			id: FILE_ID,
			category: "STORE_LOGO",
			visibility: "PUBLIC",
			originalName: "logo.webp",
			mimeType: "image/webp",
			sizeBytes: 2048,
			status: "READY",
			scanStatus: "NOT_SCANNED",
			publicUrl: `https://cdn.example.com/stores/${TENANT_ID}/logo/${FILE_ID}.webp`,
			uploadedAt: epochMs(1_794_614_400_000),
		},
	};
}

function logoFile(type = "image/webp"): File {
	return new File([new Uint8Array(2048)], "logo.webp", { type });
}

interface Harness {
	readonly queryClient: QueryClient;
	readonly options: UseStoreLogoOptions;
	readonly wrapper: (props: { readonly children: React.ReactNode }) => React.JSX.Element;
}

function harness(): Harness {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	const options: UseStoreLogoOptions = { tenantSlug: ORG_SLUG, onSuccess: vi.fn(), onError: vi.fn() };
	const wrapper = ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	return { queryClient, options, wrapper };
}

afterEach((): void => {
	cleanup();
	uploadFileDirect.mockReset();
	waitForFileReady.mockReset();
	deleteMutation.mockReset();
});

describe("useUploadStoreLogo", () => {
	it("uploads the logo as the tenant's STORE_LOGO, waits for the checks, then reloads the tenant context", async () => {
		uploadFileDirect.mockResolvedValue({ fileId: FILE_ID });
		waitForFileReady.mockResolvedValue(readyLogo());
		const { queryClient, options, wrapper } = harness();
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useUploadStoreLogo(options), { wrapper });
		const file = logoFile();

		await act(async (): Promise<void> => {
			await result.current.mutateAsync({ tenantId: TENANT_ID, file });
		});

		expect(uploadFileDirect).toHaveBeenCalledWith(
			API,
			{ category: "STORE_LOGO", tenantId: TENANT_ID, assetType: "LOGO", fileName: "logo.webp", mimeType: "image/webp" },
			file,
		);
		expect(waitForFileReady).toHaveBeenCalledWith(API, FILE_ID);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: apiRouter.tenants.context.scopeKey({ tenantSlug: ORG_SLUG }) });
		expect(options.onSuccess).toHaveBeenCalledTimes(1);
	});

	it("rejects a file that is not an allowed image before uploading anything", async () => {
		const { options, wrapper } = harness();
		const { result } = renderHook(() => useUploadStoreLogo(options), { wrapper });

		act((): void => {
			result.current.mutate({ tenantId: TENANT_ID, file: logoFile("application/pdf") });
		});

		await waitFor((): void => {
			expect(options.onError).toHaveBeenCalledWith(expect.objectContaining({ name: "ImageFileRejectedError" }));
		});
		expect(uploadFileDirect).not.toHaveBeenCalled();
	});
});

describe("useRemoveStoreLogo", () => {
	it("deletes through /files and reloads the tenant context before reporting success", async () => {
		deleteMutation.mockReturnValue({ mutate: vi.fn() });
		const { queryClient, options, wrapper } = harness();
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		renderHook(() => useRemoveStoreLogo(options), { wrapper });

		const [[given] = []] = deleteMutation.mock.calls;
		await given?.onSuccess();

		expect(invalidate).toHaveBeenCalledWith({ queryKey: apiRouter.tenants.context.scopeKey({ tenantSlug: ORG_SLUG }) });
		expect(options.onSuccess).toHaveBeenCalledTimes(1);
	});
});

describe("store logo policy", () => {
	it("takes the picker's limits and the square pixel rules from the shared STORE_LOGO policy", () => {
		expect(STORE_LOGO_FILE_RULES).toEqual({ accept: "image/jpeg,image/png,image/webp,image/avif", maxMebibytes: 10 });
		expect(STORE_LOGO_IMAGE_RULES).toMatchObject({ aspectWidth: 1, aspectHeight: 1, minWidth: 256, minHeight: 256 });
		expect(STORE_LOGO_HINT).toContain("at least 256 × 256 pixels");
	});
});
