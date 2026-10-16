/**
 * The in-house QR Model 2 encoder (ISO/IEC 18004) — the public surface. Pure TypeScript with
 * no DOM, Node or Intl API, so the web kit, the native kit, the API and the docs site all
 * draw codes from this one implementation (docs/technical/frontend/qr-codes.md).
 */
export { DEFAULT_QR_ERROR_CORRECTION_LEVEL, QR_ERROR_CORRECTION_LEVELS, QrErrorCorrectionLevelSchema, type QrErrorCorrectionLevel } from "./qr-error-correction";
export { QrDataTooLongError, QrInvalidOptionsError } from "./qr-errors";
export { encodeQr, QrEncodeOptionsSchema, QrMatrix, QrVersionSchema, type QrEncodeOptions } from "./qr-encode";
export { MAX_QR_MASK, MIN_QR_MASK, QrMaskSchema, type QrMask } from "./qr-mask";
export { MAX_QR_VERSION, MIN_QR_VERSION } from "./qr-version-table";
export {
	DEFAULT_QR_QUIET_ZONE_MODULES,
	DEFAULT_QR_SVG_DARK_COLOR,
	DEFAULT_QR_SVG_LIGHT_COLOR,
	qrMatrixToSvgPath,
	renderQrSvg,
	type QrSvgPath,
	type QrSvgPathOptions,
	type RenderQrSvgOptions,
} from "./qr-svg";
