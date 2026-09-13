/** Monedas activas usadas por el catálogo mundial de países. */
const CODES = `AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG`;

const SYMBOLS: Record<string, string> = {
  AED: "د.إ", AFN: "؋", ALL: "L", AMD: "֏", ANG: "ƒ", AOA: "Kz",
  ARS: "AR$", AUD: "A$", AWG: "Afl.", AZN: "₼", BAM: "KM", BBD: "Bds$",
  BDT: "৳", BGN: "лв", BHD: "د.ب", BIF: "FBu", BMD: "BD$", BND: "B$",
  BOB: "Bs", BRL: "R$", BSD: "B$", BTN: "Nu.", BWP: "P", BYN: "Br",
  BZD: "BZ$", CAD: "C$", CDF: "FC", CHF: "CHF", CLP: "CL$", CNY: "¥",
  COP: "COL$", CRC: "₡", CUP: "CUP$", CVE: "Esc", CZK: "Kč", DJF: "Fdj",
  DKK: "kr", DOP: "RD$", DZD: "دج", EGP: "E£", ERN: "Nfk", ETB: "Br",
  EUR: "€", FJD: "FJ$", FKP: "£", GBP: "£", GEL: "₾", GHS: "GH₵",
  GIP: "£", GMD: "D", GNF: "FG", GTQ: "Q", GYD: "G$", HKD: "HK$",
  HNL: "L", HTG: "G", HUF: "Ft", IDR: "Rp", ILS: "₪", INR: "₹",
  IQD: "ع.د", IRR: "﷼", ISK: "kr", JMD: "J$", JOD: "د.ا", JPY: "¥",
  KES: "KSh", KGS: "⃀", KHR: "៛", KMF: "CF", KPW: "₩", KRW: "₩",
  KWD: "د.ك", KYD: "CI$", KZT: "₸", LAK: "₭", LBP: "L£", LKR: "Rs",
  LRD: "L$", LSL: "L", LYD: "ل.د", MAD: "د.م.", MDL: "L", MGA: "Ar",
  MKD: "ден", MMK: "K", MNT: "₮", MOP: "MOP$", MRU: "UM", MUR: "Rs",
  MVR: "Rf", MWK: "MK", MXN: "MX$", MYR: "RM", MZN: "MT", NAD: "N$",
  NGN: "₦", NIO: "C$", NOK: "kr", NPR: "Rs", NZD: "NZ$", OMR: "ر.ع.",
  PAB: "B/.", PEN: "S/", PGK: "K", PHP: "₱", PKR: "Rs", PLN: "zł",
  PYG: "₲", QAR: "ر.ق", RON: "lei", RSD: "дин.", RUB: "₽", RWF: "RF",
  SAR: "ر.س", SBD: "SI$", SCR: "SR", SDG: "ج.س.", SEK: "kr", SGD: "S$",
  SHP: "£", SLE: "Le", SOS: "Sh", SRD: "SRD$", SSP: "SS£", STN: "Db",
  SYP: "£", SZL: "L", THB: "฿", TJS: "SM", TMT: "m", TND: "د.ت",
  TOP: "T$", TRY: "₺", TTD: "TT$", TWD: "NT$", TZS: "Sh", UAH: "₴",
  UGX: "USh", USD: "US$", UYU: "$U", UZS: "soʻm", VES: "Bs.", VND: "₫",
  VUV: "VT", WST: "WS$", XAF: "FCFA", XCD: "EC$", XCG: "Cg.", XOF: "F CFA",
  XPF: "CFPF", YER: "﷼", ZAR: "R", ZMW: "ZK", ZWG: "ZiG",
};

/* Hermes no incluye Intl.DisplayNames en todos los Android compatibles.
 * Este respaldo evita códigos solos o nombres inventados a partir de países. */
const SPANISH_NAMES: Record<string, string> = {
  AED: "Dírham de Emiratos Árabes Unidos", AFN: "Afgani afgano", ALL: "Lek albanés",
  AMD: "Dram armenio", ANG: "Florín antillano", AOA: "Kuanza angoleño", ARS: "Peso argentino",
  AUD: "Dólar australiano", AWG: "Florín arubeño", AZN: "Manat azerbaiyano",
  BAM: "Marco convertible de Bosnia y Herzegovina", BBD: "Dólar barbadense", BDT: "Taka bangladesí",
  BGN: "Leva búlgara", BHD: "Dinar bareiní", BIF: "Franco burundés", BMD: "Dólar bermudeño",
  BND: "Dólar bruneano", BOB: "Boliviano", BRL: "Real brasileño", BSD: "Dólar bahameño",
  BTN: "Gultrum butanés", BWP: "Pula botsuano", BYN: "Rublo bielorruso", BZD: "Dólar beliceño",
  CAD: "Dólar canadiense", CDF: "Franco congoleño", CHF: "Franco suizo", CLP: "Peso chileno",
  CNY: "Yuan renminbi", COP: "Peso colombiano", CRC: "Colón costarricense", CUP: "Peso cubano",
  CVE: "Escudo de Cabo Verde", CZK: "Corona checa", DJF: "Franco yibutiano", DKK: "Corona danesa",
  DOP: "Peso dominicano", DZD: "Dinar argelino", EGP: "Libra egipcia", ERN: "Nakfa eritreo",
  ETB: "Bir etíope", EUR: "Euro", FJD: "Dólar fiyiano", FKP: "Libra malvinense",
  GBP: "Libra esterlina", GEL: "Lari georgiano", GHS: "Cedi ghanés", GIP: "Libra gibraltareña",
  GMD: "Dalasi gambiano", GNF: "Franco guineano", GTQ: "Quetzal guatemalteco", GYD: "Dólar guyanés",
  HKD: "Dólar hongkonés", HNL: "Lempira hondureño", HTG: "Gurde haitiano", HUF: "Forinto húngaro",
  IDR: "Rupia indonesia", ILS: "Nuevo séquel israelí", INR: "Rupia india", IQD: "Dinar iraquí",
  IRR: "Rial iraní", ISK: "Corona islandesa", JMD: "Dólar jamaicano", JOD: "Dinar jordano",
  JPY: "Yen japonés", KES: "Chelín keniano", KGS: "Som kirguís", KHR: "Riel camboyano",
  KMF: "Franco comorense", KPW: "Won norcoreano", KRW: "Won surcoreano", KWD: "Dinar kuwaití",
  KYD: "Dólar de las Islas Caimán", KZT: "Tengue kazajo", LAK: "Kip laosiano", LBP: "Libra libanesa",
  LKR: "Rupia esrilanquesa", LRD: "Dólar liberiano", LSL: "Loti lesotense", LYD: "Dinar libio",
  MAD: "Dírham marroquí", MDL: "Leu moldavo", MGA: "Ariari malgache", MKD: "Dinar macedonio",
  MMK: "Kiat de Myanmar", MNT: "Tugrik mongol", MOP: "Pataca macaense", MRU: "Uguiya mauritano",
  MUR: "Rupia mauriciana", MVR: "Rufiya maldiva", MWK: "Kuacha malauí", MXN: "Peso mexicano",
  MYR: "Ringit malasio", MZN: "Metical mozambiqueño", NAD: "Dólar namibio", NGN: "Naira nigeriano",
  NIO: "Córdoba oro", NOK: "Corona noruega", NPR: "Rupia nepalí", NZD: "Dólar neozelandés",
  OMR: "Rial omaní", PAB: "Balboa panameño", PEN: "Sol peruano", PGK: "Kina papú",
  PHP: "Peso filipino", PKR: "Rupia pakistaní", PLN: "Esloti polaco", PYG: "Guaraní paraguayo",
  QAR: "Rial catarí", RON: "Leu rumano", RSD: "Dinar serbio", RUB: "Rublo ruso",
  RWF: "Franco ruandés", SAR: "Rial saudí", SBD: "Dólar salomonense", SCR: "Rupia seychellense",
  SDG: "Libra sudanesa", SEK: "Corona sueca", SGD: "Dólar singapurense", SHP: "Libra de Santa Elena",
  SLE: "Leona sierraleonesa", SOS: "Chelín somalí", SRD: "Dólar surinamés", SSP: "Libra sursudanesa",
  STN: "Dobra santotomense", SYP: "Libra siria", SZL: "Lilangeni esuatiní", THB: "Bat tailandés",
  TJS: "Somoni tayiko", TMT: "Manat turcomano", TND: "Dinar tunecino", TOP: "Paanga tongano",
  TRY: "Lira turca", TTD: "Dólar de Trinidad y Tobago", TWD: "Nuevo dólar taiwanés",
  TZS: "Chelín tanzano", UAH: "Grivna ucraniana", UGX: "Chelín ugandés",
  USD: "Dólar estadounidense", UYU: "Peso uruguayo", UZS: "Sum uzbeko", VES: "Bolívar venezolano",
  VND: "Dong vietnamita", VUV: "Vatu vanuatense", WST: "Tala samoano",
  XAF: "Franco CFA de África Central", XCD: "Dólar del Caribe Oriental", XCG: "Florín caribeño",
  XOF: "Franco CFA de África Occidental", XPF: "Franco CFP", YER: "Rial yemení",
  ZAR: "Rand sudafricano", ZMW: "Kuacha zambiano", ZWG: "Oro zimbabuense",
};

export type CurrencyId = string;

export const CURRENCIES = CODES.split(" ").map((id) => ({
  id,
  label: `currency.${id}`,
  symbol: SYMBOLS[id] ?? id,
}));

export function currencySymbolFor(id: string): string {
  return CURRENCIES.find((currency) => currency.id === id)?.symbol ?? (id || "S/");
}

/** ISO 4217: monedas cuyo monto cotidiano no lleva parte decimal. */
const ZERO_DECIMALS = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);
const THREE_DECIMALS = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function currencyDecimals(id: string): number {
  if (ZERO_DECIMALS.has(id)) return 0;
  if (THREE_DECIMALS.has(id)) return 3;
  return 2;
}

/**
 * El escáner usa esta decisión para distinguir precios de códigos.
 * No es lo mismo que los decimales ISO: en Argentina y Colombia la moneda
 * admite centavos, pero los precios cotidianos suelen imprimirse enteros.
 */
export function usaCentimos(id: string): boolean {
  return currencyDecimals(id) > 0 && !["ARS", "COP"].includes(id);
}

export function currencyLabelFor(
  id: string,
  t: (key: string) => string,
  language = "es"
): string {
  if (language.toLowerCase().startsWith("es") && SPANISH_NAMES[id]) return SPANISH_NAMES[id];
  const key = `currency.${id}`;
  const translated = t(key);
  if (translated !== key) return translated;
  try {
    const DisplayNames = (Intl as typeof Intl & { DisplayNames?: new (locales: string[], options: { type: "currency" }) => { of: (id: string) => string | undefined } }).DisplayNames;
    return DisplayNames ? new DisplayNames([language], { type: "currency" }).of(id) || id : id;
  } catch { return id; }
}
