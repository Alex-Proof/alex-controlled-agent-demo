/**
 * debounce -- entprellt eine Funktion.
 *
 * Idee: Die zurueckgegebene Funktion sammelt Aufrufe. Erst wenn seit dem
 * LETZTEN Aufruf `waitMs` Millisekunden ohne weiteren Aufruf vergangen sind,
 * wird die zugrunde liegende Funktion `fn` genau EINMAL ausgefuehrt -- und
 * zwar mit den Argumenten des letzten Aufrufs. Jeder weitere Aufruf innerhalb
 * des Wartefensters startet das Fenster neu (klassisches Trailing-Debounce).
 *
 * Design-Entscheidungen im Detail:
 *
 * 1) Der Timer ist injizierbar: `debounce(fn, waitMs)` nutzt standardmaessig
 *    das globale setTimeout/clearTimeout, kann aber ueber den optionalen
 *    dritten Parameter `{ setTimeout, clearTimeout }` mit einem anderen
 *    Timer-Mechanismus versorgt werden. Dadurch koennen Tests einen manuell
 *    steuerbaren Fake-Timer injizieren und deterministisch pruefen, ohne auch
 *    nur eine Millisekunde echt zu warten.
 *
 * 2) Rueckgabe ist eine Funktion, kein Promise: Die entprellte Funktion gibt
 *    immer `undefined` zurueck. Es wird bewusst kein Promise zurueckgegeben,
 *    weil ein entprellter Aufruf womoeglich nie stattfindet (z.B. nach
 *    cancel()) -- ein Promise waere also nie aufloesbar. Wer ein Ergebnis
 *    braucht, nutzt den Callback.
 *
 * 3) Nur der letzte Aufruf zaehlt: Bei jedem Aufruf werden die Argumente
 *    gespeichert und der laufende Timer verworfen (clearTimeout) und neu
 *    gesetzt. Beim Ausloesen wird `fn` mit genau dem zuletzt gespeicherten
 *    Argument-Array aufgerufen ("last call wins").
 *
 * 4) cancel() verwirft einen anstehenden Aufruf vollstaendig: Der Timer wird
 *    geloescht und die gespeicherten Argumente werden verworfen. Zusaetzlich
 *    fuehrt eine Generationen-/Token-Nummer Buch: Der Timer-Callback prueft,
 *    ob sein Token noch aktuell ist, und tut sonst nichts. Dadurch bleibt
 *    cancel() auch dann korrekt, wenn ein (Fake-)Timer clearTimeout ignoriert
 *    und den Callback trotzdem noch ausfuehrt -- ein verworfener Aufruf kann
 *    fn so unter keinen Umstaenden erreichen. cancel() ohne anstehenden
 *    Aufruf ist ein No-op, und die entprellte Funktion bleibt danach normal
 *    weiterbenutzbar.
 *
 * 5) Genau ein Aufruf pro Wartefenster: Nach dem Ausloesen wird der Zustand
 *    (Timer-ID und Argumente) zurueckgesetzt, sodass der naechste Aufruf
 *    wieder ein frisches Fenster startet und nicht versehentlich die alten
 *    Argumente erneut verwendet.
 *
 * 6) Fehlverhalten wird sofort abgelehnt (fail-fast, analog zu rateLimiter.js):
 *    - fn ist keine Funktion                            -> TypeError
 *    - waitMs ist keine endliche Zahl >= 0 (inkl. NaN)   -> RangeError
 *    - injizierter setTimeout/clearTimeout ist keine
 *      Funktion                                          -> TypeError
 *    `waitMs === 0` ist bewusst gueltig: dann laeuft der Aufruf ueber die
 *    normale Timer-Warteschlange (asynchron), aber ohne messbare Wartezeit.
 */

/**
 * Entprellt `fn`.
 *
 * @param {Function} fn Die Funktion, die entprellt aufgerufen werden soll.
 * @param {number} waitMs Wartezeit in Millisekunden (endlich, >= 0).
 * @param {{ setTimeout?: Function, clearTimeout?: Function }} [options]
 *        Optionaler Timer-Mechanismus. Default: globales setTimeout/clearTimeout.
 * @returns {Function} Entprellte Funktion mit zusaetzlicher Methode `cancel()`.
 */
export function debounce(fn, waitMs, options = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError(`fn muss eine Funktion sein, erhalten: ${typeof fn}`);
  }
  if (typeof waitMs !== 'number' || !Number.isFinite(waitMs) || waitMs < 0) {
    throw new RangeError(
      `waitMs muss eine endliche Zahl >= 0 sein, erhalten: ${String(waitMs)}`
    );
  }

  const { setTimeout: injectedSetTimeout, clearTimeout: injectedClearTimeout } = options;

  if (injectedSetTimeout !== undefined && typeof injectedSetTimeout !== 'function') {
    throw new TypeError(
      `options.setTimeout muss eine Funktion sein, erhalten: ${typeof injectedSetTimeout}`
    );
  }
  if (injectedClearTimeout !== undefined && typeof injectedClearTimeout !== 'function') {
    throw new TypeError(
      `options.clearTimeout muss eine Funktion sein, erhalten: ${typeof injectedClearTimeout}`
    );
  }

  // Default bewusst ueber Wrapper-Funktionen, damit das globale setTimeout
  // nicht "unbound" aufgerufen wird.
  const schedule = injectedSetTimeout ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
  const unschedule = injectedClearTimeout ?? ((id) => globalThis.clearTimeout(id));

  let timerId = null;
  let pendingArgs = null;
  let generation = 0;

  function debounced(...args) {
    // Nur der letzte Aufruf zaehlt: Argumente uebernehmen und das Wartefenster
    // neu starten (alten Timer verwerfen).
    pendingArgs = args;
    generation += 1;
    const myGeneration = generation;

    if (timerId !== null) {
      unschedule(timerId);
      timerId = null;
    }

    timerId = schedule(() => {
      // Token-Pruefung: verworfene (oder durch einen neueren Aufruf
      // ersetzte) Timer duerfen fn nicht mehr erreichen.
      if (myGeneration !== generation) {
        return;
      }

      // Zustand VOR dem Aufruf zuruecksetzen, damit ein erneuter Aufruf aus fn
      // heraus nicht mit den alten Argumenten kollidiert.
      const callArgs = pendingArgs;
      timerId = null;
      pendingArgs = null;

      fn(...callArgs);
    }, waitMs);
  }

  /**
   * Verwirft einen anstehenden, noch nicht ausgefuehrten Aufruf. Ohne
   * anstehenden Aufruf passiert nichts. Die entprellte Funktion bleibt danach
   * normal weiterbenutzbar.
   */
  debounced.cancel = function cancel() {
    if (timerId !== null) {
      unschedule(timerId);
      timerId = null;
    }
    generation += 1;
    pendingArgs = null;
  };

  return debounced;
}
