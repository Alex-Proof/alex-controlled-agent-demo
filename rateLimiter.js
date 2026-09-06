/**
 * TokenBucket -- ein Token-Bucket-Rate-Limiter.
 *
 * Idee: Der Bucket hat eine maximale Kapazitaet (capacity) Tokens und faellt
 * sich mit einer festen Rate (refillRatePerSecond) wieder auf. Ein Konsument
 * entnimmt bei jedem Request n Tokens; sind nicht genug da, wird der Request
 * abgelehnt (tryConsume gibt false zurueck).
 *
 * Design-Entscheidungen im Detail:
 *
 * 1) Zeitquelle ist injizierbar: Der optionale Parameter `now` liefert die
 *    aktuelle Zeit in Millisekunden (Default Date.now). Dadurch koennen Tests
 *    eine eigene, manuell steuerbare Uhr injizieren, statt echt zu warten.
 *    Zeit wird NUR beim Aufruf von tryConsume/availableTokens gelesen und in
 *    `_lastRefillAt` als Zeitstempel gespeichert -- es laeuft kein Timer und
 *    es gibt kein Hintergrund-Intervall. Der Bucket ist damit reine
 *    Berechnung ueber die seit dem letzten Aufruf vergangene Zeit.
 *
 * 2) Refill auf Basis des Zeitstempels statt eines "Schuld"-Zaehlers:
 *    Gespeichert wird, WANN zuletzt nachgefuellt wurde. Ein zweiter Aufruf
 *    im selben Moment (gleicher now-Wert) sieht eine verstrichene Zeit von 0
 *    und fuellt nichts nach -- dadurch werden Tokens bei zwei schnell
 *    aufeinanderfolgenden Aufrufen nicht doppelt gutgeschrieben (kein
 *    Doppelzaehlen). Bewegt sich die injizierte Uhr rueckwaerts (now kleiner
 *    als _lastRefillAt), wird ebenfalls nichts nachgefuellt statt negativ zu
 *    werden.
 *
 * 3) Nachfuellen ist gedeckelt: Der Tokenstand wird IMMER mit
 *    Math.min(capacity, ...) begrenzt. Auch wenn zwischen zwei Aufrufen sehr
 *    viel Zeit vergeht (oder refillRatePerSecond sehr gross ist), uebersteigt
 *    der Stand die Kapazitaet nie. Selbst ein float-Ueberlauf zu Infinity
 *    wird von Math.min(capacity, Infinity) sicher auf capacity gedeckelt.
 *
 * 4) Fehlverhalten wird sofort abgelehnt (fail-fast):
 *    - capacity <= 0 oder keine endliche Zahl      -> RangeError
 *    - refillRatePerSecond < 0 oder keine endliche -> RangeError
 *      Zahl
 *    - n <= 0 oder keine endliche Zahl in          -> RangeError
 *      tryConsume
 *    Wichtig: NaN scheitert hier an Number.isFinite (ein naives "x <= 0"
 *    wuerde NaN durchlassen, weil NaN mit jeder Vergleichsoperation false
 *    ist). Ein Refill- oder Verbrauchswert von 0 ist bewusst nicht erlaubt:
 *    eine leere/negative Entnahme ist ein Aufruferfehler, kein Randfall.
 *    Ausnahme: refillRatePerSecond === 0 ist GUELTIG (Bucket faellt sich nie
 *    wieder auf -- bewusst erlaubt, siehe unten).
 *
 * 5) refillRatePerSecond === 0 ist ein bewusster Sonderfall: Ein Bucket, der
 *    sich nie nachfuellt, ist die sauberste Art "maximal n Tokens insgesamt"
 *    auszudruecken (z.B. ein einmaliges Kontingent). Solch ein Bucket wird
 *    nach dem Verbrauch dauerhaft leer bleiben.
 *
 * 6) availableTokens() verbraucht nichts: Es aktualisiert nur den Stand auf
 *    die aktuelle Zeit (gleicher Refill wie in tryConsume) und gibt die
 *    Anzahl verfuegbarer Tokens als float zurueck. Der Rueckgabewert darf
 *    fraktional sein (der Refill rechnet in Sekundenbruchteilen), erst
 *    tryConsume prueft gegen den tatsaechlichen, kontinuierlichen Stand.
 */
export class TokenBucket {
  constructor({ capacity, refillRatePerSecond, now } = {}) {
    if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0) {
      throw new RangeError(
        `capacity muss eine positive, endliche Zahl sein, erhalten: ${String(capacity)}`
      );
    }
    if (
      typeof refillRatePerSecond !== 'number' ||
      !Number.isFinite(refillRatePerSecond) ||
      refillRatePerSecond < 0
    ) {
      throw new RangeError(
        `refillRatePerSecond muss eine endliche Zahl >= 0 sein, erhalten: ${String(refillRatePerSecond)}`
      );
    }
    if (now !== undefined && typeof now !== 'function') {
      throw new TypeError(`now muss eine Funktion sein, erhalten: ${typeof now}`);
    }

    this.capacity = capacity;
    this.refillRatePerSecond = refillRatePerSecond;
    this._now = now ?? Date.now;

    // Der Bucket startet voll und merkt sich, wann er zuletzt "voll/gefuellt"
    // war -- von diesem Zeitstempel aus rechnet jeder spaetere Refill.
    this._tokens = capacity;
    this._lastRefillAt = this._now();
  }

  /**
   * Fuellt den Bucket auf Basis der seit _lastRefillAt vergangenen Zeit nach.
   * Rueckwaerts laufende oder stehengebliebene Uhren (now <= _lastRefillAt)
   * fuellen nichts nach -- genau das verhindert das Doppelzaehlen bei zwei
   * Aufrufen ohne Zeitfortschritt.
   */
  _refill(now) {
    if (now <= this._lastRefillAt) {
      return;
    }
    const elapsedSeconds = (now - this._lastRefillAt) / 1000;
    const added = elapsedSeconds * this.refillRatePerSecond;
    this._tokens = Math.min(this.capacity, this._tokens + added);
    this._lastRefillAt = now;
  }

  /**
   * Versucht n Tokens zu entnehmen. Fuellt zuerst den Stand auf die aktuelle
   * Zeit nach; sind danach genug Tokens da, werden n entnommen und true
   * zurueckgegeben. Sind nicht genug da, bleibt der Stand UNVERAENDERT und
   * es wird false zurueckgegeben (der Refill wurde bereits angewendet, das
   * Entnehmen schlaegt aber fehl -- genau wie ein abgelehnter Request).
   */
  tryConsume(n = 1) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
      throw new RangeError(
        `n muss eine positive, endliche Zahl sein, erhalten: ${String(n)}`
      );
    }

    const now = this._now();
    this._refill(now);

    if (this._tokens >= n) {
      this._tokens -= n;
      return true;
    }
    return false;
  }

  /**
   * Gibt den aktuellen, auf jetzt aktualisierten Tokenstand (float) zurueck,
   * ohne Tokens zu verbrauchen.
   */
  availableTokens() {
    this._refill(this._now());
    return this._tokens;
  }
}
