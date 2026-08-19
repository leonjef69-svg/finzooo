/**
 * AGREGAR O EDITAR UN PAGO DEL CALENDARIO (18/08/2026)
 *
 * Es donde se cumple lo que pidió: *"pueda yo personalizar qué día y hora me avise para
 * pagarlo"*. Por eso el aviso —cuántos días antes y a qué hora— es de **cada pago** y no un
 * ajuste general: el recibo de la luz y el sueldo no se avisan igual.
 */
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import { useAppData } from "@/contexts/AppDataContext";
import {
  validarPago,
  type PagoProgramado,
  type TipoDeAnotacion,
} from "@/utils/calendarioPagos";

/**
 * DÍA Y HORA A MANO, Y NO UNA LISTA DE OPCIONES (18/08/2026)
 *
 * La primera versión ofrecía seis antelaciones y seis horas en botones. Él las rodeó en la
 * captura y dijo: *"lo encerrado en azul quítalo y pon para personalizar la hora y fecha"*.
 * Tenía razón: doce botones ocupaban media pantalla para acabar sin poder poner las 6:30.
 *
 * **No se usa el selector de Android** porque eso es `@react-native-community/datetimepicker`,
 * que es código nativo: obligaría a un APK nuevo para una pantalla que si no viaja por
 * internet. Con dos campos se escribe cualquier hora y se entrega hoy.
 */
function soloNumeros(texto: string, tope: number): string {
  const limpio = texto.replace(/\D/g, "").slice(0, 2);
  if (limpio === "") return "";
  return String(Math.min(Number(limpio), tope));
}

export default function NuevoPagoProgramado({
  id,
  onBack,
}: {
  id?: string;
  onBack: () => void;
}) {
  const { t, pagosProgramados, guardarPagoProgramado, quitarPagoProgramado } = useAppData();
  const insets = useSafeAreaInsets();

  const existente = pagosProgramados.find((p) => p.id === id);

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoDeAnotacion>(existente?.tipo ?? "pago");
  /**
   * EL MONTO SE TECLEA COMO TEXTO Y SE CONVIERTE UNA SOLA VEZ, AL GUARDAR.
   *
   * Como número, escribir "12." daría saltos bajo el dedo. Y **la coma vale como el punto**,
   * porque en Perú se escribe "12,50" tanto como "12.50". Es la misma decisión que ya se tomó
   * en el precio de un producto y en el monto del negocio.
   */
  const [monto, setMonto] = useState(existente?.monto != null ? String(existente.monto) : "");
  const [dia, setDia] = useState(String(existente?.dia ?? ""));
  // Como texto, por lo mismo que el monto: escribir "1" y borrarlo no puede dejar un NaN
  // debajo del dedo. Se convierten una sola vez, al guardar.
  const [diasAntes, setDiasAntes] = useState(String(existente?.avisoDiasAntes ?? 1));
  const [horaHH, setHoraHH] = useState((existente?.avisoHora ?? "09:00").split(":")[0]);
  const [horaMM, setHoraMM] = useState((existente?.avisoHora ?? "09:00").split(":")[1]);

  const esRecordatorio = tipo === "recordatorio";

  function guardar() {
    const montoNumero = esRecordatorio ? undefined : Number(monto.replace(",", "."));
    const diaNumero = Number(dia);
    const check = validarPago(nombre, tipo, montoNumero, diaNumero);
    if (!check.ok) {
      Alert.alert(t("calendario.nuevo.faltaTitulo"), t(`calendario.nuevo.falta.${check.motivo}`));
      return;
    }
    const pago: PagoProgramado = {
      id: existente?.id ?? `pago_${Date.now()}`,
      nombre: nombre.trim(),
      tipo,
      monto: montoNumero,
      dia: diaNumero,
      repite: "mensual",
      categoria: existente?.categoria,
      avisoDiasAntes: Number(diasAntes || 0),
      // Siempre "HH:MM" con dos dígitos: `cuandoAvisar` lo parte por los dos puntos y un
      // "9:0" daría una hora válida por casualidad, pero la pantalla enseñaría "9:0".
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
        <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          {t("calendario.nuevo.queEs")}
        </Text>
        <View className="flex-row gap-2 mb-5">
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

        <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          {t("calendario.nuevo.nombre")}
        </Text>
        <TextInput
          value={nombre}
          onChangeText={setNombre}
          placeholder={t("calendario.nuevo.nombreEjemplo")}
          placeholderTextColor="#94a3b8"
          className="rounded-xl px-4 py-3 mb-5 text-[15px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        />

        {/* Un recordatorio NO lleva monto: si lo llevara sería un pago, y la diferencia
            entre los dos es justo que uno toca las cuentas y el otro no. */}
        {!esRecordatorio && (
          <>
            <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
              {t("calendario.nuevo.monto")}
            </Text>
            <TextInput
              value={monto}
              onChangeText={setMonto}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              className="rounded-xl px-4 py-3 mb-5 text-[15px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </>
        )}

        <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          {t("calendario.nuevo.dia")}
        </Text>
        <TextInput
          value={dia}
          onChangeText={setDia}
          keyboardType="number-pad"
          placeholder="15"
          placeholderTextColor="#94a3b8"
          className="rounded-xl px-4 py-3 text-[15px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        />
        <Text className="text-[10px] leading-4 text-slate-400 mt-1.5 mb-5">
          {t("calendario.nuevo.diaNota")}
        </Text>

        <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          {t("calendario.nuevo.avisarme")}
        </Text>
        <View className="flex-row items-center gap-2 mb-3">
          <TextInput
            value={diasAntes}
            onChangeText={(v) => setDiasAntes(soloNumeros(v, 30))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            className="w-16 rounded-xl px-3 py-3 text-[15px] text-center bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
          <Text className="text-[13px] text-slate-600 dark:text-slate-300 flex-1">
            {t("calendario.nuevo.diasAntesTexto")}
          </Text>
        </View>

        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-[13px] text-slate-600 dark:text-slate-300">
            {t("calendario.nuevo.aLas")}
          </Text>
          <TextInput
            value={horaHH}
            onChangeText={(v) => setHoraHH(soloNumeros(v, 23))}
            keyboardType="number-pad"
            placeholder="09"
            placeholderTextColor="#94a3b8"
            className="w-14 rounded-xl px-2 py-3 text-[15px] text-center bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
          <Text className="text-[15px] text-slate-400">:</Text>
          <TextInput
            value={horaMM}
            onChangeText={(v) => setHoraMM(soloNumeros(v, 59))}
            keyboardType="number-pad"
            placeholder="00"
            placeholderTextColor="#94a3b8"
            className="w-14 rounded-xl px-2 py-3 text-[15px] text-center bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </View>
        {/* QUÉ VA A PASAR, EN UNA FRASE, ANTES DE GUARDAR. Dos campos sueltos no dicen si el
            aviso cae el día 13 o el 17; esta línea lo dice con el día ya calculado, que es lo
            único que la persona quiere comprobar. */}
        <Text className="text-[11px] leading-4 text-slate-400 mb-6">
          {t("calendario.nuevo.resumenAviso", {
            cuando:
              Number(diasAntes || 0) === 0
                ? t("calendario.nuevo.mismoDia").toLowerCase()
                : t("calendario.nuevo.diasAntes", { n: Number(diasAntes) }),
            hora: `${(horaHH || "0").padStart(2, "0")}:${(horaMM || "0").padStart(2, "0")}`,
          })}
        </Text>

        <TouchableOpacity onPress={guardar} className="py-3.5 rounded-xl items-center bg-emerald-600">
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
