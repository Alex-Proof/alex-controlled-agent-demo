/**
 * applyDiscount -- zieht einen prozentualen Rabatt vom Preis ab.
 *
 * Kern-Logik: Ergebnis = price - (price * percent) / 100. Ein Rabatt von 20 %
 * auf 100 ergibt also 80. Die Rechnung ist bewusst als "Preis minus
 * Rabattanteil" formuliert und nicht als "Preis mal (1 - percent/100)", damit
 * sie fuer Menschen direkt nachvollziehbar bleibt.
 *
 * Design-Entscheidungen im Detail:
 *
 * 1) Rabattbereich [0, 100]: Ein prozentualer Rabatt ist semantisch auf den
 *    Bereich 0 bis 100 begrenzt. percent > 100 (Preis wuerde negativ werden)
 *    oder percent < 0 (das waere faktisch ein Aufschlag) sind keine gueltigen
 *    Rabatte und werden abgelehnt statt stillschweigend ein ueberraschendes
 *    Ergebnis zu liefern.
 *
 * 2) Preis >= 0: Ein negativer Preis ist im Kontext eines Rabatts unsinnig
 *    (der Verkaeufer wuerde dem Kunden Geld schenken) und wird abgelehnt.
 *
 * Validierung (fail-fast, bewusst strikt -- konsistent zu den Geschwister-
 * Modulen mathUtils/stringUtils): Ungueltige Eingaben werden sofort mit einer
 * aussagekraeftigen Fehlermeldung abgelehnt statt falsche Ergebnisse zu
 * liefern. Es wird unterschieden zwischen:
 *   - price/percent sind keine Zahl        -> TypeError (Programmierfehler am
 *                                             Aufrufer, z.B. String statt Zahl)
 *   - price/percent sind ausserhalb des    -> RangeError (semantisch falscher
 *     gueltigen Wertebereichs                 Wert)
 * Wichtig: NaN wird explizit abgefangen. NaN ist typeof number und wuerde alle
 * Bereichsvergleiche (price < 0 etc.) "ueberleben", weil NaN mit jeder
 * Vergleichsoperation false ist -- ein naives "price < 0" liesse NaN also
 * durch und die Rechnung ergaebe NaN. Deshalb wird NaN als semantisch
 * ungueltiger Wert (RangeError) abgelehnt.
 */
export function applyDiscount(price, percent) {
  if (typeof price !== 'number') {
    throw new TypeError(`price muss eine Zahl sein, erhalten: ${typeof price}`);
  }
  if (typeof percent !== 'number') {
    throw new TypeError(
      `percent muss eine Zahl sein, erhalten: ${typeof percent}`
    );
  }
  if (Number.isNaN(price) || price < 0) {
    throw new RangeError(
      `price muss eine nicht-negative Zahl sein, erhalten: ${String(price)}`
    );
  }
  if (Number.isNaN(percent) || percent < 0 || percent > 100) {
    throw new RangeError(
      `percent muss im Bereich 0 bis 100 liegen, erhalten: ${String(percent)}`
    );
  }

  return price - (price * percent) / 100;
}
