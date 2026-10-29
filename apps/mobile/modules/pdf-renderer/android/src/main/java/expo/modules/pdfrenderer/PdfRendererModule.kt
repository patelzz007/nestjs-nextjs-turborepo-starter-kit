// The app's PDF page renderer on Android (ADR 056): android.graphics.pdf.PdfRenderer,
// which Android ships. Stateless — every call opens the file — so nothing leaks
// between screens, and PdfRenderer's one-page-open-at-a-time rule is kept by
// construction. Thin on purpose: the viewer's logic (zoom, layout, failure
// wording) lives in TypeScript, where it is tested; this file only answers
// "how big are the pages" and "draw page N this wide".
//
// Expo runs AsyncFunctions off the main thread.

package expo.modules.pdfrenderer

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
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

/** The folder under the app's cache that holds rendered pages; the OS may empty it. */
private const val PAGE_CACHE_FOLDER = "pdf-pages"
/** PNG ignores the quality argument; 100 is the documented "maximum" value. */
private const val PNG_QUALITY = 100

class PdfRendererModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PdfRenderer")

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
