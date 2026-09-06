import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket } from './rateLimiter.js';

// Manuell steuerbare Uhr: statt echt zu warten, springt die Zeit nur, wenn der
// Test sie explizit vorwaerts bewegt. So lassen sich Refill-Berechnungen
// deterministisch pruefen, ohne dass die Tests auch nur eine Millisekunde
// schlafen muessen.
function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
    set: (ms) => {
      time = ms;
    },
  };
}

// --- Konstruktor-Validierung ---

test('Konstruktor wirft RangeError bei capacity <= 0', () => {
  assert.throws(() => new TokenBucket({ capacity: 0, refillRatePerSecond: 1 }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: -5, refillRatePerSecond: 1 }), RangeError);
});

test('Konstruktor wirft RangeError bei nicht-endlicher capacity (NaN, Infinity)', () => {
  assert.throws(() => new TokenBucket({ capacity: NaN, refillRatePerSecond: 1 }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: Infinity, refillRatePerSecond: 1 }), RangeError);
});

test('Konstruktor wirft RangeError bei refillRatePerSecond < 0', () => {
  assert.throws(() => new TokenBucket({ capacity: 10, refillRatePerSecond: -1 }), RangeError);
});

test('Konstruktor wirft RangeError bei nicht-endlicher refillRatePerSecond', () => {
  assert.throws(() => new TokenBucket({ capacity: 10, refillRatePerSecond: NaN }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: 10, refillRatePerSecond: Infinity }), RangeError);
});

test('Konstruktor wirft TypeError bei nicht-Funktion now', () => {
  assert.throws(() => new TokenBucket({ capacity: 10, refillRatePerSecond: 1, now: 1234 }), TypeError);
});

test('refillRatePerSecond === 0 ist gueltig', () => {
  const clock = makeClock(1000);
  const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 0, now: clock.now });
  // Kein Fehler beim Anlegen, Bucket startet voll.
  assert.equal(bucket.availableTokens(), 5);
});

// --- Grundverhalten ---

test('Bucket startet voll', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 7, refillRatePerSecond: 2, now: clock.now });
  assert.equal(bucket.availableTokens(), 7);
});

test('tryConsume verbraucht Tokens und gibt true/false korrekt zurueck', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 1, now: clock.now });

  assert.equal(bucket.tryConsume(3), true);
  assert.equal(bucket.availableTokens(), 2);
  assert.equal(bucket.tryConsume(2), true);
  assert.equal(bucket.availableTokens(), 0);
  assert.equal(bucket.tryConsume(1), false);
  assert.equal(bucket.availableTokens(), 0);
});

test('tryConsume(n) nutzt Default n = 1', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 3, refillRatePerSecond: 1, now: clock.now });
  assert.equal(bucket.tryConsume(), true);
  assert.equal(bucket.availableTokens(), 2);
});

test('tryConsume wirft RangeError bei n <= 0', () => {
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 1 });
  assert.throws(() => bucket.tryConsume(0), RangeError);
  assert.throws(() => bucket.tryConsume(-3), RangeError);
});

test('tryConsume wirft RangeError bei nicht-endlichem n (NaN, Infinity)', () => {
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 1 });
  assert.throws(() => bucket.tryConsume(NaN), RangeError);
  assert.throws(() => bucket.tryConsume(Infinity), RangeError);
  assert.throws(() => bucket.tryConsume('zwei'), RangeError);
});

test('bei false bleibt der Tokenstand unveraendert', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 1, now: clock.now });

  assert.equal(bucket.tryConsume(2), true); // Stand: 3
  assert.equal(bucket.tryConsume(9), false); // 9 > 3 -> abgelehnt
  assert.equal(bucket.availableTokens(), 3, 'Stand darf sich durch abgelehntes tryConsume nicht aendern');
});

// --- Refill-Verhalten ---

test('Bucket fuellt sich ueber Zeit bis zur capacity wieder auf', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 2, now: clock.now });

  assert.equal(bucket.tryConsume(10), true); // leer
  assert.equal(bucket.availableTokens(), 0);

  clock.advance(2500); // 2.5s * 2 Tokens/s = 5 Tokens
  assert.equal(bucket.availableTokens(), 5);

  assert.equal(bucket.tryConsume(5), true);
  assert.equal(bucket.availableTokens(), 0);
});

test('Nachfuellen fuellt nie ueber capacity hinaus, auch nach sehr langer Zeit', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 1, now: clock.now });

  assert.equal(bucket.tryConsume(10), true); // leer
  // 10 Jahre spaeter: weit mehr als 10 Tokens waeren nachgeflossen.
  clock.advance(10 * 365 * 24 * 60 * 60 * 1000);
  assert.equal(bucket.availableTokens(), 10, 'Stand ist auf capacity gedeckelt');
});

test('Nachfuellen ist auch bei bereits vollem Bucket auf capacity gedeckelt', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 3, now: clock.now });

  // Bucket ist noch voll; selbst nach sehr langer Zeit darf der Stand nicht
  // ueber capacity hinauswachsen.
  clock.advance(60_000);
  assert.equal(bucket.availableTokens(), 5);
});

test('refillRatePerSecond = 0 fuellt den Bucket nie wieder auf', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 3, refillRatePerSecond: 0, now: clock.now });

  assert.equal(bucket.tryConsume(3), true); // alles verbraucht
  assert.equal(bucket.availableTokens(), 0);
  clock.advance(10 * 365 * 24 * 60 * 60 * 1000); // sehr lange Zeit
  assert.equal(bucket.availableTokens(), 0, 'Refill-Rate 0 darf nie nachfuellen');
  assert.equal(bucket.tryConsume(1), false);
});

// --- Kein Doppelzaehlen / Uhr-Verhalten ---

test('zwei tryConsume-Aufrufe ohne Zeitfortschritt verbrauchen nicht mehr als vorhanden', () => {
  const clock = makeClock(1000);
  const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 100, now: clock.now });

  // Ohne Zeitfortschritt darf die hohe Refill-Rate nicht doppelt gutgeschrieben
  // werden: Beide Aufrufe sehen exakt denselben Stand.
  assert.equal(bucket.tryConsume(3), true); // 3 verbraucht -> 2 uebrig
  assert.equal(bucket.tryConsume(3), false); // kein Zeitfortschritt -> immer noch nur 2
  assert.equal(bucket.availableTokens(), 2);
});

test('availableTokens() ohne Zeitfortschritt verbraucht nichts und zaehlt nichts doppelt', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 4, refillRatePerSecond: 100, now: clock.now });

  assert.equal(bucket.tryConsume(4), true); // leer
  assert.equal(bucket.availableTokens(), 0);
  assert.equal(bucket.availableTokens(), 0, 'kein Zeitfortschritt -> kein Refill, kein Verbrauch');
  assert.equal(bucket.tryConsume(1), false);
});

test('verstrichene Refill-Zeit wird nur einmal gutgeschrieben (kein Doppelzaehlen)', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 1, now: clock.now });

  assert.equal(bucket.tryConsume(10), true); // leer, letzter Refill bei t=0
  clock.advance(2000); // +2s

  // Erster Aufruf bei t=2000: schreibt 2 Tokens gut und setzt _lastRefillAt auf 2000.
  assert.equal(bucket.availableTokens(), 2);

  // Zweiter Aufruf, wieder bei t=2000 (kein Fortschritt): dieselben 2 Sekunden
  // duerfen NICHT erneut gutgeschrieben werden -> weiterhin genau 2.
  assert.equal(bucket.availableTokens(), 2);

  // Erst nach erneutem Fortschritt kommen weitere Tokens dazu.
  clock.advance(1000);
  assert.equal(bucket.availableTokens(), 3);
});

test('verbrauchte Tokens zaehlen nicht gegen den Refill (nur verbleibender Rest wird betrachtet)', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 2, now: clock.now });

  assert.equal(bucket.tryConsume(6), true); // 4 uebrig
  clock.advance(1000); // +1s -> 2 Tokens nachgefuellt, aber gedeckelt auf capacity
  assert.equal(bucket.availableTokens(), 6);
});

// --- availableTokens / Uhr rueckwaerts ---

test('availableTokens() aktualisiert den Stand, ohne zu verbrauchen', () => {
  const clock = makeClock(0);
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 1, now: clock.now });

  assert.equal(bucket.tryConsume(8), true); // 2 uebrig
  clock.advance(3000); // +3s -> 2 + 3 = 5
  assert.equal(bucket.availableTokens(), 5);

  // availableTokens hat nichts verbraucht.
  assert.equal(bucket.availableTokens(), 5);
  assert.equal(bucket.tryConsume(5), true);
  assert.equal(bucket.tryConsume(1), false);
});

test('rueckwaerts laufende Uhr fuellt nichts nach und verbraucht nichts', () => {
  const clock = makeClock(5000);
  const bucket = new TokenBucket({ capacity: 10, refillRatePerSecond: 1, now: clock.now });

  assert.equal(bucket.tryConsume(4), true); // 6 uebrig, _lastRefillAt = 5000
  clock.set(2000); // Uhr springt zurueck
  assert.equal(bucket.availableTokens(), 6, 'kein negativer Refill bei zuruecklaufender Uhr');
  assert.equal(bucket.tryConsume(6), true);
});

// --- Default-Uhr (Date.now) ---

test('funktioniert auch ohne injizierte now-Funktion (Default Date.now)', () => {
  const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 1 });
  assert.equal(bucket.availableTokens(), 5);
  assert.equal(bucket.tryConsume(2), true);
});
