# AR Answer

Ein hardwareunabhängiger MVP für eine Display-Brille: Foto aufnehmen, eine Frage
sprechen und eine belegte Kurzantwort im simulierten Brillendisplay erhalten.

## Architektur

- `mobile/`: Expo/React-Native-Prototyp für Android und iOS mit Kamera,
  Aufnahme, TTS, Verlauf und Display-Simulator. Er läuft direkt in Expo Go.
- `backend/`: Fastify-API. Bilder bleiben nur kurz im RAM und werden nach Ablauf
  der Sitzung oder per DELETE entfernt. OpenAI-Aufrufe verwenden `store: false`.
- Die Adapter im Client trennen Kamera, Eingabe, Anzeige und Audio von der UI.
  Android XR und Rokid können dadurch später ohne Änderung des API-Vertrags
  ergänzt werden.

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

## API

- `POST /v1/queries`: multipart mit `image`, optional `audio`, `question`,
  `ocrText`, `locale` und `sessionId`.
- `POST /v1/queries/:id/follow-ups`: JSON mit `question` und optional `locale`.
- `DELETE /v1/sessions/:id`: entfernt Bild und Sitzung sofort.

Wenn `CLIENT_TOKEN` gesetzt ist, muss der Client `Authorization: Bearer …`
senden. Fotos werden nicht protokolliert oder auf Disk geschrieben. Der
In-Memory-Kontext ist bewusst nicht horizontal skalierbar; vor Produktion sollte
er durch einen verschlüsselten, TTL-basierten Objektspeicher ersetzt werden.
