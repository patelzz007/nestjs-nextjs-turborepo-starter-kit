import type { Prisma } from "@prisma/client";
import { TenantLogoResponseSchema, type TenantLogoResponse } from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import { IMAGE_RENDITIONS_SELECT, toImageSources, type ImageRenditionRows } from "../../../files/public-api";

/**
 * The tenant's live store logo, selected with the tenant (no N+1):
 * its `LOGO` asset whose file finished processing and has a public URL, with
 * its renditions for `srcset`.
 * `(tenantId, assetType)` is unique, so this is 0 or 1 row.
 *
 * The file conditions live in the relation filter (not only in the mapper) so
 * an asset whose `StoredFile` row is hidden by RLS is excluded up front
 * instead of tripping Prisma's required-relation check on `file`.
 */
export const TENANT_LOGO_ASSETS_SELECT = {
	where: {
		assetType: "LOGO",
		isDeleted: false,
		file: { status: "READY", isDeleted: false, publicPath: { not: null } },
	},
	select: { fileId: true, file: { select: { publicPath: true, variants: IMAGE_RENDITIONS_SELECT } } },
	take: 1,
} satisfies Prisma.Tenant$assetsArgs;

/** The rows {@link TENANT_LOGO_ASSETS_SELECT} returns. */
export type TenantLogoAssetRows = readonly { readonly fileId: string; readonly file: { readonly publicPath: string | null; readonly variants: ImageRenditionRows } }[];

/**
 * The tenant's logo as the API returns it (stored references resolved by
 * `resolve`), or `null` (clients show a
 * name monogram). A stored URL that does not satisfy the contract (not an
 * absolute http(s) URL) also degrades to `null`, deliberately: a bad logo
 * must cost the merchant their logo, not fail the whole response.
 */
export function mapTenantLogo(assets: TenantLogoAssetRows, resolve: PublicUrlResolve): TenantLogoResponse | null {
	const asset = assets.at(0);
	const url = resolve(asset?.file.publicPath ?? null);
	if (asset === undefined || url === null) {
		return null;
	}
	const parsed = TenantLogoResponseSchema.safeParse({ fileId: asset.fileId, url, sources: toImageSources(asset.file.variants, resolve) });
	return parsed.success ? parsed.data : null;
}
