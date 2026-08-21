/**
 * LOS AVISOS DEL CALENDARIO, EN SU PROPIA PANTALLA (19/08/2026)
 *
 * Esto vivía como un panel que se abría encima del calendario, y él lo cortó en seco: *"el
 * engranaje se ve horrible, me sale prácticamente toda la pantalla principal del calendario"*.
 * Tenía razón — eran cuatro cosas de mirar una vez tapando lo que se usa a diario.
 *
 * Aquí dentro está lo que separa *"no me llegó nada"* de sus cuatro causas, que desde fuera
 * se ven iguales: cuántos avisos hay puestos de verdad, el botón para probarlo en diez
 * segundos, el sonido, y el motivo exacto si algo falló al programarlos.
 */
import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronRight, Volume2 } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { useAppData } from "@/contexts/AppDataContext";
import {
  abrirAjustesDelSonido,
  avisosEncendidos,
  guardarAvisosEncendidos,
  probarAviso,
  type ResultadoDeLaPrueba,
} from "@/utils/avisosDePagos";

export default function AvisosDelCalendario({ onBack }: { onBack: () => void }) {
  const { t, avisosProgramados, avisosFallo, reprogramarAvisos } = useAppData();
  const [encendidos, setEncendidos] = useState(true);
  useEffect(() => {
    avisosEncendidos().then(setEncendidos);
  }, []);
  const insets = useSafeAreaInsets();
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDeLaPrueba | null>(null);
  const [noSeAbrio, setNoSeAbrio] = useState(false);

  return (
    <View
      className="flex-1 bg-white dark:bg-noche"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t("calendario.avisos.titulo")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* EL INTERRUPTOR GENERAL, QUE ESTABA EN OTRA PANTALLA (21/08/2026).
            Vivia en Ajustes, bajo el nombre "Notificaciones", mientras TODO lo demas de estos
            avisos —probarlos, el sonido, cuantos hay puestos— estaba aqui. Para manejar una
            sola cosa habia que ir a dos sitios.

            Y el nombre engañaba: la app tiene cuatro cosas que avisan —el calendario, la voz
            de los yapes, la exportacion automatica y las metas— cada una con su interruptor.
            Uno que dice "Notificaciones" en Ajustes parece mandar sobre las cuatro, y solo
            mandaba sobre esta. Idea suya: *"¿no seria mejor implementarlo dentro de calendario
            de pagos, tipo registro automatico?"*. */}
        <View className="rounded-2xl p-4 mb-4 flex-row items-center gap-3 bg-slate-50 dark:bg-noche-2">
          <Bell size={19} color={encendidos ? "#059669" : "#94a3b8"} />
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
              {t("calendario.avisos.interruptor")}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t(encendidos ? "calendario.avisos.encendidos" : "calendario.avisos.apagados")}
            </Text>
          </View>
          <Toggle
            on={encendidos}
            onChange={(v) => {
              setEncendidos(v);
              guardarAvisosEncendidos(v);
              // Se reprograma en el acto: apagar tiene que callar los avisos AHORA, no la
              // proxima vez que se toque un pago.
              reprogramarAvisos();
            }}
          />
        </View>

        <View className="rounded-2xl p-4 mb-4 bg-slate-50 dark:bg-noche-2">
          <Text className="text-[15px] text-slate-900 dark:text-slate-100">
            {avisosProgramados == null
              ? t("calendario.avisos.calculando")
              : t(avisosProgramados === 0 ? "calendario.sinAvisos" : "calendario.avisosPuestos", {
                  n: avisosProgramados,
                })}
          </Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {t("calendario.avisos.tresMeses")}
          </Text>
          {/* EL MOTIVO DEL FALLO, SELECCIONABLE PARA COPIARLO. Sin él, "ningún aviso" no dice
              si fue el permiso, el canal o el programado en sí, y cada intento cuesta un día. */}
          {avisosFallo != null && (
            <Text selectable className="text-[10px] leading-4 text-rose-500 mt-2">
              {avisosFallo}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={async () => {
            setProbando(true);
            setResultado(await probarAviso(t));
            setProbando(false);
          }}
          disabled={probando}
          className="flex-row items-center gap-3 py-4 border-t-[1.5px] border-slate-100 dark:border-noche-borde"
        >
          <Bell size={18} color="#64748b" />
          <Text className="flex-1 text-[14px] text-slate-900 dark:text-slate-100">
            {t(probando ? "calendario.probando" : "calendario.probar")}
          </Text>
          <ChevronRight size={17} color="#cbd5e1" />
        </TouchableOpacity>
        {resultado != null && (
          <Text
            className={`text-[12px] leading-5 mb-1 ${
              resultado === "listo" ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {t(`calendario.prueba.${resultado}`)}
          </Text>
        )}

        <TouchableOpacity
          onPress={async () => setNoSeAbrio(!(await abrirAjustesDelSonido()))}
          className="flex-row items-center gap-3 py-4 border-t-[1.5px] border-b-[1.5px] border-slate-100 dark:border-noche-borde"
        >
          <Volume2 size={18} color="#64748b" />
          <Text className="flex-1 text-[14px] text-slate-900 dark:text-slate-100">
            {t("calendario.elegirSonido")}
          </Text>
          <ChevronRight size={17} color="#cbd5e1" />
        </TouchableOpacity>
        {noSeAbrio && (
          <Text className="text-[12px] leading-5 text-amber-600 mt-2">
            {t("calendario.sonidoNoSeAbrio")}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
