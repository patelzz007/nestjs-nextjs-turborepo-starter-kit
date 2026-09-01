declare module "next/font/google" {
	interface NextFontOptions {
		readonly subsets: readonly string[];
		readonly variable?: string;
		readonly display?: string;
		readonly weight?: string | readonly string[];
	}

	interface NextFontResult {
		readonly variable: string;
		readonly className: string;
	}

	export function Bricolage_Grotesque(options: NextFontOptions): NextFontResult;
}
