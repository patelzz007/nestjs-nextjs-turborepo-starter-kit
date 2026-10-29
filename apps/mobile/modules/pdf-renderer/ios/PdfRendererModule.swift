// The app's PDF engine on iOS (ADR 056): PDFKit, which iOS ships.
// Stateless — every call opens the file — so nothing leaks between screens.
// Thin on purpose: the viewer's logic (zoom, layout, caching policy, search
// navigation, failure wording) lives in TypeScript, where it is tested; this
// file only answers "how big are the pages", "draw page N this wide", "where
// does this text appear" and "let the person save a copy".
//
// - Search is PDFKit's `findString`, on every supported iOS version.
// - Saving is the system's "Save to Files" dialog (a document picker that
//   exports a copy): iOS has no shared Downloads folder an app writes into.
//
// Expo runs AsyncFunctions off the main thread, and PDFKit drawing into a
// bitmap context and searching are safe there; the save dialog is UIKit, so
// it runs on the main queue.

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

/** The copy could not be prepared or the dialog could not be shown (JS: ERR_PDF_SAVE_FAILED). */
internal final class PdfSaveFailedException: Exception {
  override var code: String { "ERR_PDF_SAVE_FAILED" }
  override var reason: String { "The PDF could not be saved" }
}

/** At most this many matches are reported: plenty to step through, small enough to cross into JavaScript. */
private let MAX_SEARCH_MATCHES = 500

/** The folder under the app's caches that holds rendered pages; the OS may empty it. */
private let PAGE_CACHE_FOLDER = "pdf-pages"
/** A quarter turn: pages rotated 90° or 270° swap their width and height. */
private let QUARTER_TURN_DEGREES = 90
private let HALF_TURN_DEGREES = 180

public final class PdfRendererModule: Module {
  /** The open save dialog's delegate: UIKit holds it weakly, so the module keeps it until the dialog closes. */
  private var saveDelegate: SaveDialogDelegate?

  public func definition() -> ModuleDefinition {
    Name("PdfRenderer")

    Constant("searchSupported") { true }
    Constant("saveSupported") { true }

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

    // Every match of `query`, in document order: the page and the match's boxes (one per line) as fractions of the page.
    AsyncFunction("searchDocument") { (fileUri: URL, query: String) -> [[String: Any]] in
      let document = try Self.openDocument(fileUri)
      if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        return []
      }
      var matches: [[String: Any]] = []
      for selection in document.findString(query, withOptions: [.caseInsensitive, .diacriticInsensitive]).prefix(MAX_SEARCH_MATCHES) {
        // A match is reported on the page it starts on.
        guard let page = selection.pages.first else {
          continue
        }
        let rects = selection.selectionsByLine()
          .filter { $0.pages.contains(page) }
          .map { Self.pageFraction(of: $0.bounds(for: page), on: page) }
        matches.append(["pageIndex": document.index(for: page), "rects": rects])
      }
      return matches
    }

    // "Save to Files": the person picks where; resolves `saved: false` when they cancel.
    AsyncFunction("saveDocument") { (fileUri: URL, fileName: String, promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(PdfSaveFailedException())
        return
      }
      // Export a copy under the document's own name, from a folder of its own.
      let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
      let named = folder.appendingPathComponent(fileName)
      do {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: fileUri, to: named)
      } catch {
        promise.reject(PdfSaveFailedException())
        return
      }
      let delegate = SaveDialogDelegate { [weak self] saved in
        try? FileManager.default.removeItem(at: folder)
        self?.saveDelegate = nil
        promise.resolve(["saved": saved, "fileName": fileName])
      }
      self.saveDelegate = delegate
      let picker = UIDocumentPickerViewController(forExporting: [named], asCopy: true)
      picker.delegate = delegate
      presenter.present(picker, animated: true)
    }.runOnQueue(.main)
  }

  /** A box in page space as fractions of the page as it is shown (crop box, rotation applied; top-left origin). */
  private static func pageFraction(of rect: CGRect, on page: PDFPage) -> [String: Double] {
    let size = displaySize(of: page)
    // The same transform the page is drawn with: page space to an upright box `size` big, origin bottom-left.
    let shown = rect.applying(page.transform(for: .cropBox))
    return [
      "left": Double(shown.minX / size.width),
      "top": Double((size.height - shown.maxY) / size.height),
      "width": Double(shown.width / size.width),
      "height": Double(shown.height / size.height),
    ]
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

/** Reports how the save dialog closed: a place was chosen (saved) or the person cancelled. */
private final class SaveDialogDelegate: NSObject, UIDocumentPickerDelegate {
  private let onClose: (Bool) -> Void

  init(onClose: @escaping (Bool) -> Void) {
    self.onClose = onClose
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    onClose(true)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    onClose(false)
  }
}
