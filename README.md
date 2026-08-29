# AR Answer

Ein hardwareunabhängiger MVP für eine Display-Brille: Foto aufnehmen, eine klar
sichtbare Aufgabe direkt lösen, den Inhalt mit „Was steht dort?“ erfassen oder
optional eine eigene Frage sprechen. Folgefragen verwenden dasselbe Bild.

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

1. Foto bewusst per Taste aufnehmen und das Dokument innerhalb des Rahmens halten.
2. Zwischen direkter Lösung, **Was steht dort?** und einer eigenen Sprachfrage
   wählen. Der Auswahlbildschirm lässt sich in den Einstellungen deaktivieren.
3. Eine Hörprobe befindet sich im Tab **Einstellungen**; die Lautstärke wird mit
   den Lauter-/Leiser-Tasten des Handys geregelt.
4. Text- oder Sprachfolgefragen beziehen sich auf das letzte Foto. Sind mehrere
   Aufgaben sichtbar, listet der Assistent sie zuerst zur Auswahl auf.
5. Bei unleserlichem Inhalt zeigt die App einen konkreten Aufnahmehinweis.

Der lokale Verlauf enthält ausschließlich Frage und Antwort. Einzelne Einträge
oder der gesamte Verlauf lassen sich löschen. **Bild und Sitzungskontext löschen**
entfernt den aktuellen flüchtigen Bildkontext sofort vom Backend.

## API

- `POST /v1/queries`: multipart mit `image`, optional `audio`, `question`,
  `ocrText`, `locale` und `sessionId`.
- `POST /v1/queries/:id/follow-ups`: JSON mit `question` und optional `locale`
  oder multipart mit `audio` und `locale` für gesprochene Folgefragen.
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
