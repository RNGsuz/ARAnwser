# Manuelle Testmatrix

Vor einer Testserie Backend und Expo-App neu starten. Für jede Bildklasse die
drei Einstiege **direkt lösen**, **Was steht dort?** und **eigene Sprachfrage**
prüfen. Keine vertraulichen Dokumente für Testaufnahmen verwenden.

## Dokumente und Aufnahmebedingungen

| Material | Erwartung |
| --- | --- |
| Klare gedruckte Seite | Sichtbare Frage korrekt und mit passender Textstelle beantworten |
| Präsentationsfolie | Überschrift, Kernaussage und Diagrammbezug erfassen |
| Mehrere Aufgaben | Aufgaben zuerst nummerieren; keine beliebige Aufgabe lösen |
| Tabelle | Zeilen- und Spaltenbezug in der Antwort nennen |
| Diagramm | Achsen, Legende und sichtbare Entwicklung berücksichtigen |
| Handschrift | Nur sicher lesbare Inhalte verwenden, sonst neue Aufnahme verlangen |
| Schräges Foto | Entweder korrekt antworten oder den Winkel konkret beanstanden |
| Spiegelung/Blendung | Keine verdeckten Werte erfinden; Reflexion als Ursache nennen |
| Kleine Schrift | Näher herangehen oder einen kleineren Ausschnitt empfehlen |
| Abgeschnittener Inhalt | Fehlenden Bereich benennen und neue Aufnahme verlangen |

## Sprache und Kontext

- Deutsche, englische und gemischte Aufgaben testen.
- Eine undeutliche Sprachfrage muss zu einer Rückfrage oder verständlichen
  Fehlermeldung führen.
- „Warum?“, „Löse Aufgabe 2“ und „Was steht rechts unten?“ jeweils als Text und
  Sprache testen.
- Prüfen, dass eine neue Aufnahme den alten Bildkontext ersetzt.
- Nach **Bild und Sitzungskontext löschen** darf keine Folgefrage mehr auf das
  vorherige Foto zugreifen.

## Einstellungen und Audio

- Automatische Sprachfrage, direkter Modus und Auswahl nach Foto testen.
- Vorlesen ein- und ausschalten.
- Lautstärke 25, 50, 75 und 100 Prozent inklusive Hörprobe vergleichen.
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
