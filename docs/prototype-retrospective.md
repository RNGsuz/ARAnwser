# Prototyp-Retrospektive

Stand: 1. September 2026

## Ergebnis

AR Answer ist ein funktionsfähiger Proof of Concept für einen visuellen
Assistenten auf einer zukünftigen Display-Brille. Der Prototyp belegt, dass sich
bewusste Kameraaufnahme, automatische Moduswahl, Sprachfragen, strukturierte
KI-Antworten und eine kompakte Brillenansicht zu einem nutzbaren Ablauf verbinden
lassen.

Der aktuelle Stand ist kein fertiges Produkt, aber ein erfolgreiches Programm
mit einer klaren Produktrichtung und einer belastbaren Grundlage für spätere
Rokid- oder Android-XR-Hardware.

## Besonders gelungen

- Die Pipeline unterscheidet Entdecken, Lesen und Aufgabenlösen und verwendet
  dafür getrennte Antwortverträge und Verarbeitungsregeln.
- Codeantworten bleiben in vollständigen, getrennt scrollbar dargestellten
  Einheiten zusammen.
- Mathematische Lösungswege sind nachvollziehbar und didaktisch brauchbar.
- Objekterkennung liefert kompakte Beschreibungen, Alternativen,
  Sicherheitshinweise und nützliche Nice-to-knows.
- Spracheingaben werden vor dem Absenden transkribiert und können korrigiert
  werden.
- Modell-, Reasoning- und Werkzeugauswahl sind im Diagnosebereich sichtbar.
- Fotos bleiben flüchtig und werden weder im Verlauf noch dauerhaft im Backend
  gespeichert.
- Expo-App und Fastify-Backend bleiben unabhängig von einer konkreten
  Brillenhardware testbar.

## Bekannte Grenzen

- Die mathematische Darstellung nutzt den knappen Displayplatz noch nicht
  konsequent genug, obwohl die inhaltlichen Lösungswege bereits gut sind.
- Folgefragen und die Auswahl mehrerer Aufgaben funktionieren, beruhen aber noch
  teilweise auf Sprachmustern statt auf stabilen strukturierten Aufgaben-IDs.
- Informationsfolien werden nicht immer so zuverlässig erkannt und erklärt wie
  Objekte oder klar formulierte Aufgaben.
- Das simulierte Brillendisplay verschwendet bei manchen Antworttypen Platz oder
  verteilt Inhalte ungünstig auf Karten.
- Lokale OCR ist im Expo-Go-Prototyp noch nicht integriert.
- Der In-Memory-Sitzungsspeicher und das gemeinsame Client-Token sind für einen
  lokalen Prototyp geeignet, aber noch keine Produktionsarchitektur.

## Sinnvolle nächste Schritte

1. Strukturierte Auswahloptionen mit stabilen Aufgaben-IDs statt wachsender
   Sprachmuster einführen.
2. Fotografierte Aufgaben zusätzlich als Mathematik, Code oder Text
   klassifizieren und das Modellrouting daran ausrichten.
3. Mathematik- und Folienkarten mit einem festen Platzbudget für das reale
   Sichtfeld gestalten.
4. Einen kleinen repräsentativen Bilddatensatz für wiederholbare Qualitäts- und
   Latenztests anlegen.
5. Für das Homelab Authentifizierung, HTTPS, Prozessbetrieb, Monitoring und einen
   TTL-basierten Sitzungsspeicher festlegen.
6. Erst danach einen Hardwareadapter für Rokid oder Android XR entwickeln.

## Fazit

Der Prototyp hat die technische und inhaltliche Machbarkeit der Idee bestätigt.
Seine offenen Punkte sind konkrete Produkt- und Qualitätsfragen, keine
grundsätzlichen Blocker. Der aktuelle Stand eignet sich als eingefrorener
Meilenstein, auf den nach der Homelab- und Hardwareentscheidung gezielt aufgebaut
werden kann.
