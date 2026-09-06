/**
 * truncateWithEllipsis -- kuerzt einen String auf eine maximale Laenge und haengt
 * bei Ueberschreitung eine Ellipsis an, ohne die Gesamtlaenge zu ueberschreiten.
 *
 * Kern-Invariante dieser Funktion: Die Laenge des Rueckgabewerts ist IMMER
 * kleiner oder gleich maxLength -- egal welche Eingabe. Diese Garantie gilt auch
 * fuer extrem kleine Grenzen wie maxLength === 1, was ohne explizite Behandlung
 * sonst zu Bugs fuehren wuerde (siehe Randfaelle weiter unten).
 *
 * Design-Entscheidungen im Detail:
 *
 * 1) Ellipsis als Konstante statt Parameter: Die Ellipsis (drei Punkte, "...")
 *    ist fest verdrahtet und wird nicht als zusaetzliches Argument akzeptiert.
 *    Das haelt die Signatur minimal, erzwingt eine einheitliche Darstellung an
 *    allen Aufrufstellen und zentralisiert die Laengenrechnung an genau einer
 *    Stelle, wodurch die Kern-Invariante einfach beweisbar bleibt. Wer eine
 *    andere Trennung braucht (z.B. U+2026 "..."), kann den Rueckgabewert danach
 *    selbst nachbearbeiten.
 *
 * 2) Laengenberechnung: Bei Ueberschreitung wird der Text auf
 *    maxLength - ELLIPSIS_LENGTH Zeichen gekuerzt und die Ellipsis angehaengt.
 *    Dadurch landet die Ellipsis garantiert "im Budget" -- das Ergebnis ist also
 *    kein stumpfes slice(maxLength) + "...", das waere maxLength + 3 Zeichen lang,
 *    sondern fuegt sich exakt in die erlaubte Laenge ein.
 *
 * 3) Unicode-Bewusstheit: Die Funktion arbeitet mit der JS-eigenen
 *    Zeichenlaenge (.length), die auf UTF-16-Code-Units basiert. Fuer
 *    BMP-Zeichen (die bei weitem haeufigsten) ist das identisch zur sichtbaren
 *    Zeichenzahl. Kombinierende Zeichen oder Emojis (Surrogatpaare) koennen an
 *    der Schnittkante aufgetrennt werden -- dies ist eine bewusste, dokumentierte
 *    Abwaegung zugunsten von Einfachheit und Performance; fuer eine
 *    grapheme-sichere Variante wuerde man Intl.Segmenter einsetzen.
 *
 * Randfaelle (alle explizit behandelt und getestet):
 *
 * a) text.length <= maxLength: Kein Kuerzen noetig -- der Text wird unveraendert
 *    zurueckgegeben. Insbesondere wird KEINE Ellipsis angehaengt, wenn der Text
 *    bereits passt, sonst wuerde eine scheinbar "passende" Eingabe ploetzlich
 *    ueberlaufen.
 *
 * b) maxLength === text.length (Grenzfall): Der Text passt exakt, also keine
 *    Ellipsis, Ergebnis bleibt unveraendert. Nur bei maxLength + 1 beginnt die
 *    Kuerzung -- genau das erwartet ein Konsument von einer Grenzfunktion.
 *
 * c) maxLength < ELLIPSIS_LENGTH (z.B. maxLength === 1 oder 2): Ein naives
 *    slice(0, maxLength - 3) wuerde hier mit einem negativen Startwert
 *    inkonsistentes Verhalten zeigen (negative slice-Indizes werden vom Ende
 *    gezaehlt). Die Funktion behandelt das explizit: Ist die Ellipsis laenger
 *    als maxLength, wird die Ellipsis selbst auf maxLength gekuerzt (also bei
 *    maxLength === 1 nur ein einzelner Punkt). Die Invariante
 *    "Ergebnislaenge <= maxLength" bleibt damit auch im Extremfall erhalten.
 *
 * Validierung (fail-fast, bewusst strikt): Ungueltige Eingaben werden sofort
 * mit einer aussagekraeftigen Fehlermeldung abgelehnt statt stillschweigend
 * falsche Ergebnisse zu liefern. Es wird unterschieden zwischen:
 *   - text ist kein String          -> TypeError (Programmierfehler am Aufrufer)
 *   - maxLength ist keine positive  -> RangeError (semantisch falscher Wert)
 *     ganze Zahl
 * Wichtig: NaN scheitert an der Ganzzahl-Pruefung (Number.isInteger(NaN) ist
 * false) und wird ebenfalls abgelehnt -- ein naives "maxLength <= 0" wuerde
 * NaN naemlich durchlassen, weil NaN mit jeder Vergleichsoperation false ist.
 * Dadurch ist garantiert, dass niemals eine rekursive/schleifenartige Kuerzung
 * mit einer kaputten Laenge laufen kann.
 */
const ELLIPSIS = '...';
const ELLIPSIS_LENGTH = ELLIPSIS.length;

export function truncateWithEllipsis(text, maxLength) {
  if (typeof text !== 'string') {
    throw new TypeError(`text muss ein String sein, erhalten: ${typeof text}`);
  }
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new RangeError(
      `maxLength muss eine positive ganze Zahl sein, erhalten: ${String(maxLength)}`
    );
  }

  // a) Text passt bereits -- unveraendert zurueckgeben, keine Ellipsis.
  if (text.length <= maxLength) {
    return text;
  }

  // c) Ellipsis ist laenger als erlaubt: nur die passende Anzahl Punkte zeigen.
  if (maxLength < ELLIPSIS_LENGTH) {
    return ELLIPSIS.slice(0, maxLength);
  }

  // b/c) Kuerzen und Ellipsis exakt ins Budget legen.
  return text.slice(0, maxLength - ELLIPSIS_LENGTH) + ELLIPSIS;
}

/**
 * capitalizeFirst -- schreibt den ersten Buchstaben eines Strings gross und
 * laesst den Rest unveraendert.
 *
 * Design-Entscheidungen im Detail:
 *
 * 1) "Rest unveraendert": Anders als ein naiver Title-Case-Helper werden die
 *    restlichen Zeichen NICHT kleingeschrieben. Die Funktion uebernimmt nur
 *    den ersten Buchstaben in die Grossschreibung und laesst den Text dahinter
 *    exakt so stehen, wie er uebergeben wurde -- "hALLO" wird also zu "HALLO",
 *    nicht zu "Hallo". Damit ist die Funktion verlustfrei fuer die Gross-/
 *    Kleinschreibung des Rests und eignet sich als unueberraschender Baustein.
 *
 * 2) Umsetzung: Das erste Zeichen wird ueber text.charAt(0) geholt (statt
 *    text[0]), weil charAt(0) auch bei leerem String sauber '' liefert und
 *    keine undefined-Luecken erzeugt. Angehaengt wird text.slice(1) -- der
 *    gesamte Rest ab Index 1.
 *
 * 3) Unicode-Bewusstheit (analog zu truncateWithEllipsis): Die Funktion
 *    arbeitet auf UTF-16-Code-Units. Die haeufigsten Faelle (inkl. Umlaute
 *    wie "ä" -> "Ä") werden korrekt abgedeckt. Surrogatpaare (z.B. Emoji am
 *    Stringanfang) oder der "ß"-Sonderfall (toUpperCase liefert dort "SS",
 *    was das Ergebnis verlaengert) sind eine bewusste, dokumentierte
 *    Abwaegung zugunsten von Einfachheit.
 *
 * Randfaelle:
 *   - leerer String ('') -> '' (es gibt keinen Buchstaben zum Grossschreiben)
 *   - erstes Zeichen ist kein Buchstabe (Zahl, Leerzeichen, Sonderzeichen):
 *     toUpperCase aendert daran nichts, der Text bleibt unveraendert
 *
 * Validierung (fail-fast, bewusst strikt): Ist text kein String, wird ein
 * TypeError geworfen -- Programmierfehler am Aufrufer werden sofort sichtbar
 * statt stillschweigend falsche Ergebnisse zu liefern. Dieses Verhalten ist
 * identisch zu truncateWithEllipsis, damit beide Funktionen dieser Datei ein
 * einheitliches, vorhersehbares Fehlerverhalten aufweisen.
 */
export function capitalizeFirst(text) {
  if (typeof text !== 'string') {
    throw new TypeError(`text muss ein String sein, erhalten: ${typeof text}`);
  }

  // Leerer String: kein Buchstabe vorhanden, unveraendert '' zurueckgeben.
  if (text.length === 0) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}
