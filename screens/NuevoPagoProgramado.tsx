/**
 * AGREGAR O EDITAR UN PAGO DEL CALENDARIO (18/08/2026, rediseñado el 19)
 *
 * Aquí se cumple lo que pidió: *"pueda yo personalizar qué día y hora me avise para
 * pagarlo"*. El aviso es de **cada pago** y no un ajuste general.
 *
 * **EL REDISEÑO DEL 19/08, con sus palabras:** *"que el usuario tenga la menor interacción,
 * intuitiva, quitar el exceso de texto que no sirve, que el usuario pueda agregarle un icono
 * personalizado"*. De nueve bloques quedaron cinco:
 *
 * - **Fuera los seis títulos en mayúsculas.** El sitio y el dibujo ya dicen qué es cada campo.
 * - **Fuera las tres notas al pie**: la del día 31, la de la repetición y la del primer aviso.
 *   La del 31 sobra porque ahora se dice "el último día de cada mes", que es lo que es.
 * - **Monto y fecha van juntos**, y los días y la hora del aviso en un solo renglón.
 * - **El dibujo se pone SOLO al escribir el nombre** (`iconoSugerido`). En el caso normal,
 *   agregar un pago son cero toques de más; el lápiz está para cuando no acierta.
 *
 * La fecha llega hecha del calendario grande — aquí hubo uno propio y él lo mandó quitar:
 * *"cuando dije tocar libremente el calendario me refería a la segunda imagen"*.
 */
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, CalendarDays, Pencil, Repeat, Trash2, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { useAppData } from "@/contexts/AppDataContext";
import { TODOS_LOS_GRUPOS, iconoDe } from "@/constants/iconos";
import {
  iconoSugerido,
  mesDe,
  textoDeRepeticion,
  validarPago,
  type TipoDeAnotacion,
} from "@/utils/calendarioPagos";

/** El color con el que se pinta el dibujo, según el tipo. Los mismos tres de la otra pantalla. */
const TINTA: Record<TipoDeAnotacion, string> = {
  pago: "#d97706",
  ingreso: "#059669",
  recordatorio: "#64748b",
};

function soloNumeros(texto: string, tope: number): string {
  const limpio = texto.replace(/\D/g, "").slice(0, 2);
  if (limpio === "") return "";
  return String(Math.min(Number(limpio), tope));
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

export default function NuevoPagoProgramado({
  id,
  fecha,
  onBack,
}: {
  id?: string;
  /** "2026-08-14", el día que se tocó en el calendario grande. */
  fecha?: string;
  onBack: () => void;
}) {
  const { t, monthNames, pagosProgramados, guardarPagoProgramado, quitarPagoProgramado } =
    useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const oscuro = colorScheme === "dark";

  const existente = pagosProgramados.find((p) => p.id === id);
  const hoy = new Date();

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoDeAnotacion>(existente?.tipo ?? "pago");
  const [monto, setMonto] = useState(existente?.monto != null ? String(existente.monto) : "");
  /**
   * EL DIBUJO ELEGIDO A MANO, SI SE ELIGIÓ. `null` quiere decir *"el que decida el nombre"*.
   *
   * Guardar aquí el sugerido desde el principio rompería lo que hace agradable a esto: al
   * corregir el nombre —de "Luz" a "Luz del depa"— el dibujo se quedaría clavado en el
   * primero que salió. Con `null`, sigue al nombre hasta que alguien decide otra cosa.
   */
  const [iconoElegido, setIconoElegido] = useState<string | null>(existente?.icono ?? null);
  const [eligiendoIcono, setEligiendoIcono] = useState(false);

  const elegida = existente
    ? `${existente.mesUnico ?? mesDe(hoy)}-${dosDigitos(existente.dia)}`
    : (fecha ?? `${mesDe(hoy)}-${dosDigitos(hoy.getDate())}`);
  const mesVisible = elegida.slice(0, 7);
  const dia = Number(elegida.slice(8));
  const [repite, setRepite] = useState((existente?.repite ?? "mensual") === "mensual");

  const [diasAntes, setDiasAntes] = useState(String(existente?.avisoDiasAntes ?? 1));
  const [horaHH, setHoraHH] = useState((existente?.avisoHora ?? "09:00").split(":")[0]);
  const [horaMM, setHoraMM] = useState((existente?.avisoHora ?? "09:00").split(":")[1]);

  const esRecordatorio = tipo === "recordatorio";
  const icono = iconoElegido ?? iconoSugerido(nombre, tipo);
  const Dibujo = iconoDe(icono);
  const tinta = TINTA[tipo];
  const repeticion = textoDeRepeticion(dia, repite);
  const campo = oscuro ? "bg-slate-800" : "bg-slate-100";

  function guardar() {
    const montoNumero = esRecordatorio ? undefined : Number(monto.replace(",", "."));
    const check = validarPago(nombre, tipo, montoNumero, dia);
    if (!check.ok) {
      Alert.alert(t("calendario.nuevo.faltaTitulo"), t(`calendario.nuevo.falta.${check.motivo}`));
      return;
    }
    guardarPagoProgramado({
      id: existente?.id ?? `pago_${Date.now()}`,
      nombre: nombre.trim(),
      tipo,
      monto: montoNumero,
      dia,
      repite: repite ? "mensual" : "unica",
      mesUnico: repite ? undefined : mesVisible,
      // Se guarda el que se ve, sugerido o elegido: si se guardara solo el elegido, un pago
      // sin tocar el lápiz saldría en la lista con el dibujo de reserva y no con su rayo.
      icono,
      categoria: existente?.categoria,
      avisoDiasAntes: Number(diasAntes || 0),
      avisoHora: `${(horaHH || "0").padStart(2, "0")}:${(horaMM || "0").padStart(2, "0")}`,
      pagados: existente?.pagados ?? [],
      creado: existente?.creado ?? Date.now(),
    });
    onBack();
  }

  function borrar() {
    if (!existente) return;
    Alert.alert(
      t("calendario.nuevo.borrarTitulo", { nombre: existente.nombre }),
      t("calendario.nuevo.borrarTexto"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("calendario.nuevo.borrar"),
          style: "destructive",
          onPress: () => {
            quitarPagoProgramado(existente.id);
            onBack();
          },
        },
      ]
    );
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t(existente ? "calendario.nuevo.editar" : "calendario.nuevo.titulo")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row gap-2 mb-4">
          {(["pago", "ingreso", "recordatorio"] as TipoDeAnotacion[]).map((x) => (
            <TouchableOpacity
              key={x}
              onPress={() => setTipo(x)}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                tipo === x ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-100 dark:bg-slate-800"
              }`}
            >
              <Text
                className={`text-[13px] ${
                  tipo === x
                    ? "text-white dark:text-slate-900 font-bold"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {t(`calendario.tipo.${x}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* EL DIBUJO Y EL NOMBRE, EN LA MISMA FILA. El dibujo sale del nombre mientras se
            escribe; el lápiz solo hace falta cuando no acierta. */}
        <View className="flex-row items-center gap-3 mb-3">
          <TouchableOpacity
            onPress={() => setEligiendoIcono((v) => !v)}
            className="w-[52px] h-[52px] rounded-2xl items-center justify-center"
            style={{ backgroundColor: tinta + (oscuro ? "33" : "22") }}
          >
            <Dibujo size={26} color={tinta} strokeWidth={2.2} />
            <View className="absolute -bottom-1 -right-1 w-[21px] h-[21px] rounded-full items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <Pencil size={11} color="#64748b" />
            </View>
          </TouchableOpacity>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder={t("calendario.nuevo.nombreEjemplo")}
            placeholderTextColor="#94a3b8"
            className={`flex-1 h-[52px] rounded-2xl px-4 text-[16px] ${campo} text-slate-900 dark:text-slate-100`}
          />
        </View>

        {eligiendoIcono && (
          <View className="rounded-2xl p-3 mb-3 bg-slate-50 dark:bg-slate-800">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                {t("calendario.nuevo.elegirDibujo")}
              </Text>
              <TouchableOpacity onPress={() => setEligiendoIcono(false)} className="p-1">
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {/* Los mismos 236 dibujos de las categorías, no otros: dos catálogos distintos
                para lo mismo es uno que se queda atrás. Con alto máximo para que la lista de
                abajo no se pierda de vista mientras se elige. */}
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              <View className="flex-row flex-wrap">
                {TODOS_LOS_GRUPOS.flatMap((g) => g.iconos).map((x) => {
                  const D = iconoDe(x);
                  const puesto = x === icono;
                  return (
                    <TouchableOpacity
                      key={x}
                      onPress={() => {
                        setIconoElegido(x);
                        setEligiendoIcono(false);
                      }}
                      style={{ width: "20%", aspectRatio: 1 }}
                      className="items-center justify-center p-1"
                    >
                      <View
                        className="w-full h-full rounded-xl items-center justify-center"
                        style={{ backgroundColor: puesto ? tinta : "transparent" }}
                      >
                        <D size={22} color={puesto ? "#ffffff" : "#64748b"} strokeWidth={2} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        <View className="flex-row gap-2.5 mb-3">
          {!esRecordatorio && (
            <View className={`flex-1 h-[50px] rounded-2xl px-4 flex-row items-center ${campo}`}>
              <Text className="text-[13px] text-slate-400 mr-1.5">S/</Text>
              <TextInput
                value={monto}
                onChangeText={setMonto}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                className="flex-1 text-[16px] text-slate-900 dark:text-slate-100"
              />
            </View>
          )}
          <View
            className={`h-[50px] rounded-2xl px-4 flex-row items-center gap-2 ${campo} ${
              esRecordatorio ? "flex-1" : "flex-[1.15]"
            }`}
          >
            <CalendarDays size={16} color="#64748b" />
            <Text className="text-[15px] text-slate-900 dark:text-slate-100">
              {t("calendario.nuevo.fechaCorta", {
                dia,
                mes: monthNames[Number(mesVisible.split("-")[1]) - 1],
              })}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2.5 py-3.5 border-t-[1.5px] border-slate-100 dark:border-slate-800">
          <Repeat size={17} color="#64748b" />
          <Text className="flex-1 text-[14px] text-slate-900 dark:text-slate-100">
            {t(repeticion.clave, {
              dia: repeticion.dia ?? dia,
              mes: monthNames[Number(mesVisible.split("-")[1]) - 1],
            })}
          </Text>
          <Toggle on={repite} onChange={setRepite} />
        </View>

        <View className="flex-row items-center gap-2.5 py-3.5 border-t-[1.5px] border-b-[1.5px] border-slate-100 dark:border-slate-800 mb-5">
          <Bell size={17} color="#64748b" />
          <Text className="flex-1 text-[14px] text-slate-900 dark:text-slate-100">
            {t("calendario.nuevo.avisarme")}
          </Text>
          <View className={`flex-row items-center rounded-xl px-2 ${campo}`}>
            <TextInput
              value={diasAntes}
              onChangeText={(v) => setDiasAntes(soloNumeros(v, 30))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="w-7 py-2 text-[14px] text-center text-slate-900 dark:text-slate-100"
            />
            <Text className="text-[12px] text-slate-500 dark:text-slate-400 pr-1">
              {t("calendario.nuevo.diasCorto")}
            </Text>
          </View>
          <View className={`flex-row items-center rounded-xl px-2 ${campo}`}>
            <TextInput
              value={horaHH}
              onChangeText={(v) => setHoraHH(soloNumeros(v, 23))}
              keyboardType="number-pad"
              className="w-6 py-2 text-[14px] text-center text-slate-900 dark:text-slate-100"
            />
            <Text className="text-[14px] text-slate-400">:</Text>
            <TextInput
              value={horaMM}
              onChangeText={(v) => setHoraMM(soloNumeros(v, 59))}
              keyboardType="number-pad"
              className="w-6 py-2 text-[14px] text-center text-slate-900 dark:text-slate-100"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={guardar}
          className="h-[50px] rounded-2xl items-center justify-center bg-emerald-600"
        >
          <Text className="text-[15px] font-bold text-white">{t("calendario.nuevo.guardar")}</Text>
        </TouchableOpacity>

        {existente && (
          <TouchableOpacity
            onPress={borrar}
            className="flex-row items-center justify-center gap-2 py-3.5 mt-2"
          >
            <Trash2 size={15} color="#e11d48" />
            <Text className="text-[13px] font-bold text-rose-600">
              {t("calendario.nuevo.borrar")}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
