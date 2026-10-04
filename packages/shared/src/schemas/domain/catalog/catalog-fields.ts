import { z } from "zod";

// ── Catalog field contracts (shared by products and sample categories) ─────
//
// ONE definition of each text field's bounds. The same numbers size the
// database columns (apps/api/prisma/schema.prisma `@db.VarChar(n)`), so the
// API rejects with 400 exactly what the database could not store.

/** Product / category display names (`VarChar(200)`). */
export const CATALOG_NAME_MAX_LENGTH = 200;
/** URL slugs (`VarChar(200)`). */
export const CATALOG_SLUG_MAX_LENGTH = 200;
/** Stock-keeping units (`VarChar(64)`). */
export const PRODUCT_SKU_MAX_LENGTH = 64;
/** Brand names (`VarChar(120)`). */
export const PRODUCT_BRAND_MAX_LENGTH = 120;
/** Listing teaser text (`VarChar(500)`). */
export const PRODUCT_SHORT_DESCRIPTION_MAX_LENGTH = 500;
/** Long-form descriptions (`Text`, bounded by the API). */
export const CATALOG_DESCRIPTION_MAX_LENGTH = 10_000;
/** Image URLs (`VarChar(2048)`). */
export const PRODUCT_IMAGE_URL_MAX_LENGTH = 2_048;
/**
 * Largest accepted price: fits the `Decimal(18, 2)` money columns and is still
 * exact to the cent as a JS number (the column's own maximum is not).
 */
export const CATALOG_MAX_PRICE = 999_999_999_999.99;

/** Lower-case words joined by single hyphens (`summer-sale-2026`). */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Letters, digits and `-`/`_`/`.` — what scanners and integrations accept. */
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** A trimmed, non-blank string of at most `maxLength` characters. */
export function requiredText(maxLength: number): z.ZodPipe<z.ZodString, z.ZodString> {
	return z.string().trim().pipe(z.string().min(1).max(maxLength));
}

export const CatalogNameSchema = requiredText(CATALOG_NAME_MAX_LENGTH);
export const CatalogSlugSchema = z.string().trim().min(1).max(CATALOG_SLUG_MAX_LENGTH).regex(SLUG_PATTERN, "must be lower-case words joined by hyphens");
export const ProductSkuSchema = z.string().trim().min(1).max(PRODUCT_SKU_MAX_LENGTH).regex(SKU_PATTERN, "may contain only letters, digits, '.', '_' and '-'");
export const CatalogDescriptionSchema = requiredText(CATALOG_DESCRIPTION_MAX_LENGTH);
export const ProductBrandSchema = requiredText(PRODUCT_BRAND_MAX_LENGTH);
export const ProductShortDescriptionSchema = requiredText(PRODUCT_SHORT_DESCRIPTION_MAX_LENGTH);
export const ProductImageUrlSchema = z.url({ protocol: /^https?$/ }).max(PRODUCT_IMAGE_URL_MAX_LENGTH);
export const CatalogPriceSchema = z.coerce.number().nonnegative().max(CATALOG_MAX_PRICE);

/** The optimistic-lock token a PATCH is based on (rules/08 → "Race conditions", option B). */
export const OptimisticVersionSchema = z.number().int().nonnegative();
