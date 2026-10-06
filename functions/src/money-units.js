"use strict";

// Sin SDK/Node: las validaciones financieras usan la misma escala en app y servidor.
const ZERO = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
function currencyDecimals(currency) { return ZERO.has(currency) ? 0 : THREE.has(currency) ? 3 : 2; }
function units(value, currency, reason = "return-invalid-data") {
  const fail = () => { const error = new Error(reason); error.reason = reason; throw error; };
  const decimals = currencyDecimals(currency), scale = 10 ** decimals;
  if (!Number.isFinite(value) || value < 0 || value > 9_000_000_000_000) fail();
  const rounded = Math.round(value * scale) / scale;
  if (Math.abs(value - rounded) > Math.max(1e-9, Number.EPSILON * Math.abs(value) * 2)) fail();
  if (!Number.isInteger(rounded) && rounded > (decimals === 3 ? 10_000_000_000 : 100_000_000_000)) fail();
  return BigInt(rounded.toFixed(decimals).replace(".", ""));
}
module.exports = { currencyDecimals, units };
