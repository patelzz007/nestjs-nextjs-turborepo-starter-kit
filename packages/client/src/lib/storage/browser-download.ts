/**
 * Downloads a file the browser can fetch directly — a signed URL whose
 * response carries `Content-Disposition: attachment`, which is what makes a
 * cross-origin link save instead of navigate (`download` names it only when
 * the URL is same-origin).
 */
export function triggerBrowserDownload(url: string, fileName: string, doc: Document = document): void {
	const anchor = doc.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.rel = "noopener noreferrer";
	anchor.click();
}
