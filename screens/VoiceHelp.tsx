import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

/**
 * Qué se le puede decir al micrófono.
 *
 * POR QUÉ EN FORMA DE CONVERSACIÓN
 *
 * El micrófono entiende bastante —anotar, preguntar, comparar, exportar— y
 * nada de eso se ve. Una lista de funciones no ayuda: hay que traducirla a
 * una frase antes de poder decirla, y ahí es donde se abandona.
 *
 * Aquí cada bloque enseña LA FRASE, tal como se dice, y debajo lo que pasa al
 * decirla. Se lee y se repite en voz alta sin traducir nada.
 *
 * Las frases van en la lista de textos como todo lo demás, porque en inglés y
 * en portugués no son la traducción literal: en cada idioma se dice de otra
 * forma, y una frase traducida palabra por palabra no la entendería el
 * reconocedor.
 */

/** Un grupo de órdenes: el título y las claves de sus ejemplos. */
const GRUPOS: { titulo: string; ejemplos: { dice: string; hace: string }[] }[] = [
  {
    titulo: "voiceHelp.groupAdd",
    ejemplos: [
      { dice: "voiceHelp.addSay1", hace: "voiceHelp.addDo1" },
      { dice: "voiceHelp.addSay2", hace: "voiceHelp.addDo2" },
      { dice: "voiceHelp.addSay3", hace: "voiceHelp.addDo3" },
      { dice: "voiceHelp.addSay4", hace: "voiceHelp.addDo4" },
    ],
  },
  {
    titulo: "voiceHelp.groupAsk",
    ejemplos: [
      { dice: "voiceHelp.askSay1", hace: "voiceHelp.askDo1" },
      { dice: "voiceHelp.askSay2", hace: "voiceHelp.askDo2" },
      { dice: "voiceHelp.askSay3", hace: "voiceHelp.askDo3" },
      { dice: "voiceHelp.askSay4", hace: "voiceHelp.askDo4" },
      { dice: "voiceHelp.askSay5", hace: "voiceHelp.askDo5" },
      { dice: "voiceHelp.askSay6", hace: "voiceHelp.askDo6" },
      { dice: "voiceHelp.askSay7", hace: "voiceHelp.askDo7" },
    ],
  },
  {
    titulo: "voiceHelp.groupExport",
    ejemplos: [
      { dice: "voiceHelp.expSay1", hace: "voiceHelp.expDo1" },
      { dice: "voiceHelp.expSay2", hace: "voiceHelp.expDo2" },
      { dice: "voiceHelp.expSay3", hace: "voiceHelp.expDo3" },
      { dice: "voiceHelp.expSay4", hace: "voiceHelp.expDo4" },
    ],
  },
];

/** Las piezas que se pueden decir en una orden de exportar, y sus palabras. */
const PIEZAS: { nombre: string; valores: string }[] = [
  { nombre: "voiceHelp.pieceMonth", valores: "voiceHelp.pieceMonthValues" },
  { nombre: "voiceHelp.pieceFormat", valores: "voiceHelp.pieceFormatValues" },
  { nombre: "voiceHelp.pieceWhere", valores: "voiceHelp.pieceWhereValues" },
  { nombre: "voiceHelp.pieceWhat", valores: "voiceHelp.pieceWhatValues" },
  { nombre: "voiceHelp.pieceCharts", valores: "voiceHelp.pieceChartsValues" },
  { nombre: "voiceHelp.pieceWho", valores: "voiceHelp.pieceWhoValues" },
];

export default function VoiceHelp({ onBack }: { onBack: () => void }) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t("voiceHelp.title")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="px-5">
        <Text className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
          {t("voiceHelp.intro")}
        </Text>

        {GRUPOS.map((grupo) => (
          <View key={grupo.titulo} className="mb-6">
            <Text className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2.5">
              {t(grupo.titulo)}
            </Text>

            {grupo.ejemplos.map((ej) => (
              <View key={ej.dice} className="mb-3">
                {/* LO QUE DICES: burbuja verde a la derecha, como el mensaje
                    propio de un chat. Se lee y se repite en voz alta tal
                    cual, sin tener que traducir nada. */}
                <View className="flex-row justify-end">
                  <View className="max-w-[85%] bg-emerald-600 rounded-2xl rounded-br-md px-3.5 py-2.5 flex-row items-center gap-2">
                    <Mic size={12} color="#ffffff" strokeWidth={2.6} />
                    <Text className="text-xs font-bold text-white flex-shrink">{t(ej.dice)}</Text>
                  </View>
                </View>

                {/* LO QUE HACE: burbuja gris a la izquierda, la respuesta. */}
                <View className="flex-row justify-start mt-1.5">
                  <View className="max-w-[85%] bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                    <Text className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t(ej.hace)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* LAS PIEZAS SUELTAS.
            Los ejemplos de arriba enseñan frases enteras; esto enseña que se
            pueden mezclar. Sin verlo, se repiten los ejemplos tal cual y no
            se descubre que se puede pedir otra cosa. */}
        <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4 mb-5">
          <Text className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
            {t("voiceHelp.piecesTitle")}
          </Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            {t("voiceHelp.piecesIntro")}
          </Text>
          {PIEZAS.map((p) => (
            <View key={p.nombre} className="flex-row mb-2">
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300 w-[86px]">
                {t(p.nombre)}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 flex-1 leading-relaxed">
                {t(p.valores)}
              </Text>
            </View>
          ))}
        </View>

        <View className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-[1.5px] border-amber-200 dark:border-amber-800 p-4">
          <Text className="text-xs font-extrabold text-amber-700 dark:text-amber-300 mb-1">
            {t("voiceHelp.tipsTitle")}
          </Text>
          <Text className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
            {t("voiceHelp.tip1")}
          </Text>
          <Text className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed mt-1.5">
            {t("voiceHelp.tip2")}
          </Text>
          <Text className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed mt-1.5">
            {t("voiceHelp.tip3")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
