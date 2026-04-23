# Checklist: Parkinson Visitentypen

## DB-Initialisierung
- [ ] App starten / DB neu initialisieren — Migration 007 läuft ohne Fehler
- [ ] In den DB-Einstellungen: alter `parkinson` Visit Type ist weg, `parkinson_erst` und `parkinson_verlauf` sind vorhanden
- [ ] 3 neue Fragebögen sichtbar: HADS, Bain Tremor, MDT (insgesamt 29 Questionnaires)

## Parkinson Erstvorstellung
- [ ] Neue Visite anlegen → "Parkinson Erstvorstellung" als Typ wählbar (icon: psychology, lila)
- [ ] Field Sets korrekt aktiviert: Klinische Beurteilung, Medikation, Körperliche Untersuchung, Fragebögen/Scores
- [ ] Vitals und Labor als inaktive (optionale) Field Sets vorhanden
- [ ] Fragebogen hinzufügen → "Empfohlen"-Section mit 14 Fragebögen oben (UPDRS I-IV, Hoehn&Yahr, Schwab&England, MoCA, BDI-2, HADS, NMS-Quest, PDQ-8, RBD-SQ, PDSS-2, Bain Tremor)
- [ ] Empfohlene Fragebögen haben lila "Empfohlen"-Chip
- [ ] Darunter "Alle Fragebögen" mit den restlichen

## Parkinson Verlaufskontrolle
- [ ] Neue Visite anlegen → "Parkinson Verlaufskontrolle" wählbar (icon: update, teal)
- [ ] Field Sets: Medikation, Verlaufsparameter/Fragebögen, Klinische Beurteilung aktiv
- [ ] Fragebogen hinzufügen → andere Empfehlungen (11 Stück: UPDRS III+IV, Hoehn&Yahr, Schwab&England, WOQ-9, BDI-2, PHQ-9, PDQ-8, NMS-Quest, PDSS-2, MDT)

## Neue Fragebögen
- [ ] HADS ausfüllbar — 14 Items, Score wird korrekt berechnet (Summe 0-42)
- [ ] Bain Tremor Scale ausfüllbar — 9 Items, 0-10 Skala, Summe korrekt
- [ ] MDT ausfüllbar — 12 Items, Summe korrekt

## Regression
- [ ] Bestehende Visit Types (Routine, Follow-up, Consultation, Emergency, Procedure) funktionieren weiterhin
- [ ] Bei diesen Typen: Fragebogen-Dialog zeigt keine "Empfohlen"-Section
- [ ] Suche im Fragebogen-Dialog funktioniert (durchsucht alle, nicht nur empfohlene)
- [ ] Bereits hinzugefügter Fragebogen wird als "Bereits hinzugefügt" markiert

## Quick Templates
- [ ] Bei "Neue Visite" → Quick Templates: "Parkinson Erstvorstellung" und "Parkinson Verlaufskontrolle" statt altem "Parkinson Assessment"
