/**
 * AGREGAR O EDITAR UN PAGO DEL CALENDARIO (18/08/2026)
 *
 * Aquí se cumple lo que pidió: *"pueda yo personalizar qué día y hora me avise para
 * pagarlo"*. El aviso es de **cada pago** y no un ajuste general: el recibo de la luz y el
 * sueldo no se avisan igual.
 *
 * **LA FECHA SE ELIGE TOCÁNDOLA EN UN CALENDARIO, Y NO HAY "QUÉ DÍA DEL MES".** Lo preguntó
 * él y tenía razón: *"si puedo escoger libremente en el calendario cualquier fecha, ¿sería
 * necesario que esté la opción qué día de mes?"*. No lo era — eran dos campos para decir lo
 * mismo, y quien llenara uno se quedaba dudando del otro. Ahora se toca un día y ya está; si
 * el pago se repite, ese día es el de todos los meses.
 *
 * No se usa el selector de Android porque es `@react-native-community/datetimepicker`, que
 * es código nativo: obligaría a un APK nuevo para una pantalla que así viaja por internet.
 */
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Repeat, Trash2 } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { useAppData } from "@/contexts/AppDataContext";
import {
  mesDe,
  mesSiguiente,
  validarPago,
  type PagoProgramado,
  type TipoDeAnotacion,
} from "@/utils/calendarioPagos";

/** Deja solo dígitos y no deja pasarse del tope. Para los días y la hora. */
function soloNumeros(texto: string, tope: number): string {
  const limpio = texto.replace(/\D/g, "").slice(0, 2);
  if (limpio === "") return "";
  return String(Math.min(Number(limpio), tope));
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

function mesAnterior(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${dosDigitos(m - 1)}`;
}

export default function NuevoPagoProgramado({
  id,
  onBack,
}: {
  id?: string;
  onBack: () => void;
}) {
  const { t, monthNames, pagosProgramados, guardarPagoProgramado, quitarPagoProgramado } =
    useAppData();
  const insets = useSafeAreaInsets();

  const existente = pagosProgramados.find((p) => p.id === id);
  const hoy = new Date();

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoDeAnotacion>(existente?.tipo ?? "pago");
  /**
   * El monto se teclea como TEXTO y se convierte una sola vez, al guardar. Como número,
   * escribir "12." daría saltos bajo el dedo. Y la coma vale como el punto, porque en Perú se
   * escribe "12,50" tanto como "12.50". Misma decisión que en el precio de un producto.
   */
  const [monto, setMonto] = useState(existente?.monto != null ? String(existente.monto) : "");

  // El mes que se está mirando en el calendario de abajo, y el día elegido.
  const [mesVisible, setMesVisible] = useState(
    () => existente?.mesUnico ?? mesDe(hoy)
  );
  const [dia, setDia] = useState<number | null>(existente?.dia ?? null);
  const [repite, setRepite] = useState((existente?.repite ?? "mensual") === "mensual");

  const [diasAntes, setDiasAntes] = useState(String(existente?.avisoDiasAntes ?? 1));
  const [horaHH, setHoraHH] = useState((existente?.avisoHora ?? "09:00").split(":")[0]);
  const [horaMM, setHoraMM] = useState((existente?.avisoHora ?? "09:00").split(":")[1]);

  const esRecordatorio = tipo === "recordatorio";
  const [anioVisible, numeroMesVisible] = mesVisible.split("-").map(Number);
  const diasEnElMes = new Date(anioVisible, numeroMesVisible, 0).getDate();
  const primerDia = (new Date(anioVisible, numeroMesVisible - 1, 1).getDay() + 6) % 7;

  function guardar() {
    const montoNumero = esRecordatorio ? undefined : Number(monto.replace(",", "."));
    const check = validarPago(nombre, tipo, montoNumero, dia ?? 0);
    if (!check.ok) {
      Alert.alert(t("calendario.nuevo.faltaTitulo"), t(`calendario.nuevo.falta.${check.motivo}`));
      return;
    }
    const pago: PagoProgramado = {
      id: existente?.id ?? `pago_${Date.now()}`,
      nombre: nombre.trim(),
      tipo,
      monto: montoNumero,
      dia: dia as number,
      repite: repite ? "mensual" : "unica",
      // Solo tiene sentido cuando NO se repite. Guardándolo siempre, apagar y volver a
      // encender la repetición dejaría un mes pegado que nadie puede ver ni cambiar.
      mesUnico: repite ? undefined : mesVisible,
      categoria: existente?.categoria,
      avisoDiasAntes: Number(diasAntes || 0),
      // Siempre "HH:MM" con dos dígitos: `cuandoAvisar` lo parte por los dos puntos, y un
      // "9:0" daría una hora válida por casualidad pero la pantalla enseñaría "9:0".
      avisoHora: `${(horaHH || "0").padStart(2, "0")}:${(horaMM || "0").padStart(2, "0")}`,
      // Al editar se conservan los meses ya pagados. Perderlos volvería a poner en rojo
      // recibos que la persona ya pagó, solo por haberle cambiado el nombre.
      pagados: existente?.pagados ?? [],
      creado: existente?.creado ?? Date.now(),
    };
    guardarPagoProgramado(pago);
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
        <Etiqueta texto={t("calendario.nuevo.queEs")} />
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
                className={`text-[12px] font-bold ${
                  tipo === x ? "text-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {t(`calendario.tipo.${x}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Etiqueta texto={t("calendario.nuevo.nombre")} />
        <TextInput
          value={nombre}
          onChangeText={setNombre}
          placeholder={t("calendario.nuevo.nombreEjemplo")}
          placeholderTextColor="#94a3b8"
          className="rounded-xl px-4 h-12 mb-4 text-[15px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        />

        {/* Un recordatorio NO lleva monto: si lo llevara sería un pago, y la diferencia entre
            los dos es justo que uno toca las cuentas y el otro no. */}
        {!esRecordatorio && (
          <>
            <Etiqueta texto={t("calendario.nuevo.monto")} />
            <TextInput
              value={monto}
              onChangeText={setMonto}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              className="rounded-xl px-4 h-12 mb-4 text-[15px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </>
        )}

        {/* LA FECHA, TOCÁNDOLA. Es lo que pidió con la captura de un campo de fecha: se ve
            la fecha entera, no un número suelto que hay que traducir mentalmente. */}
        <Etiqueta texto={t("calendario.nuevo.fecha")} Icono={CalendarDays} />
        <View className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 pt-2.5 pb-3 mb-3">
          <View className="flex-row items-center justify-between mb-1.5">
            <TouchableOpacity onPress={() => setMesVisible(mesAnterior(mesVisible))} className="p-1.5">
              <ChevronLeft size={17} color="#94a3b8" />
            </TouchableOpacity>
            <Text className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
              {monthNames[numeroMesVisible - 1]} {anioVisible}
            </Text>
            <TouchableOpacity onPress={() => setMesVisible(mesSiguiente(mesVisible))} className="p-1.5">
              <ChevronRight size={17} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View className="flex-row mb-1">
            {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
              <Text key={i} className="flex-1 text-[10px] text-center text-slate-400">
                {d}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {Array.from({ length: primerDia }).map((_, i) => (
              <View key={`h${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
            ))}
            {Array.from({ length: diasEnElMes }).map((_, i) => {
              const d = i + 1;
              const elegido = dia === d;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDia(d)}
                  style={{ width: `${100 / 7}%`, aspectRatio: 1 }}
                  className="items-center justify-center p-0.5"
                >
                  <View
                    className={`w-full h-full rounded-full items-center justify-center ${
                      elegido ? "bg-emerald-600" : ""
                    }`}
                  >
                    <Text
                      className={`text-[12px] ${
                        elegido ? "text-white font-bold" : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {d}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="flex-row items-center gap-3 mb-1">
          <Repeat size={16} color="#94a3b8" />
          <Text className="flex-1 text-[13px] text-slate-700 dark:text-slate-200">
            {t("calendario.nuevo.repite")}
          </Text>
          <Toggle on={repite} onChange={setRepite} />
        </View>
        <Text className="text-[11px] leading-4 text-slate-400 mb-5">
          {dia == null
            ? t("calendario.nuevo.eligeDia")
            : repite
              ? t("calendario.nuevo.repiteHint", { dia })
              : t("calendario.nuevo.unaVezHint", {
                  dia,
                  mes: monthNames[numeroMesVisible - 1],
                })}
        </Text>

        <Etiqueta texto={t("calendario.nuevo.avisarme")} Icono={Clock} />
        <View className="flex-row items-center gap-2.5 mb-2.5">
          <TextInput
            value={diasAntes}
            onChangeText={(v) => setDiasAntes(soloNumeros(v, 30))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            className="w-14 h-12 rounded-xl text-[15px] text-center bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
          <Text className="flex-1 text-[13px] text-slate-600 dark:text-slate-300">
            {t("calendario.nuevo.diasAntesTexto")}
          </Text>
        </View>

        <View className="flex-row items-center gap-2.5 mb-2">
          <View className="flex-row items-center">
            <TextInput
              value={horaHH}
              onChangeText={(v) => setHoraHH(soloNumeros(v, 23))}
              keyboardType="number-pad"
              placeholder="09"
              placeholderTextColor="#94a3b8"
              className="w-14 h-12 rounded-xl text-[15px] text-center bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            <Text className="text-[15px] text-slate-400 px-1.5">:</Text>
            <TextInput
              value={horaMM}
              onChangeText={(v) => setHoraMM(soloNumeros(v, 59))}
              keyboardType="number-pad"
              placeholder="00"
              placeholderTextColor="#94a3b8"
              className="w-14 h-12 rounded-xl text-[15px] text-center bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </View>
          <Text className="flex-1 text-[13px] text-slate-600 dark:text-slate-300">
            {t("calendario.nuevo.aLasTexto")}
          </Text>
        </View>
        {/* QUÉ VA A PASAR, EN UNA FRASE. Dos campos sueltos no dicen si el aviso cae el 13 o
            el 17; esta línea lo dice ya calculado, que es lo único que se quiere comprobar. */}
        <Text className="text-[11px] leading-4 text-slate-400 mb-6">
          {t("calendario.nuevo.resumenAviso", {
            cuando:
              Number(diasAntes || 0) === 0
                ? t("calendario.nuevo.mismoDia").toLowerCase()
                : t("calendario.nuevo.diasAntes", { n: Number(diasAntes) }),
            hora: `${(horaHH || "0").padStart(2, "0")}:${(horaMM || "0").padStart(2, "0")}`,
          })}
        </Text>

        <TouchableOpacity onPress={guardar} className="h-12 rounded-xl items-center justify-center bg-emerald-600">
          <Text className="text-[14px] font-bold text-white">{t("calendario.nuevo.guardar")}</Text>
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

/** El título de cada bloque, con su dibujo cuando lo tiene. Uno solo para que los seis midan
 *  y separen igual: escritos a mano, cada uno acababa con su propio margen. */
function Etiqueta({
  texto,
  Icono,
}: {
  texto: string;
  Icono?: React.ComponentType<{ size: number; color: string }>;
}) {
  return (
    <View className="flex-row items-center gap-1.5 mb-2">
      {Icono && <Icono size={13} color="#94a3b8" />}
      <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{texto}</Text>
    </View>
  );
}
