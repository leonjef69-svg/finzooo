package com.finzo.sharetoapp

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Manda un archivo a UNA aplicación concreta, sin pasar por el menú de
 * compartir de Android.
 *
 * Por qué hace falta código nativo para esto:
 *
 * El menú de compartir lo arma Android y qué apps salen ahí cambia de un
 * celular a otro. Y "Correo" abre la app de correo que esté puesta por
 * defecto — que en un Honor suele ser la del fabricante, no Gmail. Quien
 * quiere Gmail y tiene las dos instaladas no tenía forma de llegar a Gmail.
 *
 * Desde JavaScript no se puede resolver: ni expo-sharing ni
 * expo-mail-composer dejan apuntar a una app concreta. Se puede construir a
 * mano un enlace "intent:" con el paquete dentro, pero un archivo mandado así
 * llega sin permiso de lectura y Gmail lo rechaza como adjunto roto. El
 * permiso solo se puede conceder desde el intent de verdad, que es esto.
 */
class ShareToAppModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareToApp")

    // Se pregunta antes de ofrecer el botón. Ofrecer "Enviar por Gmail" a
    // quien no tiene Gmail es un botón que solo puede decepcionar.
    Function("isAppInstalled") { packageName: String ->
      val ctx = appContext.reactContext ?: return@Function false
      try {
        ctx.packageManager.getPackageInfo(packageName, 0)
        true
      } catch (e: Exception) {
        false
      }
    }

    Function("shareToPackage") { fileUri: String, mimeType: String, packageName: String, subject: String, text: String, recipient: String ->
      val activity = appContext.currentActivity ?: return@Function false
      val ctx = appContext.reactContext ?: return@Function false

      val path = Uri.parse(fileUri).path ?: return@Function false
      val file = File(path)
      if (!file.exists()) return@Function false

      val content = try {
        FileProvider.getUriForFile(ctx, "${ctx.packageName}.ShareToAppProvider", file)
      } catch (e: Exception) {
        // Pasa si el archivo cae fuera de las carpetas que declara
        // share_to_app_paths.xml. Mejor devolver false y que la pantalla
        // ofrezca el menú de compartir normal, que reventar.
        return@Function false
      }

      val intent = Intent(Intent.ACTION_SEND).apply {
        setPackage(packageName)
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, content)
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, text)
        // Esta línea es la que hace que el adjunto se pueda abrir. Sin ella
        // Gmail recibe la dirección del archivo pero no el permiso de leerlo,
        // y el correo sale con un adjunto vacío.
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        // A QUIÉN. Cada app lo pide a su manera.
        if (recipient.isNotBlank()) {
          if (packageName.startsWith("com.whatsapp")) {
            // WhatsApp abre el chat de un contacto concreto con este extra.
            // El número tiene que ir con código de país y SOLO dígitos: con
            // un "+" o un espacio dentro no encuentra a nadie y abre el
            // selector de contactos como si no se hubiera pedido nada.
            putExtra("jid", "$recipient@s.whatsapp.net")
          } else {
            // Gmail y cualquier app de correo entienden este.
            putExtra(Intent.EXTRA_EMAIL, arrayOf(recipient))
          }
        }
      }

      try {
        activity.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
