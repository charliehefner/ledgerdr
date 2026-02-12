/**
 * Convert a number to Spanish words for receipt generation.
 * Supports up to 999,999,999.99
 */

const UNITS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const TEENS = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const TENS = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function convertGroup(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";

  let result = "";
  
  if (n >= 100) {
    result += HUNDREDS[Math.floor(n / 100)] + " ";
    n %= 100;
  }

  if (n >= 20) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (ten === 2 && unit > 0) {
      result += "veinti" + UNITS[unit];
    } else {
      result += TENS[ten];
      if (unit > 0) result += " y " + UNITS[unit];
    }
  } else if (n >= 10) {
    result += TEENS[n - 10];
  } else if (n > 0) {
    result += UNITS[n];
  }

  return result.trim();
}

export function numberToSpanishWords(amount: number, currency: string = "DOP"): string {
  if (amount === 0) return "cero";

  const intPart = Math.floor(Math.abs(amount));
  const decPart = Math.round((Math.abs(amount) - intPart) * 100);

  const millions = Math.floor(intPart / 1_000_000);
  const thousands = Math.floor((intPart % 1_000_000) / 1_000);
  const remainder = intPart % 1_000;

  let words = "";

  if (millions > 0) {
    words += millions === 1 ? "un millón " : convertGroup(millions) + " millones ";
  }

  if (thousands > 0) {
    words += thousands === 1 ? "mil " : convertGroup(thousands) + " mil ";
  }

  if (remainder > 0 || intPart === 0) {
    words += convertGroup(remainder) + " ";
  }

  const currencyLabel = currency === "USD" ? "dólares" : "pesos";
  words += currencyLabel;

  if (decPart > 0) {
    words += ` con ${decPart}/100`;
  }

  // Capitalize first letter
  return words.trim().replace(/^\w/, (c) => c.toUpperCase());
}
