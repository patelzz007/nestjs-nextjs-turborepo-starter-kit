// The app's PDF page renderer on iOS (ADR 056): PDFKit, which iOS ships.
// Stateless — every call opens the file — so nothing leaks between screens.
// Thin on purpose: the viewer's logic (zoom, layout, caching policy, failure
// wording) lives in TypeScript, where it is tested; this file only answers
// "how big are the pages" and "draw page N this wide".
//
// Expo runs AsyncFunctions off the main thread, and PDFKit drawing into a
// bitmap context is safe there.

import CryptoKit
import ExpoModulesCore
import PDFKit
import UIKit

/** The PDF is encrypted with a user password (JS: ERR_PDF_PASSWORD_PROTECTED). */
internal final class PdfPasswordProtectedException: Exception {
  override var code: String { "ERR_PDF_PASSWORD_PROTECTED" }
  override var reason: String { "The PDF is password-protected" }
}

/** PDFKit could not open the file, or a page is missing (JS: ERR_PDF_UNREADABLE). */
internal final class PdfUnreadableException: Exception {
  override var code: String { "ERR_PDF_UNREADABLE" }
  override var reason: String { "The PDF could not be read" }
}

/** A page index outside the document, or a width below one pixel (JS: ERR_PDF_INVALID_REQUEST). */
internal final class PdfInvalidRequestException: Exception {
  override var code: String { "ERR_PDF_INVALID_REQUEST" }
  override var reason: String { "No such page, or an invalid width" }
}

/** The rendered page could not be written to the cache (JS: ERR_PDF_RENDER_FAILED). */
internal final class PdfRenderFailedException: Exception {
  override var code: String { "ERR_PDF_RENDER_FAILED" }
  override var reason: String { "The page could not be rendered" }
}

/** The folder under the app's caches that holds rendered pages; the OS may empty it. */
private let PAGE_CACHE_FOLDER = "pdf-pages"
/** A quarter turn: pages rotated 90° or 270° swap their width and height. */
private let QUARTER_TURN_DEGREES = 90
private let HALF_TURN_DEGREES = 180

public final class PdfRendererModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfRenderer")

    AsyncFunction("openDocument") { (fileUri: URL) -> [String: Any] in
      let document = try Self.openDocument(fileUri)
      var pages: [[String: Double]] = []
      for index in 0..<document.pageCount {
        guard let page = document.page(at: index) else {
          throw PdfUnreadableException()
        }
        let size = Self.displaySize(of: page)
        pages.append(["width": Double(size.width), "height": Double(size.height)])
      }
      return ["pageCount": document.pageCount, "pages": pages]
    }

    AsyncFunction("renderPage") { (fileUri: URL, pageIndex: Int, widthPx: Int) -> String in
      let document = try Self.openDocument(fileUri)
      guard widthPx >= 1, pageIndex >= 0, pageIndex < document.pageCount, let page = document.page(at: pageIndex) else {
        throw PdfInvalidRequestException()
      }
      let output = try Self.cachedPageUrl(fileUri: fileUri, pageIndex: pageIndex, widthPx: widthPx)
      if FileManager.default.fileExists(atPath: output.path) {
        return output.absoluteString
      }

      let pageSize = Self.displaySize(of: page)
      let scale = CGFloat(widthPx) / pageSize.width
      let pixelSize = CGSize(width: CGFloat(widthPx), height: (pageSize.height * scale).rounded())
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let image = UIGraphicsImageRenderer(size: pixelSize, format: format).image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: pixelSize))
        let cgContext = context.cgContext
        // PDF space has its origin bottom-left; flip, scale, then let PDFKit apply the page's own crop and rotation.
        cgContext.translateBy(x: 0, y: pixelSize.height)
        cgContext.scaleBy(x: scale, y: -scale)
        cgContext.concatenate(page.transform(for: .cropBox))
        page.draw(with: .cropBox, to: cgContext)
      }
      guard let png = image.pngData() else {
        throw PdfRenderFailedException()
      }
      do {
        try png.write(to: output, options: .atomic)
      } catch {
        throw PdfRenderFailedException()
      }
      return output.absoluteString
    }
  }

  private static func openDocument(_ fileUri: URL) throws -> PDFDocument {
    guard let document = PDFDocument(url: fileUri) else {
      throw PdfUnreadableException()
    }
    if document.isLocked {
      throw PdfPasswordProtectedException()
    }
    return document
  }

  /** The page's size in points as it is meant to be seen: its crop box, turned by its rotation. */
  private static func displaySize(of page: PDFPage) -> CGSize {
    let bounds = page.bounds(for: .cropBox)
    let isSideways = page.rotation % HALF_TURN_DEGREES == QUARTER_TURN_DEGREES
    return isSideways ? CGSize(width: bounds.height, height: bounds.width) : bounds.size
  }

  /** One file per document, page and width, so a page is drawn once per zoom level. */
  private static func cachedPageUrl(fileUri: URL, pageIndex: Int, widthPx: Int) throws -> URL {
    guard let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      throw PdfRenderFailedException()
    }
    let folder = caches.appendingPathComponent(PAGE_CACHE_FOLDER, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let attributes = try? FileManager.default.attributesOfItem(atPath: fileUri.path)
    let modified = (attributes?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
    let key = "\(fileUri.absoluteString)|\(modified)|\(pageIndex)|\(widthPx)"
    let digest = SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
    return folder.appendingPathComponent("\(digest).png")
  }
}
