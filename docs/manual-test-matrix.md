# Manuelle Testmatrix

Vor einer Testserie Backend und Expo-App neu starten. Keine vertraulichen
Dokumente für Testaufnahmen verwenden.

## Eingabemodi

- Auf dem Startbildschirm müssen **Entdecken**, **Aufgabe lösen**, **Lesen &
  Verstehen** und **Frage stellen** als vier eigenständige Aktionen sichtbar sein.
- Im Modus **Entdecken** eine Pflanze, Schale Nüsse oder Statue fotografieren.
  Nach dem Foto dürfen nur **Informationen anzeigen**, **Eigene Frage zum Foto**
  und **Foto erneut aufnehmen** angeboten werden.
- Die Entdecken-Antwort muss Name, Kategorie, Beschreibung und zwei bis vier
  Nice-to-know-Fakten enthalten. Bei Pflanzen, Pilzen oder Lebensmitteln muss ein
  angemessener Sicherheitshinweis erscheinen; unsichere Alternativen sind als
  solche zu kennzeichnen.
- Im Modus **Aufgabe lösen** müssen **Alle sichtbaren Aufgaben lösen** und die
  gezielte Frage zum Foto erscheinen. Eine Objekt-Infobox darf hier nicht den
  Aufgabenvertrag ersetzen.
- Im Modus **Lesen & Verstehen** eine Slide und ein Dokument testen. Nach dem Foto
  müssen **Kurz zusammenfassen**, **Text wiedergeben** und **Eigene Frage zum
  Inhalt** erscheinen. Eine sichtbare Übungsfrage darf nicht ungefragt gelöst
  werden. Titel, Kernaussagen und relevante Diagramm- oder Tabelleninformationen
  müssen getrennt erhalten bleiben.
- **Frage stellen** darf weder Kamera noch Fotoaktionen öffnen. Aufnahme,
  Transkriptprüfung und Korrektur müssen weiterhin funktionieren.
- Foto wiederholen und Folgefrage senden; der ursprünglich gewählte Modus muss
  jeweils erhalten bleiben.
- Nach einer Bildantwort „Warum ist das interessant?“ fragen; das Backend darf das
  Bild nicht erneut an die Modellpipeline geben. Danach nach Farbe, Position oder
  einer Tabellenzeile fragen; hierfür muss der unveränderte flüchtige Bildpuffer
  erneut verwendet werden.

## Deterministische Verifikation

- Eine direkt berechenbare Aufgabe wie `2+2` stellen und prüfen, dass Ergebnis und
  strukturierte Rechenkarte übereinstimmen.
- Eine absichtlich manipulierte Testantwort mit falschem numerischem Ergebnis muss
  serverseitig als ungültig abgelehnt werden.
- Eine ausdrücklich benannte Methode anfordern; genau eine vollständige Einheit
  mit balancierten Klammern muss zurückkommen.
- Fehlende angeforderte Methoden oder abgeschnittene Bodies müssen als ungültiges
  Antwortformat behandelt werden.
- Eine zeitstabile Wissensfrage stellen und prüfen, dass kein Webwerkzeug angeboten
  wird. Anschließend dieselbe Frage mit „aktuell“ oder „heute“ stellen; die Antwort
  muss eine knappe Quelle nennen und darf höchstens zwei Webaufrufe verwenden.

## Dokumente und Aufnahmebedingungen

| Material | Erwartung |
| --- | --- |
| Klare gedruckte Seite | Sichtbare Frage korrekt und mit passender Textstelle beantworten |
| Präsentationsfolie | Überschrift, Kernaussage und Diagrammbezug erfassen |
| Eine Aufgabe mit a), b), c) | Alle zusammenhängenden Unterfragen beantworten |
| Mehrere unabhängige Aufgaben | Aufgaben zuerst nummerieren; keine beliebige auswählen |
| Tabelle | Zeilen- und Spaltenbezug in der Antwort nennen |
| Diagramm | Achsen, Legende und sichtbare Entwicklung berücksichtigen |
| Handschrift | Nur sicher lesbare Inhalte verwenden, sonst neue Aufnahme verlangen |
| Schräges Foto | Entweder korrekt antworten oder den Winkel konkret beanstanden |
| Spiegelung/Blendung | Keine verdeckten Werte erfinden; Reflexion als Ursache nennen |
| Kleine Schrift | Näher herangehen oder einen kleineren Ausschnitt empfehlen |
| Abgeschnittener Inhalt | Fehlenden Bereich benennen und neue Aufnahme verlangen |

## Antwortdarstellung

- Reine Textantwort mit Überschrift, Liste, Fettschrift und Inline-Code prüfen.
- Codeantwort in mindestens Python und TypeScript prüfen; lange Zeilen müssen
  horizontal scrollbar und der Code markierbar sein.
- Formeln mit `\\frac`, `\\sum`, `\\int`, `\\sqrt`, Hoch-/Tiefstellungen und
  einer Matrix prüfen. Mehrzeilige `aligned`-Formeln dürfen keine sichtbaren
  LaTeX-Befehle wie `beginaligned` enthalten.
- Mathefotos mit Labels `a)`, `1)`, `150)`, `Frage 2)` und `Aufgabe 7a` prüfen:
  Labels müssen in Ergebnis, Lösungsweg und **Erkannt** exakt erhalten bleiben.
- Bei aktiviertem **Lösungsweg anzeigen** prüfen: Ergebnis zuerst, anschließend
  eine kompakte Aufgabenkarte je Teilaufgabe mit einem Zustand pro Zeile und
  zuletzt **Erkannt** mit allen gelösten Ausgangsaufgaben.
- Bei deaktiviertem Lösungsweg dürfen nur Ergebnis und **Erkannt** erscheinen;
  keine Lösungsweg-, allgemeine Formel- oder „Warum?“-Karte.
- Operationen wie `ausmult.`, `−20x²` oder `÷(−7)` müssen eindeutig neben dem
  zugehörigen neuen Zustand stehen; mehrere Zustände dürfen nicht mit `⇒` in
  eine Zeile gepresst werden.
- `\\boxed`, `beginaligned` und andere rohe LaTeX-Befehle dürfen im Display nicht
  sichtbar sein.
- Bei Code prüfen: Ausgabe beziehungsweise Resultat zuerst, danach relevante
  Ablaufstufen; bei Dokumenten Fundstelle vor Interpretation anzeigen.
- Eine Aufgabe mit mindestens drei Methoden prüfen: Jede Methode muss mit ihrem
  vollständigen Body und ihrer Erklärung zusammenbleiben. Methodenköpfe dürfen
  nicht gesammelt vor den späteren Bodies erscheinen.
- Methodencode im Brillendisplay vertikal scrollen und danach horizontal zur
  nächsten Methode wechseln. Eine vertikale Geste darf keine Karte weiterschalten.
- In den Einstellungen nacheinander **Zeilenweise**, **Smooth Snap** und
  **Fließend** wählen: direktes Springen, animiertes Einrasten und pixelgenaues
  Scrollen mit kurzem Auslaufen müssen klar unterscheidbar sein.
- App neu laden und prüfen, dass die gewählte Scrollmethode erhalten bleibt.
- Code aus den Methodeneinheiten darf weder in späteren Brillenkarten noch in der
  Smartphone-Vertiefung ein zweites Mal vollständig erscheinen.
- Bei der Drei-Methoden-Aufgabe müssen nach der Kurzantwort genau drei getrennte
  Methodenkarten in Aufgabenreihenfolge folgen. Jede beginnt mit ihrer Deklaration,
  endet mit ihrer schließenden Klammer und ist vollständig vertikal scrollbar.
  Eine Sammelkarte „Methoden und Hilfsmethoden“ sowie eine zusätzliche
  „Warum?“-Karte dürfen nicht erscheinen.
- Jeder Lernschritt muss auf der Brille eine eigene Karte belegen. Direkte
  Wissensfragen dürfen ohne künstlichen Lösungsweg antworten.
- Kontrollieren, dass TTS verständlichen Text statt roher LaTeX-Befehle vorliest.
- Neue strukturierte und alte reine Textantworten aus dem Verlauf öffnen.
- Ausführliche Smartphone-Inhalte müssen unter **Details / Diagnose** zunächst
  eingeklappt sein und sich weiterhin öffnen lassen.
- Lernschritte müssen nach dem Speichern im Verlauf erhalten bleiben.
- Kompakte Code- beziehungsweise Formelkarte im simulierten Brillendisplay prüfen.
- Bei einer längeren Codeantwort kontrollieren: Kurzantwort zuerst, Hinweis
  „Nach links für Code“, höchstens fünf Codezeilen je Ansicht und korrekter Fortschritt.
- Links/rechts muss zwischen Karten wechseln; hoch/runter muss ausschließlich den
  Methodencode bewegen. Tippen und langes Drücken dürfen nichts auslösen.
- Lange Codezeilen dürfen keinen horizontalen Lauftext erzeugen; Fortsetzungen
  müssen mit `↳` und stabiler ursprünglicher Zeilennummer erkennbar sein.
- „Erkläre Zeile 8“ als Folgefrage stellen und den Bezug zum vollständigen Code
  kontrollieren.

## Navigation und Layout

- Startbildschirm darf die Kamera noch nicht anzeigen.
- Dokumentmodus muss Kamera und anschließend Fotovorschau öffnen.
- Abbruch aus Kamera, Aufnahme, Transkript und Antwort muss zum Start führen.
- Zwischen Assistent, Verlauf und Einstellungen wechseln und Zustand prüfen.

## Sprache und Kontext

- **Frage stellen – ohne Foto** testen und sicherstellen, dass keine
  Kameraberechtigung erforderlich ist.
- Nach einer allgemeinen Antwort eine kontextuelle Folgefrage wie „Erkläre das
  einfacher“ stellen.
- Deutsche, englische und gemischte Aufgaben testen.
- Eine undeutliche Sprachfrage muss zu einer Rückfrage oder verständlichen
  Fehlermeldung führen.
- Transkript vor dem Senden prüfen, manuell korrigieren und erneut aufnehmen.
- „Warum?“, „Löse Aufgabe 2“ und „Was steht rechts unten?“ jeweils als Text und
  Sprache testen.
- Prüfen, dass eine neue Aufnahme den alten Bildkontext ersetzt.
- Nach **Bild und Sitzungskontext löschen** darf keine Folgefrage mehr auf das
  vorherige Foto zugreifen.

## Einstellungen und Audio

- Automatische Sprachfrage, direkter Modus und Auswahl nach Foto testen.
- Vorlesen ein- und ausschalten.
- Nach einer Sprachfrage prüfen, dass Antwort und Hörprobe über den normalen
  Medien-/Lautsprecherpfad ausgegeben werden.
- Lauter-/Leiser-Tasten während der Hörprobe testen.
- Eine neue Aufnahme muss laufende Sprache stoppen.
- Unleserliche Aufnahmen dürfen nicht im Verlauf erscheinen.
- Einzelnes und vollständiges Löschen des Verlaufs prüfen.

## Fehlerfälle

- Backend ausschalten: verständliche Netzwerkmeldung und erfolgreiche
  Wiederholung nach dem Neustart erwarten.
- WLAN trennen und wieder verbinden.
- Kamera- und Mikrofonberechtigung ablehnen.
- Ungültigen Client-Token, tägliches Limit und abgelaufene Sitzung prüfen.
- Während der Verarbeitung mehrfach tippen; es darf nur eine Anfrage entstehen.

## MVP-Zielwerte

- Sichtbare Statusreaktion nach einer Aktion: unter 300 ms.
- Typische Gesamtantwort bei guter Verbindung: unter 5 s.
- Kurzantwort ohne Bedienung außerhalb der Assistentenansicht lesbar.
- Kein Foto in App-Verlauf, Logs oder persistenter Backend-Ablage.
