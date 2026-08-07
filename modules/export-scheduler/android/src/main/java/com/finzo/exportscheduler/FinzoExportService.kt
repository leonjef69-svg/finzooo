package com.finzo.exportscheduler

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Despierta a Finzo lo justo para armar el reporte y guardarlo, sin abrirla.
 *
 * POR QUE HACE FALTA
 *
 * El despertador de Android sabe que son las 19:26, pero no sabe armar un
 * Excel ni subirlo a Dropbox: eso lo hace codigo de la app, escrito en el
 * lenguaje de la app y no en el de Android. Esto arranca ese lenguaje sin
 * pantalla, corre el trabajo y se apaga.
 *
 * Es el mismo mecanismo que ya usa el registro automatico de yapes
 * (FinzoCaptureService). Se copia el patron a proposito: es el que se sabe que
 * funciona en este celular.
 *
 * EL PDF TAMBIEN SE HACE AQUI (desde el 06/08/2026)
 *
 * Aqui decia que no se podia, y era verdad hasta esa fecha: el PDF se dibuja en
 * una ventana del navegador de Android y se creia que necesitaba la app en
 * pantalla. Ya no — se crea una ventana suelta y se imprime a un archivo. Ver
 * HtmlAPdf.
 *
 * Se corrige esta nota porque una nota vieja que dice "esto es imposible" es
 * peor que ninguna: manda a no intentarlo.
 *
 * SI ANDROID NO LO DESPIERTA, NO SE PIERDE NADA
 *
 * Cada fabricante aprieta el ahorro de bateria a su manera y puede negarse a
 * arrancar esto — los Honor y Xiaomi son de los mas duros. En ese caso queda
 * el comportamiento de siempre: el aviso a la hora fijada, y el reporte al
 * abrir la app. El peor caso es lo de antes, nunca un reporte perdido.
 */
class FinzoExportService : HeadlessJsTaskService() {

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig(
      // El mismo nombre que registra index.js. Si no coinciden, Android
      // arranca esto, no encuentra el trabajo y se cierra sin decir nada:
      // no falla, simplemente no pasa.
      TAREA,
      Arguments.createMap(),
      // Tope de tiempo generoso a proposito. Aqui no solo se hacen cuentas:
      // se sube un archivo por internet, y con mala senal eso tarda. Treinta
      // segundos —lo que usa el registro de yapes— cortaria la subida a
      // medias justo en el caso peor.
      120000,
      // true: correr TAMBIEN si la app esta abierta en pantalla.
      //
      // Al contrario que el registro de yapes, que pone false porque la app
      // ya lo hace ella al volver al frente. Aqui no: si la persona esta
      // usando Finzo a las 19:26, el reporte tiene que salir igual. Con false
      // se saltaria justo a quien tiene la app abierta a esa hora.
      true
    )
  }

  companion object {
    const val TAREA = "FinzoExport"
  }
}
