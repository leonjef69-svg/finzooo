import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { isDecoyActive } from "@/utils/decoyMode";
import { borrarNegocioDeLaNube } from "@/utils/cloudNegocio";
import type { Goal, Transaction } from "@/types";
import type { PagoProgramado } from "@/utils/calendarioPagos";

// EL CANDADO DE LA NUBE EN MODO SEÑUELO
//
// Con el señuelo encendido, esta app no habla con la nube. Ni sube ni baja.
// Los dos sentidos son igual de graves y por motivos opuestos:
//
//   SUBIR  → los movimientos inventados pisarían el respaldo real. Sería
//            perder los datos de verdad, para siempre, sin avisar. Es el
//            peor desenlace posible de toda esta función.
//   BAJAR  → traería los movimientos REALES desde la nube y los enseñaría
//            dentro del señuelo. O sea: el modo pensado para esconder los
//            datos acabaría revelándolos.
//
// El candado está aquí abajo, en la única puerta que da a Firestore, y no en
// cada sitio que llama. Hoy hay tres llamadas —la sincronización
// automática, la de cerrar sesión y la de entrar desde otro celular— pero lo
// que importa es la cuarta, la que alguien escriba dentro de seis meses sin
// acordarse de que este modo existe. Desde aquí no hace falta que se
// acuerde.

export type CloudData = {
  hasOnboarded: boolean;
  userName: string;
  userPhoto: string | null;
  userCurrency: string;
  userLanguage: string;
  budgets: Record<string, number>;
  categoryBudgets: Record<string, number>;
  transactions: Transaction[];
  goals: Goal[];
  /**
   * El calendario de pagos. Opcional: las cuentas de antes del 18/08/2026 no lo tienen, y
   * sin el "?" leerlas fallaría.
   */
  pagosProgramados?: PagoProgramado[];
  isPremium: boolean;
  premiumTrialStartedAt?: number;
  // Lo que la persona le enseñó al clasificador: "este comercio va en
  // esta categoría". Opcional para no romper cuentas viejas que no lo
  // tienen guardado todavía.
  merchantLearned?: Record<string, string>;
  // Nombre, color e imagen propios de cada categoria. Opcional: las cuentas
  // creadas antes de esto no lo tienen, y sin el "?" leerlas fallaria.
  categoryOverrides?: Record<string, { name?: string; color?: string; image?: string }>;
  // Las categorias que creo la persona. Opcional: las cuentas de antes de
  // esto no lo tienen, y sin el "?" leerlas fallaria.
  categoriasPropias?: {
    id: string;
    nombre: string;
    tipo: "expense" | "income";
    color: string;
    icono: string;
    image?: string;
  }[];
  // Meses cuyo "Saldo anterior" se muestra en cero, cada uno por separado
  // (claves "AAAA-MM"). Opcional: las cuentas creadas antes de esta
  // función no lo tienen guardado.
  carryoverCleared?: string[];
  /**
   * Los dibujos marcados como favoritos, por su nombre del catálogo.
   *
   * SIN LAS FOTOS PROPIAS, y es a propósito. Una foto recortada pesa unos 18 KB y
   * TODO este documento tiene un tope de 1 MB — el mismo que comparten los
   * movimientos y las fotos de las categorías. Treinta fotos de favoritos serían
   * medio megabyte gastado en atajos, y pasarse del tope no deja el documento a
   * medias: lo deja SIN GUARDAR, y con él los movimientos. Perder un atajo es
   * molesto; perder los gastos, grave.
   *
   * Los nombres del catálogo pesan diez bytes cada uno, así que esos sí van. Ver
   * paraLaNube() en utils/iconosFavoritos.
   */
  iconosFavoritos?: string[];
};

// Trae los datos guardados en la nube para esta cuenta (o "null" si esta
// cuenta nunca terminó de configurarse, o si no hay internet ahora mismo).
export async function loadCloudData(uid: string): Promise<CloudData | null> {
  // Ver el candado explicado arriba: bajar aquí enseñaría los datos reales.
  if (isDecoyActive()) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data?.hasOnboarded) return null;
    return {
      hasOnboarded: true,
      userName: data.userName || "",
      userPhoto: data.userPhoto || null,
      userCurrency: data.userCurrency || "PEN",
      userLanguage: data.userLanguage || "es",
      budgets: data.budgets || {},
      categoryBudgets: data.categoryBudgets || {},
      transactions: data.transactions || [],
      goals: data.goals || [],
      // SE LEE, y no solo se escribe. Ya pasó el 07/08 con las categorías propias: estaban
      // en el tipo, se subían bien, y aquí no se leían — así que al entrar desde otro
      // celular volvían vacías, sin dar ningún error.
      pagosProgramados: data.pagosProgramados || [],
      isPremium: !!data.isPremium,
      premiumTrialStartedAt: typeof data.premiumTrialStartedAt === "number" ? data.premiumTrialStartedAt : undefined,
      merchantLearned: data.merchantLearned || {},
      carryoverCleared: data.carryoverCleared || [],
      // ESTAS DOS SE SUBÍAN Y NO SE BAJABAN, y eso era un fallo de verdad
      // (encontrado el 07/08/2026 al añadir los favoritos).
      //
      // Estaban en el tipo, se enviaban bien, y aquí no se leían: así que al
      // entrar desde otro celular volvían vacías. Las categorías que la persona
      // creó desaparecían, sus movimientos se veían como "Otros", y los nombres,
      // colores y fotos que hubiera puesto se perdían — todo con la copia
      // correcta guardada en la nube.
      //
      // No dio ningún error porque el lado que las escribe estaba bien y este
      // devolvía "undefined", que quien lo recibe convierte en vacío. La prueba
      // que decía "viajan a la nube" solo comprobaba que el TIPO las nombrara.
      categoryOverrides: data.categoryOverrides || {},
      categoriasPropias: data.categoriasPropias || [],
      iconosFavoritos: data.iconosFavoritos || [],
    };
  } catch {
    return null;
  }
}

// Durante la prueba cerrada damos Premium manual en Firebase.
// Si el celular todavía tiene una copia vieja con isPremium:false, no debe pisar ese true.
export function conservarPremiumManual(
  actualEnLaNube: { isPremium?: unknown } | null,
  siguiente: CloudData
): CloudData {
  if (siguiente.isPremium) return siguiente;
  if (actualEnLaNube?.isPremium === true) {
    return { ...siguiente, isPremium: true };
  }
  return siguiente;
}

// Sube los datos actuales a la nube. Si no hay internet, falla en
// silencio — los datos ya están a salvo en este celular y se van a
// intentar subir de nuevo la próxima vez que algo cambie. Devuelve la
// promesa por si quien la llama necesita esperar a que termine (por
// ejemplo, antes de cerrar sesión) en vez de solo "lanzarla y olvidarla".
export async function saveCloudData(uid: string, data: CloudData): Promise<ResultadoNube> {
  // Ver el candado explicado arriba: subir aquí borraría el respaldo real.
  if (isDecoyActive()) return { ok: true };
  // Firestore RECHAZA cualquier campo cuyo valor sea "undefined" y tira el
  // guardado entero. Como los movimientos ahora tienen campos opcionales
  // (comercio, cuenta, referencia...), uno vacío podría hacer que la copia
  // en la nube fallara en silencio y la persona nunca se enterara.
  // Este paso los quita: JSON.stringify descarta las claves con undefined.
  let clean = JSON.parse(JSON.stringify(data)) as CloudData;

  /* SI NO CABE, SE SUBE SIN FOTOS ANTES QUE NO SUBIR NADA (20/08/2026).
     El documento tiene un tope duro de 1 MB y pasarse no lo guarda a medias: **no guarda
     nada**, ni los movimientos. Las fotos propias de las categorías son `data:image/jpeg;
     base64,...` — unos 18 KB cada una— así que un puñado de ellas se come el presupuesto
     entero y tumba la copia de TODO lo demás.
     Perder una foto es molesto; perder los gastos, grave. Misma decisión que en
     `pagosParaLaNube` y en `utils/iconosFavoritos`, ahora también cuando aprieta. */
  if (pesa(clean) > TOPE_SEGURO) clean = sinFotos(clean);

  /* Y SI AUN ASÍ NO CABE, SE DICE. Antes esto era `.catch(() => {})`: el guardado podía estar
     fallando desde hacía semanas y la pantalla seguía diciendo "Tus datos están respaldados",
     porque ese cartel solo miraba si había sesión iniciada. Un respaldo que miente es peor
     que no tener respaldo: con el segundo, uno guarda una copia por su cuenta. */
  if (pesa(clean) > LIMITE_FIRESTORE) return { ok: false, motivo: "demasiado-grande" };

  try {
    const ref = doc(db, "users", uid);
    if (!clean.isPremium) {
      const snap = await getDoc(ref);
      clean = conservarPremiumManual(snap.exists() ? snap.data() : null, clean);
    }
    await setDoc(ref, clean);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: motivoLegible(e) };
  }
}

/**
 * TRADUCE EL ERROR DE FIRESTORE A ALGO QUE SE PUEDA HACER.
 *
 * El 21/08/2026 el cartel enseñó *"Missing or insufficient permissions"* y hubo que ir a leer
 * las reglas para entender qué pasaba. Ese texto es para quien programa; a quien usa la app
 * no le dice ni qué falló ni qué hacer.
 *
 * Ese error concreto tiene dos causas y ninguna es un fallo del celular: o las reglas de
 * seguridad no están publicadas en Firebase, o el correo de la cuenta no está confirmado —las
 * reglas exigen `email_verified`, así que hasta que se confirme, Firestore rechaza cada
 * escritura. Se dice lo segundo porque es lo único que la persona puede resolver.
 */
function motivoLegible(e: unknown): string {
  const crudo = String((e as { code?: string })?.code ?? (e as Error)?.message ?? e);
  if (/permission-denied|insufficient permissions/i.test(crudo)) return "permisos";
  if (/unavailable|network|offline/i.test(crudo)) return "sin-internet";
  return crudo;
}

/** Cómo fue el último intento de subir. Ver el cartel de "respaldados" en Ajustes. */
export type ResultadoNube = { ok: true } | { ok: false; motivo: string };

/** El tope de Firestore es 1 MB por documento. */
const LIMITE_FIRESTORE = 1_000_000;
/** Con margen: los nombres de los campos y el formato de Firestore también ocupan. */
const TOPE_SEGURO = 800_000;

function pesa(data: CloudData): number {
  return JSON.stringify(data).length;
}

/** Quita todo lo que sea una foto pegada, que es lo único que pesa de verdad aquí. */
function sinFotos(data: CloudData): CloudData {
  const esFoto = (v?: string | null) => typeof v === "string" && v.startsWith("data:");
  const overrides: CloudData["categoryOverrides"] = {};
  for (const [k, v] of Object.entries(data.categoryOverrides ?? {})) {
    overrides[k] = esFoto(v.image) ? { ...v, image: undefined } : v;
  }
  return {
    ...data,
    userPhoto: esFoto(data.userPhoto) ? null : data.userPhoto,
    categoryOverrides: overrides,
    categoriasPropias: (data.categoriasPropias ?? []).map((c) =>
      esFoto(c.image) ? { ...c, image: undefined } : c
    ),
  };
}

// Borra por completo el documento de esta cuenta en la nube (se usa al
// eliminar la cuenta — a diferencia de "saveCloudData", aquí SÍ hace
// falta saber si funcionó, porque no queremos borrar la cuenta de
// inicio de sesión si sus datos no se pudieron borrar primero.
export async function deleteCloudAccount(uid: string): Promise<void> {
  // Desde el señuelo no se borra la cuenta de verdad. Requiere la
  // contraseña, que quien esté obligando a abrir la app no tiene, pero un
  // borrado irreversible no debería depender solo de eso.
  if (isDecoyActive()) throw new Error("No disponible");
  await deleteDoc(doc(db, "users", uid));
  // Y EL NEGOCIO, QUE VIVE EN OTRO DOCUMENTO. NO QUITAR ESTA LÍNEA.
  //
  // El Modo Negocio guarda sus ventas y sus precios en "negocios/{uid}", aparte, porque en
  // este documento no caben (ver utils/cloudNegocio). Borrar este NO borra aquel: son dos
  // documentos distintos.
  //
  // Sin esta línea, borrar la cuenta dejaría las ventas y los precios del negocio en la nube
  // para siempre, y nadie se enteraría — el borrado diría que salió bien. Hay una prueba que
  // exige que los dos se borren aquí.
  await borrarNegocioDeLaNube(uid);
}
