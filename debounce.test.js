import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from './debounce.js';

// --- Fake-Timer: deterministisch, ohne echte Wartezeit ---------------------
//
// Statt echt zu warten, laeuft die Zeit nur, wenn der Test sie explizit
// vorwaerts bewegt (analog zur injizierten Uhr in rateLimiter.test.js). Der
// Timer-Mechanismus selbst ist ebenfalls gefakt: setTimeout legt Callbacks in
// eine Map, advance() fuehrt die faelligen Callbacks in Reihenfolge ihrer
// Ausfuehrungszeit (bei Gleichstand in Anlage-Reihenfolge) aus. Dadurch ist
// jeder Testlauf bit-identisch und es wird nie eine Millisekunde geschlafen.
function makeFakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map(); // id -> { callback, runAt }

  return {
    setTimeout(callback, ms) {
      const id = nextId++;
      pending.set(id, { callback, runAt: now + ms });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    now: () => now,
    pendingCount: () => pending.size,
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const [id, entry] of pending) {
          if (entry.runAt > target) continue;
          if (
            next === null ||
            entry.runAt < next.entry.runAt ||
            (entry.runAt === next.entry.runAt && id < next.id)
          ) {
            next = { id, entry };
          }
        }
        if (next === null) break;
        pending.delete(next.id);
        now = next.entry.runAt;
        next.entry.callback();
      }
      now = target;
    },
  };
}

// Liefert Fake-Timer plus das passende options-Objekt fuer debounce().
function makeTimerHarness() {
  const timers = makeFakeTimers();
  return {
    timers,
    options: { setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout },
  };
}

// Sammelt alle Aufrufe von fn inklusive Argumenten.
function makeRecorder() {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return args.length;
  };
  return { fn, calls };
}

const WAIT = 100;

// --- Signatur / Rueckgabe --------------------------------------------------

test('gibt eine Funktion zurueck (kein Promise) mit cancel-Methode', () => {
  const { timers, options } = makeTimerHarness();
  const { fn } = makeRecorder();

  const debounced = debounce(fn, WAIT, options);

  assert.equal(typeof debounced, 'function');
  assert.equal(typeof debounced.cancel, 'function');
  // Nichts angesetzt, solange nicht aufgerufen wurde.
  assert.equal(timers.pendingCount(), 0);
});

test('der Aufruf der entprellten Funktion liefert kein Promise', () => {
  const { options } = makeTimerHarness();
  const { fn } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  const result = debounced('a');

  assert.equal(result, undefined, 'Rueckgabe ist undefined, kein Promise');
  assert.equal(result instanceof Promise, false);
});

test('ohne injizierten Timer ist das Ergebnis trotzdem einsatzbereit', () => {
  // Bewusst OHNE Aufruf: hier wuerde sonst ein echter Timer angesetzt und der
  // Test muesste real warten -- das ist in dieser Suite verboten.
  const debounced = debounce(() => {}, WAIT);
  assert.equal(typeof debounced, 'function');
  assert.equal(typeof debounced.cancel, 'function');
  assert.doesNotThrow(() => debounced.cancel());
});

// --- Kernverhalten: genau ein Aufruf, letzte Argumente ---------------------

test('mehrere Aufrufe innerhalb des Wartefensters loesen genau einen Aufruf aus', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  // Fuenf Aufrufe, jeweils innerhalb des Fensters.
  debounced(1);
  timers.advance(20);
  debounced(2);
  timers.advance(20);
  debounced(3);
  timers.advance(20);
  debounced(4);
  timers.advance(20);
  debounced(5);

  assert.equal(calls.length, 0, 'noch kein Aufruf: Fenster laeuft weiter');

  timers.advance(WAIT);

  assert.equal(calls.length, 1, 'genau ein Aufruf von fn');
});

test('der eine Aufruf erhaelt die Argumente des LETZTEN Aufrufs', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  debounced('erste');
  debounced('zweite', 2);
  debounced('letzte', 3, true);

  timers.advance(WAIT);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['letzte', 3, true]);
});

test('fn wird erst nach waitMs ohne weiteren Aufruf ausgefuehrt (Grenze exakt geprueft)', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  debounced('x');

  timers.advance(WAIT - 1);
  assert.equal(calls.length, 0, 'bei waitMs - 1 ms darf noch nichts passieren');

  timers.advance(1);
  assert.equal(calls.length, 1, 'genau bei waitMs wird ausgeloest');
  assert.deepEqual(calls[0], ['x']);
});

test('jeder neue Aufruf startet das Wartefenster neu', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  debounced('a');
  timers.advance(90); // fast abgelaufen
  debounced('b'); // setzt das Fenster zurueck

  timers.advance(90); // 180 ms seit dem ersten, aber nur 90 seit dem letzten Aufruf
  assert.equal(calls.length, 0, 'Fenster wurde durch den zweiten Aufruf neu gestartet');

  timers.advance(10); // 100 ms seit dem letzten Aufruf
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['b']);
});

test('auch 100 schnelle Aufrufe ergeben genau einen Aufruf mit den letzten Argumenten', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  for (let i = 0; i < 100; i++) {
    debounced(i);
  }
  assert.equal(timers.pendingCount(), 1, 'immer nur genau ein angesetzter Timer');

  timers.advance(WAIT);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [99]);
});

test('nach dem Ausloesen ist der Zustand zurueckgesetzt und das naechste Fenster frisch', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  debounced('erste');
  assert.equal(timers.pendingCount(), 1);

  timers.advance(WAIT);
  assert.equal(calls.length, 1);
  assert.equal(timers.pendingCount(), 0, 'kein Timer mehr angesetzt');

  // Ohne weiteren Aufruf darf sich nichts wiederholen.
  timers.advance(WAIT * 10);
  assert.equal(calls.length, 1);

  debounced('zweite');
  timers.advance(WAIT);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['zweite'], 'alte Argumente werden nicht wiederverwendet');
});

test('zwei entprellte Funktionen sind unabhaengig voneinander', () => {
  const a = makeTimerHarness();
  const b = makeTimerHarness();
  const recA = makeRecorder();
  const recB = makeRecorder();
  const debouncedA = debounce(recA.fn, WAIT, a.options);
  const debouncedB = debounce(recB.fn, WAIT, b.options);

  debouncedA('a1');
  debouncedA('a2');
  debouncedB('b1');

  // Nur der Timer von A wird abgelaufen.
  a.timers.advance(WAIT);
  assert.deepEqual(recA.calls, [['a2']]);
  assert.equal(recB.calls.length, 0);

  b.timers.advance(WAIT);
  assert.deepEqual(recB.calls, [['b1']]);
});

test('waitMs = 0 ist gueltig und loest genau einen Aufruf aus', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, 0, options);

  debounced('a');
  debounced('b');
  assert.equal(calls.length, 0);

  timers.advance(0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['b']);
});

// --- cancel() --------------------------------------------------------------

test('cancel() verwirft einen anstehenden Aufruf vollstaendig', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  debounced('a');
  assert.equal(timers.pendingCount(), 1);

  debounced.cancel();
  assert.equal(timers.pendingCount(), 0, 'Timer wurde verworfen');

  timers.advance(WAIT * 100);
  assert.equal(calls.length, 0, 'fn wurde nie aufgerufen');
});

test('cancel() ist ohne anstehenden Aufruf ein No-op', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  assert.doesNotThrow(() => debounced.cancel());
  assert.doesNotThrow(() => debounced.cancel());
  assert.equal(timers.pendingCount(), 0);

  timers.advance(WAIT);
  assert.equal(calls.length, 0);
});

test('nach cancel() ist die entprellte Funktion weiterbenutzbar (frisches Fenster)', () => {
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  debounced('verworfen');
  debounced.cancel();

  debounced('gueltig');
  timers.advance(WAIT);

  assert.equal(calls.length, 1, 'nur der Aufruf nach cancel() zaehlt');
  assert.deepEqual(calls[0], ['gueltig']);
});

test('cancel() verwirft auch dann, wenn der Timer clearTimeout ignoriert (Token-Schutz)', () => {
  // Absichtlich naiver Timer: clearTimeout ist ein No-op, die Callbacks
  // bleiben also in der Warteschlange stehen -- genau der Fall, in dem ein
  // reines clearTimeout den verworfenen Aufruf nicht verhindern koennte.
  const queue = [];
  const naiveOptions = {
    setTimeout(callback) {
      queue.push(callback);
      return queue.length;
    },
    clearTimeout() {
      // absichtlich leer
    },
  };
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, naiveOptions);

  debounced('verworfen');
  assert.equal(queue.length, 1);

  debounced.cancel();
  assert.equal(queue.length, 1, 'naiver Timer kennt kein Abbrechen');

  // Alle stehengebliebenen Callbacks ausfuehren: es darf nichts passieren.
  for (const callback of queue.splice(0, queue.length)) {
    callback();
  }
  assert.equal(calls.length, 0, 'verworfener Aufruf erreicht fn nicht');
});

test('ersetzte Timer fuehren auch bei naivem Timer nicht zu Doppelaufrufen', () => {
  const queue = [];
  const naiveOptions = {
    setTimeout(callback) {
      queue.push(callback);
      return queue.length;
    },
    clearTimeout() {
      // absichtlich leer
    },
  };
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, naiveOptions);

  debounced('alte');
  debounced('neue');

  for (const callback of queue.splice(0, queue.length)) {
    callback();
  }

  assert.equal(calls.length, 1, 'nur der letzte Aufruf loest aus');
  assert.deepEqual(calls[0], ['neue']);
});

// --- Validierung (fail-fast, analog zu rateLimiter.js) ---------------------

test('wirft TypeError, wenn fn keine Funktion ist', () => {
  assert.throws(() => debounce(undefined, WAIT), TypeError);
  assert.throws(() => debounce(null, WAIT), TypeError);
  assert.throws(() => debounce('keine Funktion', WAIT), TypeError);
  assert.throws(() => debounce({}, WAIT), TypeError);
});

test('wirft RangeError bei ungueltigem waitMs', () => {
  const { fn } = makeRecorder();
  assert.throws(() => debounce(fn, -1), RangeError);
  assert.throws(() => debounce(fn, NaN), RangeError);
  assert.throws(() => debounce(fn, Infinity), RangeError);
  assert.throws(() => debounce(fn, '100'), RangeError);
  assert.throws(() => debounce(fn), RangeError);
});

test('wirft TypeError bei ungueltigem injiziertem Timer', () => {
  const { fn } = makeRecorder();
  assert.throws(() => debounce(fn, WAIT, { setTimeout: 123 }), TypeError);
  assert.throws(() => debounce(fn, WAIT, { clearTimeout: 'nein' }), TypeError);
});

// --- Guard: keine echte Wartezeit in dieser Suite --------------------------

test('diese Testsuite nutzt ausschliesslich injizierte Fake-Timer', () => {
  // Dokumentiert die Anforderung als Test: debounce() akzeptiert den
  // Timer-Mechanismus als Parameter, und die Tests oben rufen ihn immer mit
  // options auf -- es gibt in dieser Datei genau einen Aufruf ohne options,
  // und der loest bewusst keinen Timer aus.
  const { timers, options } = makeTimerHarness();
  const { fn, calls } = makeRecorder();
  const debounced = debounce(fn, WAIT, options);

  debounced('deterministisch');
  timers.advance(WAIT);

  assert.deepEqual(calls, [['deterministisch']]);
  assert.equal(timers.now(), WAIT);
});
