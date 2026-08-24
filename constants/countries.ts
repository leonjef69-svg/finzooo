import type { CurrencyId } from "@/constants/currencies";
import type { LanguageId } from "@/constants/i18n";

export type Country = { id: string; name: string; flag: string; language: LanguageId; currency: CurrencyId };

const SPANISH = new Set(["AR","BO","CL","CO","CR","CU","DO","EC","ES","GQ","GT","HN","MX","NI","PA","PE","PR","PY","SV","UY","VE"]);
const PORTUGUESE = new Set(["AO","BR","CV","GW","MZ","PT","ST","TL"]);
const languageFor = (id: string): LanguageId => SPANISH.has(id) ? "es" : PORTUGUESE.has(id) ? "pt" : "en";
const flagFor = (id: string) => id.replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));

/* ISO 3166 completo: código | nombre de respaldo | moneda habitual. */
const DATA = `
AD|Andorra|EUR
AE|United Arab Emirates|AED
AF|Afghanistan|AFN
AG|Antigua and Barbuda|XCD
AI|Anguilla|XCD
AL|Albania|ALL
AM|Armenia|AMD
AO|Angola|AOA
AQ|Antarctica|USD
AR|Argentina|ARS
AS|American Samoa|USD
AT|Austria|EUR
AU|Australia|AUD
AW|Aruba|AWG
AX|Åland Islands|EUR
AZ|Azerbaijan|AZN
BA|Bosnia and Herzegovina|BAM
BB|Barbados|BBD
BD|Bangladesh|BDT
BE|Belgium|EUR
BF|Burkina Faso|XOF
BG|Bulgaria|BGN
BH|Bahrain|BHD
BI|Burundi|BIF
BJ|Benin|XOF
BL|Saint Barthélemy|EUR
BM|Bermuda|BMD
BN|Brunei|BND
BO|Bolivia|BOB
BQ|Caribbean Netherlands|USD
BR|Brazil|BRL
BS|Bahamas|BSD
BT|Bhutan|BTN
BV|Bouvet Island|NOK
BW|Botswana|BWP
BY|Belarus|BYN
BZ|Belize|BZD
CA|Canada|CAD
CC|Cocos Islands|AUD
CD|Democratic Republic of the Congo|CDF
CF|Central African Republic|XAF
CG|Republic of the Congo|XAF
CH|Switzerland|CHF
CI|Côte d’Ivoire|XOF
CK|Cook Islands|NZD
CL|Chile|CLP
CM|Cameroon|XAF
CN|China|CNY
CO|Colombia|COP
CR|Costa Rica|CRC
CU|Cuba|CUP
CV|Cape Verde|CVE
CW|Curaçao|ANG
CX|Christmas Island|AUD
CY|Cyprus|EUR
CZ|Czechia|CZK
DE|Germany|EUR
DJ|Djibouti|DJF
DK|Denmark|DKK
DM|Dominica|XCD
DO|Dominican Republic|DOP
DZ|Algeria|DZD
EC|Ecuador|USD
EE|Estonia|EUR
EG|Egypt|EGP
EH|Western Sahara|MAD
ER|Eritrea|ERN
ES|Spain|EUR
ET|Ethiopia|ETB
FI|Finland|EUR
FJ|Fiji|FJD
FK|Falkland Islands|FKP
FM|Micronesia|USD
FO|Faroe Islands|DKK
FR|France|EUR
GA|Gabon|XAF
GB|United Kingdom|GBP
GD|Grenada|XCD
GE|Georgia|GEL
GF|French Guiana|EUR
GG|Guernsey|GBP
GH|Ghana|GHS
GI|Gibraltar|GIP
GL|Greenland|DKK
GM|Gambia|GMD
GN|Guinea|GNF
GP|Guadeloupe|EUR
GQ|Equatorial Guinea|XAF
GR|Greece|EUR
GS|South Georgia and South Sandwich Islands|GBP
GT|Guatemala|GTQ
GU|Guam|USD
GW|Guinea-Bissau|XOF
GY|Guyana|GYD
HK|Hong Kong|HKD
HM|Heard and McDonald Islands|AUD
HN|Honduras|HNL
HR|Croatia|EUR
HT|Haiti|HTG
HU|Hungary|HUF
ID|Indonesia|IDR
IE|Ireland|EUR
IL|Israel|ILS
IM|Isle of Man|GBP
IN|India|INR
IO|British Indian Ocean Territory|USD
IQ|Iraq|IQD
IR|Iran|IRR
IS|Iceland|ISK
IT|Italy|EUR
JE|Jersey|GBP
JM|Jamaica|JMD
JO|Jordan|JOD
JP|Japan|JPY
KE|Kenya|KES
KG|Kyrgyzstan|KGS
KH|Cambodia|KHR
KI|Kiribati|AUD
KM|Comoros|KMF
KN|Saint Kitts and Nevis|XCD
KP|North Korea|KPW
KR|South Korea|KRW
KW|Kuwait|KWD
KY|Cayman Islands|KYD
KZ|Kazakhstan|KZT
LA|Laos|LAK
LB|Lebanon|LBP
LC|Saint Lucia|XCD
LI|Liechtenstein|CHF
LK|Sri Lanka|LKR
LR|Liberia|LRD
LS|Lesotho|LSL
LT|Lithuania|EUR
LU|Luxembourg|EUR
LV|Latvia|EUR
LY|Libya|LYD
MA|Morocco|MAD
MC|Monaco|EUR
MD|Moldova|MDL
ME|Montenegro|EUR
MF|Saint Martin|EUR
MG|Madagascar|MGA
MH|Marshall Islands|USD
MK|North Macedonia|MKD
ML|Mali|XOF
MM|Myanmar|MMK
MN|Mongolia|MNT
MO|Macao|MOP
MP|Northern Mariana Islands|USD
MQ|Martinique|EUR
MR|Mauritania|MRU
MS|Montserrat|XCD
MT|Malta|EUR
MU|Mauritius|MUR
MV|Maldives|MVR
MW|Malawi|MWK
MX|Mexico|MXN
MY|Malaysia|MYR
MZ|Mozambique|MZN
NA|Namibia|NAD
NC|New Caledonia|XPF
NE|Niger|XOF
NF|Norfolk Island|AUD
NG|Nigeria|NGN
NI|Nicaragua|NIO
NL|Netherlands|EUR
NO|Norway|NOK
NP|Nepal|NPR
NR|Nauru|AUD
NU|Niue|NZD
NZ|New Zealand|NZD
OM|Oman|OMR
PA|Panama|PAB
PE|Peru|PEN
PF|French Polynesia|XPF
PG|Papua New Guinea|PGK
PH|Philippines|PHP
PK|Pakistan|PKR
PL|Poland|PLN
PM|Saint Pierre and Miquelon|EUR
PN|Pitcairn Islands|NZD
PR|Puerto Rico|USD
PS|Palestine|ILS
PT|Portugal|EUR
PW|Palau|USD
PY|Paraguay|PYG
QA|Qatar|QAR
RE|Réunion|EUR
RO|Romania|RON
RS|Serbia|RSD
RU|Russia|RUB
RW|Rwanda|RWF
SA|Saudi Arabia|SAR
SB|Solomon Islands|SBD
SC|Seychelles|SCR
SD|Sudan|SDG
SE|Sweden|SEK
SG|Singapore|SGD
SH|Saint Helena|SHP
SI|Slovenia|EUR
SJ|Svalbard and Jan Mayen|NOK
SK|Slovakia|EUR
SL|Sierra Leone|SLE
SM|San Marino|EUR
SN|Senegal|XOF
SO|Somalia|SOS
SR|Suriname|SRD
SS|South Sudan|SSP
ST|São Tomé and Príncipe|STN
SV|El Salvador|USD
SX|Sint Maarten|ANG
SY|Syria|SYP
SZ|Eswatini|SZL
TC|Turks and Caicos Islands|USD
TD|Chad|XAF
TF|French Southern Territories|EUR
TG|Togo|XOF
TH|Thailand|THB
TJ|Tajikistan|TJS
TK|Tokelau|NZD
TL|Timor-Leste|USD
TM|Turkmenistan|TMT
TN|Tunisia|TND
TO|Tonga|TOP
TR|Türkiye|TRY
TT|Trinidad and Tobago|TTD
TV|Tuvalu|AUD
TW|Taiwan|TWD
TZ|Tanzania|TZS
UA|Ukraine|UAH
UG|Uganda|UGX
UM|U.S. Outlying Islands|USD
US|United States|USD
UY|Uruguay|UYU
UZ|Uzbekistan|UZS
VA|Vatican City|EUR
VC|Saint Vincent and the Grenadines|XCD
VE|Venezuela|VES
VG|British Virgin Islands|USD
VI|U.S. Virgin Islands|USD
VN|Vietnam|VND
VU|Vanuatu|VUV
WF|Wallis and Futuna|XPF
WS|Samoa|WST
XK|Kosovo|EUR
YE|Yemen|YER
YT|Mayotte|EUR
ZA|South Africa|ZAR
ZM|Zambia|ZMW
ZW|Zimbabwe|ZWG
`.trim();

export const COUNTRIES: Country[] = DATA.split("\n").map((row) => {
  const [id, name, currency] = row.split("|");
  return { id, name, currency, flag: flagFor(id), language: languageFor(id) };
});

export function countryById(id: string): Country | undefined {
  return COUNTRIES.find((country) => country.id === id.toUpperCase());
}

export function countryLabelFor(country: Country, language: string): string {
  try {
    const DisplayNames = (Intl as typeof Intl & { DisplayNames?: new (locales: string[], options: { type: "region" }) => { of: (id: string) => string | undefined } }).DisplayNames;
    return DisplayNames ? new DisplayNames([language], { type: "region" }).of(country.id) || country.name : country.name;
  } catch { return country.name; }
}

export function countriesFor(language: string): Country[] {
  return [...COUNTRIES].sort((a, b) => countryLabelFor(a, language).localeCompare(countryLabelFor(b, language), language));
}

export function countryFor(language: string, currency: string, preferredId?: string): Country | undefined {
  const preferred = countryById(preferredId || "");
  if (preferred) return preferred;
  // Compatibilidad con perfiles antiguos, que todavía no guardaban país.
  // Primero se prueban los países principales de Fino para no elegir un
  // territorio remoto solo porque aparece antes alfabéticamente.
  const legacyOrder = ["PE", "CL", "AR", "BO", "CO", "EC", "MX", "UY", "PY", "BR", "ES", "US"];
  return legacyOrder
    .map(countryById)
    .find((c) => c?.language === language && c.currency === currency)
    ?? COUNTRIES.find((c) => c.language === language && c.currency === currency);
}
