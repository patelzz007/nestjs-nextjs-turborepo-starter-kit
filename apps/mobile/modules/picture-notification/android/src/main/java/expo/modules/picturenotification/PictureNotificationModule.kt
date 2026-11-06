// A push's picture while the app is open (ADR 070). With the app in the background the system shows
// it under the text; with the app open expo-notifications builds the notification and keeps the
// picture as a small icon. This posts that one notification itself, in Android's big-picture style,
// so it looks the same either way. Thin on purpose: which pushes come here, and what a tap does, is
// decided in TypeScript (contexts/notifications/foreground-picture.ts), where it is tested.
//
// A picture that cannot be fetched still leaves the notification, without it.
//
// Expo runs AsyncFunctions off the main thread.

package expo.modules.picturenotification

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.net.URL

private const val NOTIFICATION_ID = 1
private const val PICTURE_TIMEOUT_MS = 10_000
private const val ICON_META_DATA = "expo.modules.notifications.default_notification_icon"

class PictureNotification : Record {
  /** The delivery's id: a repeat of the same push replaces its notification. */
  @Field val id: String = ""
  @Field val title: String = ""
  @Field val body: String = ""
  @Field val imageUrl: String = ""
  @Field val channelId: String = ""
  /** The link a tap opens. */
  @Field val openUrl: String = ""
}

class PictureNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PictureNotification")

    AsyncFunction("show") { notification: PictureNotification ->
      val picture = fetchPicture(notification.imageUrl)
      val builder = NotificationCompat.Builder(context, notification.channelId)
        .setSmallIcon(smallIcon())
        .setContentTitle(notification.title)
        .setContentText(notification.body)
        .setAutoCancel(true)
        .setContentIntent(openIntent(notification))
      if (picture == null) {
        builder.setStyle(NotificationCompat.BigTextStyle().bigText(notification.body))
      } else {
        builder
          .setLargeIcon(picture)
          .setStyle(
            NotificationCompat.BigPictureStyle()
              .bigPicture(picture)
              .bigLargeIcon(null as Bitmap?)
              .setSummaryText(notification.body)
          )
      }
      if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
        NotificationManagerCompat.from(context).notify(notification.id, NOTIFICATION_ID, builder.build())
      }
    }
  }

  private fun fetchPicture(address: String): Bitmap? =
    runCatching {
      val connection = URL(address).openConnection()
      connection.connectTimeout = PICTURE_TIMEOUT_MS
      connection.readTimeout = PICTURE_TIMEOUT_MS
      connection.getInputStream().use(BitmapFactory::decodeStream)
    }.getOrNull()

  private fun smallIcon(): Int {
    val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    val configured = info.metaData?.getInt(ICON_META_DATA, 0) ?: 0
    return if (configured != 0) configured else info.icon
  }

  private fun openIntent(notification: PictureNotification): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(notification.openUrl)).setPackage(context.packageName)
    return PendingIntent.getActivity(
      context,
      notification.id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }
}
