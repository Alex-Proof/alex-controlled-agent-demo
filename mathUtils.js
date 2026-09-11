/**
 * clampValue(value, min, max) -- begrenzt einen Zahlenwert auf den Bereich [min, max].
 *
 * DESIGN-ENTSCHEIDUNGEN UND RANDFAELLE:
 *
 * 1. Inklusive Grenzen: Der Rueckgabewert liegt immer innerhalb des abgeschlossenen
 *    Intervalls [min, max], d.h. ein Wert exakt auf einer Grenze (value === min oder
 *    value === max) wird unveraendert zurueckgegeben. Das ist das konventionelle
 *    Verhalten von clamp() in den meisten Sprachen und erwartbarer als ein halboffenes
 *    Intervall, das den Maximalwert kappen wuerde.
 *
 * 2. Fehler statt stillem Korrigieren: Wenn min > max ist, existiert kein sinnvolles
 *    Intervall, auf das begrenzt werden koennte. Statt stillschweigend die Grenzen zu
 *    tauschen (was ein versteckter Bug im Aufrufer waere) wird ein Error geworfen. Ein
 *    stilles Tauschen wuerde unerwartetes Verhalten erzeugen und das eigentliche Problem
 *    verschleiern.
 *
 * 3. NaN-Handling: NaN ist keine echte Zahl und mit allen Vergleichen (auch
 *    value >= min) immer false, sodass das Ergebnis ohne explizite Pruefung je nach
 *    Eingabe unvorhersehbar waere (z.B. wuerde NaN < min fehlschlagen und der Wert
 *    durchrutschen). Deshalb werden alle drei Argumente explizit auf NaN geprueft und
 *    ein Error geworfen statt eine leere oder falsche Grenze zurueckzugeben.
 *
 * 4. Typpruefung auf number: Nur Zahlen (inkl. negativer, Dezimal- und Infinity-Werte)
 *    sind als Argumente sinnvoll. Strings oder andere Typen koennten durch die
 *    relationalen Vergleiche implizit konvertiert werden ("10" < 20 ist true), was
 *    subtile Bugs verursacht. Daher wird zusaetzlich mit typeof geprueft.
 *
 * 5. Infinity als Grenzen: +/-Infinity werden bewusst NICHT als Fehler behandelt, da sie
 *    mathematisch wohldefinierte Grenzen darstellen (clampValue(x, -Infinity, Infinity)
 *    gibt x unveraendert zurueck). Nur NaN ist als Grenze ungueltig.
 *
 * @param {number} value Der zu begrenzende Wert.
 * @param {number} min Untere Grenze (inklusive).
 * @param {number} max Obere Grenze (inklusive).
 * @returns {number} value begrenzt auf das Intervall [min, max].
 * @throws {TypeError} Wenn value, min oder max keine Zahl sind (oder NaN).
 * @throws {RangeError} Wenn min > max ist.
 */
export function clampValue(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`clampValue: value muss eine Zahl sein, erhalten: ${String(value)}`);
  }
  if (typeof min !== 'number' || Number.isNaN(min)) {
    throw new TypeError(`clampValue: min muss eine Zahl sein, erhalten: ${String(min)}`);
  }
  if (typeof max !== 'number' || Number.isNaN(max)) {
    throw new TypeError(`clampValue: max muss eine Zahl sein, erhalten: ${String(max)}`);
  }
  if (min > max) {
    throw new RangeError(`clampValue: min (${min}) darf nicht groesser als max (${max}) sein`);
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * isPrime(n) -- reine Funktion: prueft, ob eine Zahl eine Primzahl ist.
 *
 * DESIGN-ENTSCHEIDUNGEN UND RANDFAELLE:
 *
 * 1. Primzahlen sind per Definition natuerliche Zahlen groesser als 1, die nur durch
 *    1 und sich selbst teilbar sind. Deshalb liefert isPrime(n) fuer n < 2 immer false
 *    -- das deckt 0, 1 sowie alle negativen Zahlen ab, ohne sie einzeln pruefen zu
 *    muessen.
 *
 * 2. Reiner Bool-Vertrag (keine Exceptions): Alles, was keine Primzahl sein kann,
 *    ergibt false statt zu werfen. Dazu gehoeren auch Nicht-Ganzzahlen (z.B. 2.5),
 *    NaN und Infinity -- sie koennen per Definition keine Primzahlen sein, und ein
 *    stilles false ist hier informativer als ein Fehler. Auch eine Typpruefung per
 *    typeof ist daher nicht noetig, weil Number.isInteger(n) fuer alle Nicht-Zahlen
 *    bereits false liefert.
 *
 * 3. Effizienz: Nach dem Ausschluss von n < 2 und geraden Zahlen (ausser 2 selbst)
 *    muss nur bis sqrt(n) in 2er-Schritten getestet werden. Ein Teiler groesser als
 *    sqrt(n) haette immer einen komplementaeren Teiler kleiner als sqrt(n), daher ist
 *    jede Teilbarkeit oberhalb der Wurzel bereits abgedeckt.
 *
 * @param {number} n Die zu pruefende Zahl.
 * @returns {boolean} true, wenn n eine Primzahl ist (>= 2 und nur durch 1 und sich
 *   selbst teilbar), sonst false (fuer 0, 1, negative Zahlen, zusammengesetzte Zahlen
 *   sowie Nicht-Ganzzahlen).
 */
export function isPrime(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 2) {
    return false;
  }
  if (n === 2) {
    return true;
  }
  if (n % 2 === 0) {
    return false;
  }
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) {
      return false;
    }
  }
  return true;
}
