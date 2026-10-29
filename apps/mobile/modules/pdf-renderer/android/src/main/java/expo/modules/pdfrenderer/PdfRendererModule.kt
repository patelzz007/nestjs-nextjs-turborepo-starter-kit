// The app's PDF engine on Android (ADR 056): android.graphics.pdf.PdfRenderer,
// which Android ships. Stateless — every call opens the file — so nothing leaks
// between screens, and PdfRenderer's one-page-open-at-a-time rule is kept by
// construction. Thin on purpose: the viewer's logic (zoom, layout, search
// navigation, failure wording) lives in TypeScript, where it is tested; this
// file only answers "how big are the pages", "draw page N this wide", "where
// does this text appear" and "save a copy in Downloads".
//
// - Search uses PdfRenderer's text API, added in Android 15 (API 35):
//   `searchSupported` is false below it and the viewer hides its search button.
// - Saving writes into the shared Downloads collection through MediaStore
//   (Android 10, API 29, and later), which needs no storage permission.
//
// Expo runs AsyncFunctions off the main thread.

package expo.modules.pdfrenderer

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import androidx.annotation.RequiresApi
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import kotlin.math.roundToInt

/** The PDF is encrypted with a user password (JS: ERR_PDF_PASSWORD_PROTECTED). */
internal class PdfPasswordProtectedException(cause: Throwable?) :
  CodedException("ERR_PDF_PASSWORD_PROTECTED", "The PDF is password-protected", cause)

/** PdfRenderer could not open the file (JS: ERR_PDF_UNREADABLE). */
internal class PdfUnreadableException(cause: Throwable?) :
  CodedException("ERR_PDF_UNREADABLE", "The PDF could not be read", cause)

/** A page index outside the document, or a width below one pixel (JS: ERR_PDF_INVALID_REQUEST). */
internal class PdfInvalidRequestException :
  CodedException("ERR_PDF_INVALID_REQUEST", "No such page, or an invalid width", null)

/** The rendered page could not be written to the cache (JS: ERR_PDF_RENDER_FAILED). */
internal class PdfRenderFailedException(cause: Throwable?) :
  CodedException("ERR_PDF_RENDER_FAILED", "The page could not be rendered", cause)

/** Search or save is not available on this version of Android (JS: ERR_PDF_UNSUPPORTED). */
internal class PdfUnsupportedException :
  CodedException("ERR_PDF_UNSUPPORTED", "Not available on this version of Android", null)

/** The copy could not be written to Downloads (JS: ERR_PDF_SAVE_FAILED). */
internal class PdfSaveFailedException(cause: Throwable?) :
  CodedException("ERR_PDF_SAVE_FAILED", "The PDF could not be saved", cause)

/** Text search needs PdfRenderer's text API, added in Android 15 (API 35). */
private val SEARCH_SUPPORTED = Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM
/** Saving to Downloads without a storage permission needs MediaStore.Downloads (Android 10, API 29). */
private val SAVE_SUPPORTED = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
/** At most this many matches are reported: plenty to step through, small enough to cross into JavaScript. */
private const val MAX_SEARCH_MATCHES = 500
private const val PDF_MIME_TYPE = "application/pdf"
/** MediaStore's flag for a row still being written: hidden from other apps until it is cleared. */
private const val PENDING = 1
private const val NOT_PENDING = 0

/** The folder under the app's cache that holds rendered pages; the OS may empty it. */
private const val PAGE_CACHE_FOLDER = "pdf-pages"
/** PNG ignores the quality argument; 100 is the documented "maximum" value. */
private const val PNG_QUALITY = 100

class PdfRendererModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PdfRenderer")

    Constant("searchSupported") { SEARCH_SUPPORTED }
    Constant("saveSupported") { SAVE_SUPPORTED }

    AsyncFunction("openDocument") { fileUri: String ->
      withRenderer(fileUri) { renderer ->
        val pages = (0 until renderer.pageCount).map { index ->
          renderer.openPage(index).use { page -> mapOf("width" to page.width.toDouble(), "height" to page.height.toDouble()) }
        }
        mapOf("pageCount" to renderer.pageCount, "pages" to pages)
      }
    }

    AsyncFunction("renderPage") { fileUri: String, pageIndex: Int, widthPx: Int ->
      withRenderer(fileUri) { renderer ->
        if (widthPx < 1 || pageIndex < 0 || pageIndex >= renderer.pageCount) {
          throw PdfInvalidRequestException()
        }
        val output = cachedPageFile(fileUri, pageIndex, widthPx)
        if (!output.exists()) {
          renderer.openPage(pageIndex).use { page ->
            // Page sizes are in points; the bitmap keeps the page's proportions at the asked width.
            val heightPx = (widthPx.toDouble() * page.height / page.width).roundToInt().coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
            try {
              bitmap.eraseColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              writePng(bitmap, output)
            } finally {
              bitmap.recycle()
            }
          }
        }
        Uri.fromFile(output).toString()
      }
    }

    // Every match of `query`, in page order: the page and the match's boxes as fractions of the page.
    AsyncFunction("searchDocument") { fileUri: String, query: String ->
      if (!SEARCH_SUPPORTED) {
        throw PdfUnsupportedException()
      }
      withRenderer(fileUri) { renderer -> searchPages(renderer, query) }
    }

    // A copy in the shared Downloads collection; MediaStore renames a clash ("Report (1).pdf").
    AsyncFunction("saveDocument") { fileUri: String, fileName: String ->
      if (!SAVE_SUPPORTED) {
        throw PdfUnsupportedException()
      }
      saveToDownloads(fileUri, fileName)
    }
  }

  /** Searches every page; PdfRenderer matches case-insensitively. Boxes are in page points, top-left origin. */
  @RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
  private fun searchPages(renderer: PdfRenderer, query: String): List<Map<String, Any>> {
    val matches = mutableListOf<Map<String, Any>>()
    if (query.isBlank()) {
      return matches
    }
    for (index in 0 until renderer.pageCount) {
      renderer.openPage(index).use { page ->
        val width = page.width.toDouble()
        val height = page.height.toDouble()
        for (match in page.searchText(query)) {
          if (matches.size >= MAX_SEARCH_MATCHES) {
            return matches
          }
          val rects = match.bounds.map { box ->
            mapOf("left" to box.left / width, "top" to box.top / height, "width" to box.width() / width, "height" to box.height() / height)
          }
          matches.add(mapOf("pageIndex" to index, "rects" to rects))
        }
      }
    }
    return matches
  }

  /** Copies `fileUri` into Downloads as `fileName`; the row stays hidden until the copy is complete. */
  @RequiresApi(Build.VERSION_CODES.Q)
  private fun saveToDownloads(fileUri: String, fileName: String): Map<String, Any> {
    val resolver = context.contentResolver
    val pending = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, fileName)
      put(MediaStore.Downloads.MIME_TYPE, PDF_MIME_TYPE)
      put(MediaStore.Downloads.IS_PENDING, PENDING)
    }
    val target = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, pending) ?: throw PdfSaveFailedException(null)
    try {
      val input = resolver.openInputStream(Uri.parse(fileUri)) ?: throw PdfSaveFailedException(null)
      input.use { source ->
        val output = resolver.openOutputStream(target) ?: throw PdfSaveFailedException(null)
        output.use { destination -> source.copyTo(destination) }
      }
      resolver.update(target, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, NOT_PENDING) }, null, null)
    } catch (error: Exception) {
      resolver.delete(target, null, null)
      throw if (error is CodedException) error else PdfSaveFailedException(error)
    }
    val savedName = resolver.query(target, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    } ?: fileName
    return mapOf("saved" to true, "fileName" to savedName)
  }

  /** Opens `fileUri` (file:// or content://), runs `block`, and closes everything whatever happens. */
  private fun <T> withRenderer(fileUri: String, block: (PdfRenderer) -> T): T {
    val opened: ParcelFileDescriptor? = try {
      context.contentResolver.openFileDescriptor(Uri.parse(fileUri), "r")
    } catch (error: Exception) {
      throw PdfUnreadableException(error)
    }
    val descriptor = opened ?: throw PdfUnreadableException(null)
    return descriptor.use {
      val renderer = try {
        PdfRenderer(it)
      } catch (error: SecurityException) {
        throw PdfPasswordProtectedException(error)
      } catch (error: IOException) {
        throw PdfUnreadableException(error)
      }
      renderer.use(block)
    }
  }

  /** One file per document, page and width, so a page is drawn once per zoom level. */
  private fun cachedPageFile(fileUri: String, pageIndex: Int, widthPx: Int): File {
    val folder = File(context.cacheDir, PAGE_CACHE_FOLDER).apply { mkdirs() }
    val modified = Uri.parse(fileUri).path?.let { File(it).lastModified() } ?: 0L
    val key = "$fileUri|$modified|$pageIndex|$widthPx"
    val digest = MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
    return File(folder, "$digest.png")
  }

  private fun writePng(bitmap: Bitmap, output: File) {
    val partial = File(output.parentFile, "${output.name}.partial")
    try {
      FileOutputStream(partial).use { stream ->
        if (!bitmap.compress(Bitmap.CompressFormat.PNG, PNG_QUALITY, stream)) {
          throw PdfRenderFailedException(null)
        }
      }
      if (!partial.renameTo(output)) {
        throw PdfRenderFailedException(null)
      }
    } catch (error: IOException) {
      partial.delete()
      throw PdfRenderFailedException(error)
    }
  }
}
