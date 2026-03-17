# Über diese App

Diese App soll ein einfaches Ausfüllen von Online-Fragebögen ermöglichen. Sollten Sie ein Template verwenden, dass auf einem Fragebogen mit Copyright beruht, bitten wir Sie, den Rechteinhaber selber zu kontaktieren. Diese App ist nur ein Hilfsmittel!

Diese App sendet keine Daten zu einem Server, alle erhobenen Daten bleiben auf dem lokalen Gerät. Der Nutzer ist für die Verwendung der Daten selber zuständig.

**Features**:

- Einfaches und schnelles Design
- optimiert für mobile Endgeräte (mobile first)
- Fragebögen als offenes Format (JSON)
- kompatible zu medizinischen Standards: lokales Speichern und Exportieren in
  - HL7: [https://www.hl7.org](https://www.hl7.org)
  - CDA-JSON: [zur Beschreibung](https://build.fhir.org/ig/HL7/cda-core-2.0/branches/master/StructureDefinition-ClinicalDocument.profile.json.html)
- Sicherheit:
  - RSA/AES verschlüsselter Export / Import von Dokumenten
  - Audit-ready: jedes Dokument wird intern mit einer Sicherheitssignatur versehen und ist Fälschungssicher
  - RSA signature mit private und publicKey
- FHIR-HL7 ready (bereit für Kommunikation mit einer FHIR-HL7 kompatiblen REST-API)

**PRIVACY**:

- Diese Web-App **sendet keinerlei Daten** an Dritte.
- Alle erhobenenen Fragebögen werden im lokalen Browserspeicher gespeichert und werden beim Löschen komplett entfernt.
- **Cookies: werden nicht angelegt und nicht gespeichert**.
- Fragebogentemplates können als JSON vom Server der Webapp abgerufen werden bzw. neu als Text/JSON importiert werden. Dabei werden **zu keinem Zeitpunkt Daten versendet**.

## Disclaimer

### Allgemeines

Die Web-App "surveyBEST" wurde im Rahmen eines Forschungsprojektes entwickelt und dient ausschliesslich als Hilfsmittel zur digitalen Erfassung und Auswertung von Fragebögen. Die App wird "as is" (ohne jegliche Garantie) zur Verfügung gestellt.

Wir bemühen uns, korrekte und aktuelle Funktionalität bereitzustellen, übernehmen jedoch keine Garantie für die Richtigkeit, Vollständigkeit, Aktualität oder Eignung der Inhalte und Ergebnisse dieser App für einen bestimmten Zweck.

### Kein Medizinprodukt

Diese App ist **kein zugelassenes Medizinprodukt** im Sinne der EU-Medizinprodukteverordnung (MDR 2017/745) oder vergleichbarer nationaler Regelungen. Sie darf **nicht** als alleinige Grundlage für klinische Entscheidungen, Diagnosen oder Therapieempfehlungen verwendet werden. Ergebnisse und Auswertungen sind stets durch qualifiziertes Fachpersonal zu überprüfen und im klinischen Kontext zu bewerten.

### Datenspeicherung und Datenschutz

"surveyBEST" speichert alle eingegebenen Daten ausschliesslich im lokalen Browser-Speicher (localStorage) des Endgeräts im CDA-JSON-Format. Es werden **zu keinem Zeitpunkt** Daten an Server oder Dritte übertragen, es sei denn, der Nutzer veranlasst einen Export ausdrücklich selbst.

Der Nutzer ist eigenverantwortlich für die sichere Aufbewahrung, den Export und die Löschung der auf dem Gerät gespeicherten Daten. Beim Löschen des Browser-Speichers oder bei Deinstallation der App gehen alle lokal gespeicherten Daten unwiderruflich verloren.

### Urheberrecht bei Fragebogeninhalten

Die in dieser App verwendeten oder importierten Fragebogentemplates können urheberrechtlich geschütztem Material Dritter unterliegen. Der Nutzer ist selbst dafür verantwortlich, die erforderlichen Nutzungsrechte und Lizenzen bei den jeweiligen Rechteinhabern einzuholen, bevor ein Fragebogen eingesetzt wird.

### Haftungsbeschränkung

Die Nutzung von "surveyBEST" erfolgt auf eigenes Risiko. Die Autoren und Mitwirkenden übernehmen keinerlei Haftung für Schäden oder Verluste, die direkt oder indirekt durch die Nutzung dieser App entstehen. Dies umfasst insbesondere, aber nicht ausschliesslich:

- Verlust oder Beschädigung von lokal gespeicherten Daten
- fehlerhafte Auswertungen oder Berechnungen
- Folgen klinischer Entscheidungen, die auf Grundlage der App-Ergebnisse getroffen werden
- Ausfälle oder Inkompatibilitäten auf bestimmten Endgeräten oder Browsern

### Keine externen Verbindungen

"surveyBEST" enthält keine Tracking-Mechanismen, setzt keine Cookies und stellt keine Verbindungen zu externen Diensten oder Websites her.

### Kontakt

Bei Fragen oder Anmerkungen kontaktieren Sie uns bitte unter: surveybest@info.de

### Lizenz

"surveyBEST" ist unter der MIT-Lizenz veröffentlicht. Den vollständigen Lizenztext finden Sie im Quellcode-Repository des Projekts.
