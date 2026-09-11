# alex-controlled-agent-demo

Öffentliches, branch-geschütztes Demo-Repository für die [ALEX](https://bewusstki.de)
Dev-Task-Pipeline: eine kontrollierte KI-Agenten-Ausführung von Aufgabenstellung bis
geprüftem Pull Request, nachvollziehbar an echter Commit-/PR-Historie statt nur behauptet.

## Was hier passiert

Jede Aufgabe wird über die ALEX-Pilotoberfläche eingereicht, von der GitHub App
`alex-autonom` als eigenständiger Agent bearbeitet und als Pull Request zur menschlichen
Freigabe vorgelegt — nie automatisch gemergt. Jeder PR trägt den Vermerk
`Autonomously implemented by ALEX — Alex OS | Dev-Task: dt-...` und ist über die
Commit-Historie dieses Repos frei einsehbar.

## Dateien

- **`jobQueue.js`** / `jobQueue.test.js` — die eigentliche Übungsaufgabe: eine
  dateibasierte Job-Queue mit einer absichtlich eingebauten Race Condition in
  `claimNextJob()`. Ursprüngliche Aufgabenstellung: [ACCEPTANCE.md](ACCEPTANCE.md).
  Über mehrere Folgeaufgaben erweitert um Prioritäten (`high`/`normal`/`low`),
  Validierung und robustere Fehlerbehandlung — jede Änderung ein eigener, echter PR.
- **`jobQueueStats.js`** / Test — zählt offene/reservierte Jobs pro Priorität, als
  eigenständige Mehrdatei-Erweiterung auf Basis von `jobQueue.js`.
- **`mathUtils.js`**, **`stringUtils.js`** + Tests — unabhängige, in sich geschlossene
  Übungsaufgaben (Clamping bzw. Ellipsis-Kürzung) für einfachere Einzelaufgaben-Läufe.

## Bewusst kein Anspruch auf Produktionsreife

`jobQueue.js`s Sperre (`withJobQueueLock`) schützt nur innerhalb eines einzelnen
Node-Prozesses — das ist für diese sandboxed Single-Process-Übungsaufgabe korrekt und
ausreichend, aber **kein** produktionstauglicher Mehrprozess-/Mehrcontainer-Lock. Für
eine echte Job-Queue wäre eine Datenbank-Transaktion oder ein verteilter Lock nötig.

## Tests

Alle Tests laufen erfolgreich — inklusive `discount.js`.

```bash
npm test
```

Nutzt Node's eingebauten Testrunner, keine Installation nötig.

## Lizenz

MIT License. Siehe [LICENSE](LICENSE).

---

**Zuletzt aktualisiert:** 2026-08-31
**Von:** MERIDIAN
