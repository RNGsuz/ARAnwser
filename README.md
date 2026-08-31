# AR Answer

Ein hardwareunabhängiger MVP für eine Display-Brille mit drei bewussten
Einstiegen: Objekte per Foto entdecken, Aufgaben auf Dokumenten und Slides lösen
oder allgemeine Fragen ohne Foto sprechen. Folgefragen verwenden den letzten
flüchtigen Sitzungskontext.

## Architektur

- `mobile/`: Expo/React-Native-Prototyp für Android und iOS mit Kamera,
  optionaler Sprachaufnahme, TTS, Verlauf und Display-Simulator. Er läuft direkt
  in Expo Go.
- `backend/`: Fastify-API. Bilder bleiben nur kurz im RAM und werden nach Ablauf
  der Sitzung oder per DELETE entfernt. OpenAI-Aufrufe verwenden `store: false`.
- Der API-Vertrag ist hardwareunabhängig angelegt. Kamera, Eingabe, Anzeige und
  Audio werden vor einer Android-XR- oder Rokid-Anbindung in eigene Adapter
  ausgelagert.

## Backend starten

```bash
cp .env.example .env
npm install
npm run dev
```

Healthcheck: `GET http://localhost:3000/health`

## Expo-Prototyp starten

Handy und Entwicklungsrechner müssen im selben Netzwerk sein. Zuerst die
Konfiguration anlegen:

```bash
cd mobile
cp .env.example .env
npm install
npm start
```

Danach den QR-Code mit Expo Go scannen. `EXPO_PUBLIC_API_BASE_URL` muss auf die
LAN-Adresse des Rechners zeigen, nicht auf `localhost`. Für Produktion
ausschließlich HTTPS und echte Benutzer-Authentifizierung verwenden.

## Bedienung

Der Assistent beginnt mit vier klar getrennten Modi:

- **Entdecken** fotografiert ein Objekt, Tier, eine Pflanze, ein Kunstwerk,
  Lebensmittel oder eine Szene und erzeugt eine kompakte Infobox mit
  Identifikation, Beschreibung, Fakten, möglichen Alternativen und bei Bedarf
  einem Sicherheitshinweis.
- **Aufgabe lösen** verwendet den bestehenden Dokument-, Mathematik- und
  Codeablauf. Nach dem Foto können alle zusammengehörigen sichtbaren Aufgaben
  gelöst oder eine gezielte Sprachfrage zum Bild gestellt werden.
- **Lesen & Verstehen** fasst Slides, Dokumente, Tabellen und Diagramme zusammen,
  gibt sichtbaren Text originalgetreu wieder oder beantwortet eine gezielte Frage
  zum Inhalt, ohne Aufgaben ungefragt zu lösen.
- **Frage stellen** nimmt eine allgemeine Sprachfrage ohne Foto auf und zeigt vor
  dem Absenden das bearbeitbare Transkript.

Der Fotomodus bleibt für Folgefragen und erneute Aufnahmen erhalten. Die KI
entscheidet ihn nicht eigenmächtig.

1. Foto bewusst per Taste aufnehmen und das Dokument innerhalb des Rahmens halten.
2. Zwischen direkter Lösung, **Was steht dort?** und einer eigenen Sprachfrage
   wählen. Der Auswahlbildschirm lässt sich in den Einstellungen deaktivieren.
3. Eine Hörprobe befindet sich im Tab **Einstellungen**; die Lautstärke wird mit
   den Lauter-/Leiser-Tasten des Handys geregelt.
4. Nach einer Sprachfrage zeigt die App zunächst das Cloud-Transkript. Es kann vor
   dem Senden korrigiert oder neu aufgenommen werden.
5. Text- oder Sprachfolgefragen beziehen sich auf das letzte Foto. Sind mehrere
   unabhängige Aufgaben sichtbar, listet der Assistent sie zuerst zur Auswahl auf.
6. Bei unleserlichem Inhalt zeigt die App einen konkreten Aufnahmehinweis.

Alternativ startet **Frage stellen – ohne Foto** direkt eine allgemeine
Sprachfrage mit derselben Transkriptvorschau.

Antworten bestehen aus strukturierten Blöcken:

- Text mit Überschriften, Listen, Hervorhebungen und Inline-Code
- Code mit Sprachlabel, Monospace-Darstellung und horizontalem Scrollen
- Mathematik aus LaTeX, einschließlich Brüchen, Summen, Integralen, Wurzeln,
  Hoch-/Tiefstellungen und Matrizen

Der Startbildschirm hält Kamera und allgemeinen Fragemodus getrennt. Kamera,
Fotovorschau, Transkriptprüfung und Antwort sind eigene Ansichten. Gespeicherte
Antworten können im Tab **Verlauf** vollständig geöffnet werden; ältere
Textantworten bleiben kompatibel.

Das simulierte Brillendisplay zeigt Antworten als Kartenfolge. Die Kurzantwort
steht immer zuerst. Gewischt wird ausschließlich in vier Richtungen: nach links
zur nächsten Karte, nach rechts zur vorherigen sowie hoch und runter innerhalb
einer Codeeinheit. Tippen und langes Drücken haben im Display keine Funktion. Code wird auf
fünf Displayzeilen pro Karte umgebrochen und behält seine ursprünglichen
Zeilennummern. Dadurch funktionieren Folgefragen wie „Erkläre Zeile 8“ mit dem
vollständigen flüchtigen Codekontext.

Die Brillenausgabe ist der primäre Antwortvertrag. Bei fotografierter Mathematik
steht zuerst die kompakte Ergebnisübersicht. Danach folgt – sofern in den
Einstellungen aktiviert – eine kompakte Karte je original beschrifteter Aufgabe
mit genau einem mathematischen Zustand pro Zeile und einer kurzen Operation.
Zuletzt bestätigt **Erkannt** alle gelösten Ausgangsaufgaben. Sichtbare Labels wie
`a)`, `150)`, `Frage 2)` oder `Aufgabe 7a` bleiben unverändert und in
Dokumentreihenfolge; nur unbeschriftete Aufgaben erhalten ein erzeugtes Label.
Generische Formel- und „Warum?“-Karten werden für diese strukturierten
Matheantworten nicht zusätzlich erzeugt.

Die ausführliche Smartphone-Antwort ist als **Details / Diagnose** standardmäßig
eingeklappt. Sie bleibt für Kontrolle und spätere Verbesserung verfügbar, ist
aber gegenüber der Brillenansicht zweitrangig.

Bei Implementierungsaufgaben erscheint jede angeforderte Methode, Hilfsmethode,
Klasse oder Testeinheit in Aufgabenreihenfolge als eigene semantische Einheit.
Sie beginnt mit der vollständigen Deklaration und endet mit der zugehörigen
schließenden Klammer. Titel, vollständiger Code und Erklärung bleiben zusammen;
kombinierte Sammelblöcke und eine zusätzliche „Warum?“-Karte entfallen. Der Code
wird nicht nochmals in der Vertiefung dupliziert. Im simulierten
Brillendisplay lässt sich eine solche Einheit über ein Fünf-Zeilen-Fenster vertikal
scrollen; der horizontale Kartenwechsel führt zur nächsten beziehungsweise
vorherigen Einheit. Ältere
Antworten mit einem einzelnen Codeblock verwenden weiterhin die paginierten
Codekarten.

Unter **Einstellungen → Brillendisplay → Code-Scrolling** stehen drei lokal
gespeicherte Varianten zur Wahl: **Zeilenweise** springt direkt um vollständige
Zeilen, **Smooth Snap** folgt der Wischbewegung und rastet animiert auf einer
Zeile ein, **Fließend** bewegt den Code pixelgenau und berücksichtigt die
Wischgeschwindigkeit für ein kurzes Auslaufen.

Der lokale Verlauf enthält ausschließlich Frage und Antwort. Einzelne Einträge
oder der gesamte Verlauf lassen sich löschen. **Bild und Sitzungskontext löschen**
entfernt den aktuellen flüchtigen Bildkontext sofort vom Backend.

## API

- `POST /v1/queries`: multipart mit `image`, optional `audio`, `question`,
  `ocrText`, `locale`, `sessionId` und `includeSteps`.
- `POST /v1/questions`: JSON mit `question`, `locale`, `includeSteps` und optional `sessionId`
  für allgemeine Fragen ohne Foto.
- `POST /v1/transcriptions`: multipart mit `audio`; liefert die editierbare
  Textvorschau vor der eigentlichen Anfrage.
- `POST /v1/queries/:id/follow-ups`: JSON mit `question`, optional `locale` und
  `includeSteps` oder multipart mit `audio`, `locale` und `includeSteps` für
  gesprochene Folgefragen.
- `DELETE /v1/sessions/:id`: entfernt Bild und Sitzung sofort.

Wenn `CLIENT_TOKEN` gesetzt ist, muss der Client `Authorization: Bearer …`
senden. Fotos werden nicht protokolliert oder auf Disk geschrieben. Der
In-Memory-Kontext ist bewusst nicht horizontal skalierbar; vor Produktion sollte
er durch einen verschlüsselten, TTL-basierten Objektspeicher ersetzt werden.

## Prüfen

```bash
cd mobile && npm run typecheck
cd ../backend && npm test && npm run lint
```

Die manuelle Abnahme steht in
[`docs/manual-test-matrix.md`](docs/manual-test-matrix.md).
