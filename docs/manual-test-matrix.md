# Manuelle Testmatrix

Vor einer Testserie Backend und Expo-App neu starten. Für jede Bildklasse die
drei Einstiege **direkt lösen**, **Was steht dort?** und **eigene Sprachfrage**
prüfen. Keine vertraulichen Dokumente für Testaufnahmen verwenden.

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
  einer Matrix prüfen.
- Kontrollieren, dass TTS verständlichen Text statt roher LaTeX-Befehle vorliest.
- Neue strukturierte und alte reine Textantworten aus dem Verlauf öffnen.
- Kompakte Code- beziehungsweise Formelkarte im simulierten Brillendisplay prüfen.
- Bei einer längeren Codeantwort kontrollieren: Kurzantwort zuerst, Hinweis
  „Tippen für Code“, höchstens fünf Codezeilen je Karte und korrekter Fortschritt.
- Tippen, links/rechts wischen, Navigationstasten und langes Drücken testen.
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
