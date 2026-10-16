// Bundled images (`import appIcon from "../assets/app-icon.png"`): Metro turns
// each into an asset id, a number that `Image.resolveAssetSource` resolves to a
// source with a `uri`.
declare module "*.png" {
	const asset: number;
	export default asset;
}
