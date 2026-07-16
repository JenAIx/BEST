# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Studienseite merkt sich die zuletzt gewählte Studie**
  (`features/studypage-remember`): Wer `/studies` frisch ansteuert, landet
  direkt wieder in der zuletzt geöffneten Studie statt auf der Suchliste
  (Route-Guard `src/router/study-remember-guard.js`, persistiert via
  `localSettings.studies.lastSelectedStudyId`). Die Liste bleibt erreichbar:
  Zurück-Navigation aus einer Studie sowie `?stay=1` zeigen immer die Liste.
  Selbstheilend: gelöschte/nicht mehr vorhandene Studien löschen die Merkung
  (study-store `loadStudyById`/`deleteStudy`). Tests:
  `tests/unit/29_studypage-remember.test.js`.

- **Patientendaten-Tab: Studie entfernen + Rechte/Owner-Sektion**
  (`/visits` → Patientendaten).
  - Studieninfo-Karte: pro Mitgliedschaft ein Entfernen-Button (löscht die
    `STUDY_PATIENT_LOOKUP`-Zeile hart, mit Bestätigung — im Unterschied zum
    Withdraw-Status). Neue Methoden `study-repository.removePatientFromStudy`,
    study-store `removePatientFromStudy`, Composable
    `usePatientStudyActions.removeMembership`.
  - Neue Karte `PatientAccessCard.vue`: zeigt Owner + Sichtbarkeit, mit
    Public-Toggle und Owner-Wechsel. Geteiltes Composable
    `usePatientAccessActions.js`.
  - **Erweiterte Access-Policy** (`src/shared/utils/patient-access.js`,
    `canManagePatientAccess`): Owner/Public darf ändern, wer Admin ist, der
    Owner, **oder** – bei ownerlosen öffentlichen Patienten – jeder
    eingeloggte Nutzer. Der Store-Guard (`database-store.assertOwnerOrAdmin`)
    und die PatientCard-Kontextmenü-Sichtbarkeit nutzen jetzt dieselbe Regel;
    das Löschen bleibt strenger (Admin oder Creator, in PatientCardMenu als
    eigenes `canDelete` getrennt). Tests:
    `tests/unit/28_patient-access-policy.test.js`.

- **Studien-Audit-Modul** (`features/audit-studies`): Studien-Datenerhebung
  systematisch abarbeitbar.
  - **Audit-Tab auf `/studies/:id`** (`StudyAuditPanel.vue`): KPIs (offene
    Audits, Patienten mit Audits, abgeschlossen/eingeschrieben + Quote),
    „Audits pro Benutzer" und „Audits pro Patient" mit Sprung ins Grid
    (einzeln oder alle, Audit-Filter voraktiviert via One-Shot-Flag
    `localSettings.dataGrid.pendingAuditFilter`, konsumiert von
    `DataGridEditorPage`). Tab-Badge mit offener Audit-Anzahl.
  - **Enrollment-Status-Workflow**: `STUDY_PATIENT_LOOKUP.ENROLLMENT_STATUS_CD`
    bekommt einen `'completed'`-Schreibpfad — Status-Dropdown am
    PatientCard-Chip (`statusOptions`-Prop, nicht-brechend), filterbasierte
    Bulk-Aktionen („Gefilterte als abgeschlossen/aktiv markieren") mit
    Bestätigung, Statusfilter (Alle/Aktiv/Abgeschlossen/Zurückgezogen) +
    „Nur mit offenen Audits"-Toggle im Overview-Tab, „Im Grid öffnen (n)"
    für die gefilterte Liste. Konstanten in
    `src/shared/utils/enrollment-status.js`
    (`ENROLLMENT_STATUSES`, `ENROLLED_STATUS_SQL`).
  - **Team-Aktivität im Insights-Tab**: Patienten pro Benutzer (Owner via
    USER_PATIENT_LOOKUP) und Beobachtungen pro Benutzer (PROVIDER_ID=USER_CD)
    für die Kohorte (`getCohortUserStats`).
  - **Studienkarten-Badges auf `/studies`**: „x/y abgeschlossen" +
    rotes Audit-Chip pro Studie (Batch-Queries
    `getEnrollmentStatusCountsForStudies` / `getOpenAuditCountsForStudies`,
    kein N+1).
  - **Neue Repository-/Store-Schicht**: `study-repository`
    `getStudyAuditSummary` (erste DB-Query auf `VALUEFLAG_CD='AUDIT'`,
    access-gefiltert), `updateEnrollmentStatus(Bulk)`,
    `getEnrollmentStatusCounts(ForStudies)`, `getOpenAuditCountsForStudies`,
    `getCohortUserStats`; dbStore-Wrapper mit `resolveUserAccess()`;
    study-store `loadStudyAudit` / `setEnrollmentStatus`.
  - Tests: `tests/unit/25_study-audit-repository.test.js`,
    `tests/unit/26_pending-audit-filter.test.js` (21 neue Tests).
  - **Studienstatus überall verfügbar**
    (`StudyMembershipMenuItems.vue`, geteilt): Rechtsklick-Menü der
    PatientCard und der Patient-Zelle im Grid bieten jetzt
    „Studie zuordnen" (enroll/withdraw-Toggle) **und** „Studienstatus"
    (aktueller Status markiert, Umschalten aktiv/abgeschlossen/zurückgezogen).
    Das `person_remove`-Icon auf den PatientCards in `/studies/:id` entfällt
    (Withdraw läuft über Kontextmenü/Status); der alte Withdraw-Dialog wurde
    entfernt.
  - **Studieninfo-Sektion im Patientendaten-Tab** (`/visits` → Patientendaten,
    `PatientStudyInfoCard.vue` unterhalb der Statistiken): zeigt alle
    Studienmitgliedschaften mit Einschreibedatum, Status-Umschalter
    (aktiv/abgeschlossen/zurückgezogen) und „Zu Studie hinzufügen".
  - **Gezielte Karten-Updates statt Seiten-Reload**: Studien-Aktionen der
    PatientCard laufen über die neue geteilte Aktionsschicht
    `src/composables/usePatientStudyActions.js` (enroll/withdraw/setStatus +
    Membership-Laden; Notifications inklusive). Jede Aktion liefert nach
    bestätigtem DB-Write ein Detail-Objekt `{type, studyNum, patientNum,
    status}`, das über `changed` bis zur Seite durchgereicht wird —
    `/studies/:id` patcht damit nur die betroffene Karte (Status/Withdraw)
    bzw. lädt die Liste still nach (Enroll/Löschen), statt die ganze Seite
    auf den Spinner zu schalten (`loadStudy/loadEnrolledPatients` mit
    `silent`-Option). study-store bekam `enrollPatientInStudy` /
    `withdrawPatientFromStudy` (inkl. Audit-Cache-Refresh).
  - **Fix: Statusänderung übers Kontextmenü aktualisiert die Karte sofort**
    — `StudyMembershipMenuItems` nutzt einen `onChanged`-Function-Prop mit
    Closure-Capture vor dem `await` statt `defineEmits`: das Menü wird durch
    `v-close-popup` sofort unmounted, ein Emit nach dem DB-Write verpuffte
    auf der toten Instanz (Regressionstest
    `tests/unit/27_study-membership-menu.test.js`).
  - **Fix: „Im Grid öffnen (n)" nur bei aktivem Filter** — ohne Filter hätte
    der Button die komplette Kohorte (400+ Patienten) ins Grid geladen.
  - **Mehrfachauswahl per Umschalt-Klick auf `/studies/:id`**: Normaler Klick
    öffnet weiterhin den Patienten; Umschalt-/Strg-/Cmd-Klick wählt Karten aus
    (bei aktiver Auswahl togglet auch der normale Klick). Auswahl-Banner mit
    „Alle (gefiltert) auswählen" / „Auswahl aufheben", Button „Auswahl im Grid
    öffnen (n)" lädt genau die markierten Karten. PatientCard reicht dafür das
    Maus-Event am `select`-Emit mit und hat einen optionalen `select-hint`-
    Tooltip.
  - **Fix: „Owner ändern" öffnete keinen Dialog** — `openOwnerDialog` setzte
    `showOwnerDialog` erst nach einer `await`-Query, was mit dem
    `v-close-popup`-Teardown des Menüs kollidierte; der Dialog öffnet jetzt
    synchron und lädt die Nutzerliste hinein. (Sichtbar ist der Menüpunkt
    weiterhin nur für Admins oder den Patienten-Owner — importierte Patienten
    ohne Creator-Zeile haben keinen Owner.)
  - **Keine versehentliche Text-Markierung**: Quasar-Klasse `.non-selectable`
    auf allen Layout-Roots (Main/Grid/Public), damit Umschalt-Klick auf Karten
    keinen Seitentext markiert; Eingabefelder / `.selectable` bleiben per
    globaler Regel in `app.scss` selektierbar.
  - **Grid: erweitertes Patient-Kontextmenü** (`ExcelLikeEditor.vue`):
    Patienteninfo-Dialog (Demografie + Studieninfo, access-gefiltert via
    `getAccessiblePatientByCode`), „Patient aus Tabelle entfernen" direkt im
    Menü, Studienzugehörigkeit + Studienstatus, Patient verwalten, Löschen.

### Fixed

- **`/visits/:patientId` ohne Navigation gefangen**: Die Patienten-Deep-Link-
  Route lag seit August 2025 im PublicLayout (ohne Drawer/Sidebar) — wer über
  das Patientenkarten-Kontextmenü oder die Smart-Suche direkt auf die
  Besuchsseite eines Patienten sprang, hatte keine Navigation mehr. Die Route
  liegt jetzt als Kind im MainLayout (Drawer bleibt sichtbar), Verhalten der
  Seite unverändert.

### Changed

- **Einheitliches Seiten-Design app-weit** (`src/css/app.scss`): Alle
  Hauptseiten teilen jetzt dasselbe Grundgerüst — flacher Hintergrund
  (`--color-background` auf jeder `q-page`), zentrierter
  `.page-container` (max. 1200px, einheitliches Padding), weiße Boxen mit
  8px-Radius und dezentem Schatten (`.content-box` + globale
  `q-card`-Regel innerhalb von Seiten; Dialoge behalten Quasar-Elevation).
  Entfernt wurden die seitenindividuellen Stile: Gradient-Hintergrund auf
  /visits, `#f8f9fa`/`$grey-1`-Sonderhintergründe (Dashboard, Data-Grid,
  Export, Feedback, Import, Questionnaires), Card-Radius-Wildwuchs
  (10/12/16px auf Studien-Seiten und PatientSelector), lokale
  `page-container`-Duplikate. /settings bekam denselben PageHeader
  (neuer Key `settings.pageSubtitle`).

- **Einheitlicher Seitenkopf nach Questionnaire-Vorlage + Breadcrumbs
  entfernt**: Neue geteilte Komponente
  `src/components/shared/PageHeader.vue` — h1-Titel mit dem Untertitel
  kleiner/dezenter inline daneben (Baseline-bündig, bricht auf schmalen
  Screens um), Actions-Slot rechts. Hover über den Titel zeigt den aktuellen
  Routen-Pfad als Tooltip (Debug-Hilfe) — dafür ist die globale
  Breadcrumb-Leiste („Home / …") im MainLayout entfernt. Umgestellt: /visits
  (Auswahlmodus; Patientenansicht `/visits/:id` unverändert), /studies,
  /data-grid, /concepts, /cql, /users, /global-settings, /import, /export,
  /database-test, /feedback, /questionnaires. Alle Titel/Untertitel sauber
  über i18n (neue `pageSubtitle`-Keys für study/dataGrid/export/concepts/
  questionnaire/user + `database.testPageTitle/-Subtitle`; hartkodiertes
  Englisch auf /users, /questionnaires, /database-test ersetzt).

- **/visits-Kopfbereich entschlackt**: Der große zentrierte Hero der
  Patientenauswahl (64px-Icon, 3rem-Titel, Untertitel, 3rem-Abstand) ist
  durch eine kompakte Sektions-Titelzeile ersetzt (kleines Icon + Titel +
  Untertitel in einer Zeile, linksbündig über der Suchkarte) — passend zum
  neueren Dashboard-Design ohne Seiten-Hero.

- **Grid-Footer entschlackt + Visitentyp-Sperre in die Kopfzeile**: Der
  Footer des Datentabellen-Editors nutzt jetzt die volle Breite (Status links,
  Statistik rechts, `max-width`/Zentrierung entfernt), „Alle Änderungen
  gespeichert" ist auf das grüne Häkchen mit Tooltip reduziert (Warn-Text mit
  Zähler bleibt bei ungespeicherten Änderungen sichtbar). Der
  Visitentyp-Sperre-Chip wanderte aus dem Footer in die Kopfzeile links neben
  die Zoom-Buttons: kompakter Icon-Button (Kalender + Schloss-Badge,
  `lock`/`lock_open` je nach Zustand) mit Tooltip; der Schalter in den
  Anzeigeoptionen bleibt als Zweitzugang.

- **„Abgeschlossen" zählt weiter als eingeschrieben**: Alle
  Studien-Zählqueries filtern jetzt einheitlich `!= 'withdrawn'` statt
  `= 'active'` (Karten-Patientenzahl, Statistik, Kohorten-Export
  `findEnrolledPatientCds`, Insights `getCohortPatientCount`) — abgeschlossene
  Patienten bleiben in Zählungen, Export und Insights enthalten.

- **Zeilen-Virtualisierung im Datentabellen-Editor**: Nur die sichtbaren
  Zeilen (+ Überhang) stehen im DOM; Spacer-Zeilen erhalten Scrollbar-Geometrie
  und Sticky-Header/-Spalten. Stresstest 425 Patienten / 1037 Visiten /
  47 Spalten (~49k Zellen): Aufbau in ~1,5s, konstant ~25–35 Zeilen im DOM
  statt 1037, flüssiges Scrollen, 0 Konsolen-Fehler. Dazu: `table-layout:
  fixed` + `colgroup` (stabile Spaltenbreiten beim Scrollen), einheitliche
  Zeilenhöhe, `q-scroll-area` durch nativen Scroll-Container ersetzt,
  Zoom-kompensierte Fenster-Berechnung (`grid-utils.computeVirtualWindow`,
  Tests `tests/unit/24_grid-virtualization.test.js`), EditableCell committet
  pending Edits beim Unmount (Zelle aus dem Fenster gescrollt),
  `isFirstVisitForPatient` von O(Zeilen²) pro Render auf einmalige Map.
- **Visitentyp-Sperre in der Footer-Statistik**: Bei aktiver Sperre fallen
  gesperrte Zellen aus „% Ausgefüllt" und „Zellen" heraus (sie sind für den
  Visitentyp der Zeile nicht vorgesehen); offene Audits auf gesperrten Zellen
  zählen weiter. Neuer Footer-Eintrag „gesperrt: N" bei aktiver Sperre.


- **Visitentyp-Sperre im Datentabellen-Editor** (UI-seitig, abschaltbar):
  Neuer Toggle in den Anzeigeoptionen + Chip im Grid-Footer
  (`viewOptions.visitTypeLockActive`, persistiert). Wenn aktiv, werden Zellen
  gesperrt (Schraffur, Schloss-Icon, Editieren/Kontextmenü/Fragebogen-
  Ausfüllen/Medikations-Dialog blockiert), deren Concept über die
  FieldSets anderer Visitentypen definiert ist, aber nicht zum Visitentyp
  der Zeile gehört. Zweistufiges Matching, explizit schlägt Kategorie:
  explizit in `concepts[]` gelistete Concepts sind an genau die Visitentypen
  gebunden, die sie listen (das Kategorie-Fallback rettet sie nicht — z.B.
  bleibt `STROKE_LIPID:V2:DOSE_INCREASED` trotz Kategorie `Stroke` V2-only);
  nirgends gelistete Concepts matchen per `categories[]`.
  Vorhandene Werte bleiben sichtbar (read-only).
  Konservativ: Visiten ohne/mit unbekanntem Visitentyp, Concepts ohne
  FieldSet-Zuordnung und verwaiste FieldSets sperren nie.
  (`grid-utils.buildVisitTypeLockMap`/`isCellVisitTypeLocked`,
  `data-grid-store.isCellLocked`, Tests `tests/unit/23_visit-type-lock.test.js`)

- **Provider-Stempel auf Observations**: Beim Erstellen _und_ Ändern einer
  Observation (Dateneingabe, Datentabellen-Editor inkl. Flag-/Datums-Menü,
  Medikamente, Questionnaires) wird der eingeloggte Nutzer als
  `OBSERVATION_FACT.PROVIDER_ID` (= `USER_CD`) vermerkt — Last-Editor-Semantik.
  Zentraler Getter `auth-store.providerId` (Fallback `'SYSTEM'`). Migration
  013 befüllt `PROVIDER_DIMENSION` aus `USER_MANAGEMENT` (ein Provider pro
  User, selbstheilender Upsert, plus Legacy-Einträge `SYSTEM`/`@`);
  `UserRepository.createUser`/`updateUser` halten den Abgleich aktuell.
  Tests: `tests/unit/22_observation-provider.test.js` + angepasste
  Grid-Tests (15/17/18).

- **Rechtsklick-Kontextmenü auf der Standard-Patientenkarte**
  (`PatientCardMenu.vue`, automatisch auf allen 8 Karten-Flächen):
  Visiten öffnen, Patientendaten anzeigen/ändern (öffnet die
  Patientendaten-Ansicht in /visits via `?view=patient`), im
  Datentabellen-Editor öffnen (setzt die Grid-Auswahl auf diesen
  Patienten), Patienten-ID kopieren, Studie zuordnen (Submenü mit
  Häkchen für bereits eingeschriebene), Patient exportieren
  (Format-Dialog CSV/HL7, Direkt-Download inkl. Visiten/Observations).
  Für Admin + Owner zusätzlich: Öffentlich machen/entziehen, Owner
  ändern (Creator-Rolle wechselt, alter Owner behält Zugriff —
  `transferOwnership`), Löschen (bestehender Dialog + Store-Guard).
  Berechtigungen laden lazy beim Menü-Öffnen; mutierende Aktionen
  emittieren `changed`, alle Listen-Seiten laden dann neu.
  Store-Guards `transferPatientOwnership`/`setPatientPublicAccess`
  (Admin oder aktueller Owner). 4 neue Tests
  (`transferOwnership`, `setPublicAccess`).
  Zurück-Pfeil des Grid-Editors führt zur Herkunftsseite zurück
  (Router-History, wie der /visits-Zurück-Fix) statt immer zur
  Grid-Patientenauswahl; Unsaved-Changes-Dialog bleibt davor.

### Added

- **Kontextmenü "Studie zuordnen": Toggle statt deaktiviertem Häkchen** —
  Bereits eingeschriebene Studien sind im Submenü nicht mehr disabled,
  sondern bieten das Austragen an (person_remove-Icon, Caption
  "eingeschrieben", Tooltip; `withdrawPatient` setzt den Status auf
  withdrawn, erneutes Zuordnen reaktiviert die Einschreibung).

- **Dateneingabe: "Alle hinzufügen" für verfügbare Beobachtungen** —
  Der "Verfügbare Beobachtungen"-Abschnitt jedes Feldsets hat jetzt
  einen Button, der alle noch nicht angelegten Konzepte auf einmal als
  leere Observations anlegt (Medikamente ausgenommen — eigener Flow);
  Sammel-Notify mit Anzahl, Teilfehler werden gemeldet. Abschnitt
  nebenbei i18n-fähig gemacht.

### Fixed

- **Neue Visite wurde nach dem Anlegen manchmal nicht ausgewählt** —
  Ursachenkette: (1) `electron-preload.js` band den sqlite3-`run`-Callback
  per `.bind(this)` ans Preload-Objekt, wodurch `lastID`/`changes` immer
  `undefined` waren (sqlite3 liefert beide über das Callback-eigene
  `this`); (2) der dadurch immer aktive Fallback in `visit-repository`
  ermittelte die neue ENCOUNTER_NUM über "neueste Visite nach
  START_DATE" — bei rückdatierten oder datumsgleichen Visiten die
  falsche. Fix: Binding entfernt (lastID funktioniert wieder überall;
  greift nach Electron-Neustart) und die Fallbacks in visit- und
  observation-repository auf deterministisches
  `MAX(ENCOUNTER_NUM/OBSERVATION_ID)` umgestellt. 3 Regressionstests
  (`tests/unit/21_new-visit-id.test.js`).

### Changed

- **/studies platzoptimiert, Studien direkt sichtbar** — Die Studienliste
  lädt und rendert sofort beim Seitenaufruf ("Alle Studien"), statt erst
  nach Suche/Kategorie-Klick. Hero-Block der Suchkarte entfernt (Titel
  stand doppelt), Suchfeld als schmale Zeile. Die vier großen
  Statistik-Karten sind eine kompakte Inline-Zeile, die
  Forschungskategorien klickbare Chips daneben (filtern wie zuvor).
  Studienkarten kompakter (einzeilige Kopfzeile mit Kategorie/Patienten,
  Status-Chip, Analytics-Button; Beschreibung auf 2 Zeilen geklammert,
  keine fixe 200px-Höhe mehr); redundanter "View"-Button entfernt
  (Kartenklick öffnet die Studie). Aktive Filter erscheinen als
  entfernbare Chips neben der Ergebnis-Überschrift plus
  "Filter zurücksetzen"; das Entfernen des letzten Filters lädt die
  ungefilterte Liste neu.
  Studien-Detailseite: eingeschriebene Patienten als Standard-
  Patientenkarten (Status-Chip, Entfernen-Button = Austragen aus der
  Studie via neuer `status`-/`removable`-Props der PatientCard,
  Owner-Badge, Einschreibedatum), client-seitige Pagination (24/Seite).
  Zurück-Pfeil in /visits führt jetzt zur Herkunftsseite zurück
  (z. B. Studien-Detailseite), statt immer zur Patientenauswahl.
  Eingeschriebene Patienten filterbar wie in /visits: Suchfeld
  (Name/ID) + aufklappbare Filter (Alters-Range, Geschlecht, Owner —
  Optionen aus den tatsächlichen Listen-Werten abgeleitet),
  client-seitig mit Treffer-Zähler und Filter-Reset.
  "Patient einschreiben"-Dialog zeigt beim Öffnen Vorschläge:
  Patienten ohne jede Studienzuordnung (zugriffsgefiltert, max. 10
  neueste) als Standard-Karten. Mehrfachauswahl: angeklickte Patienten
  wandern platzsparend aus der Liste in eine Chip-Zeile "Ausgewählt (n)"
  (X am Chip legt sie zurück in die Liste); der Enroll-Button schreibt
  alle Ausgewählten mit gemeinsamem Datum ein.
  Owner-Filter der eingeschriebenen Patienten bietet "Ohne Owner
  (nur öffentlich)" an, wenn ownerlose Patienten in der Liste sind.
  Studien-Tags auf den Patientenkarten (Dashboard + /visits): kurzer
  Badge aus dem STUDY_CD (max. 8 Zeichen, z. B. "STROKE") links vom
  Owner-Badge, voller Studienname im Tooltip; max. 2 Tags plus
  "+n"-Sammler, zurückgezogene Einschreibungen zählen nicht
  (`getPatientStudyTags` Batch-Query).
  "Patient erstellen"-Dialog: neues optionales Feld "Studie zuweisen" —
  zeigt alle Studien, bei Auswahl wird der neue Patient direkt aktiv
  eingeschrieben (Fehler bei der Zuweisung bricht die Anlage nicht ab,
  nur Warn-Hinweis; 3 neue Tests in
  `tests/unit/19_create-patient-dialog-prop.test.js`). Dialog-Layout
  verdichtet (q-gutter-sm statt -md, Feld-Margins entfernt,
  Notizfeld 2 Zeilen dense). Vital-Status-Default zeigte den rohen Code
  "SCTID: 55561003" statt eines Labels — der hartkodierte Default stand
  nicht in den hierarchischen vital_status-Antwortoptionen
  (\\SNOMED-CT\\365860008\\LA\\: alive/dead/unknown); Default jetzt
  'SCTID: 438949009' (alive), löst korrekt auf.
  Patientenkarten-Avatar als Geschlechtsindikator: weiblich → rosa
  (pink-4), männlich → blau (light-blue-6), unbekannt → primary
  (wertet gender/SEX_RESOLVED/SEX_CD aus, de/en-tauglich).
  Fehlender i18n-Key `common.notSet` ergänzt.

- **Dashboard vereinfacht: nur noch eine Ansicht, einheitliche Patientenkarten** —
  Der "Deep Work Mode" (Datenübersichts-Karten + Patiententabelle mit
  Filtern/Löschen) und der Light/Deep-Umschalter im Header sind entfernt;
  die bisherige Light-Ansicht ist das Dashboard (Patientenverwaltung läuft
  über `/visits`). Neue gemeinsame `src/components/shared/PatientCard.vue`
  (neutral, kompakt: weiß, 1px Rand, Hover-Primärfarbe, 32px-Avatar, eine
  Meta-Zeile, Owner-Badge oben rechts) ersetzt die bisherigen
  Karten-Varianten (lila Gradient entfällt). Dashboard "Recent Patients"
  und /visits (Zuletzt + Suchergebnisse) rendern die Karten im Grid
  2–3 nebeneinander (`repeat(auto-fill, minmax(280px, 1fr))`).
  Karten-Feinschliff (live per CDP-Screenshot verifiziert): keine
  ID-Dublette mehr (Titel = Name ODER ID), Person-Icon statt
  Ziffern-"Initialen" bei namenlosen Patienten, Meta-Zeile zweigeteilt
  (Fakten links, Zeitpunkt mit Uhr-Icon rechts, kein Ellipsis-Gedränge),
  korrekte Pluralisierung ("1 Besuch"/"n Besuche") und locale-abhängiges
  Datumsformat. Die Karte ist als Standard-Patientenkarte in CLAUDE.md
  festgeschrieben. Quick Actions aufgeräumt: "Schnelle Patientensuche" und
  "Patientenbesuche" (beide → /visits) zu einer Karte "Patienten & Besuche"
  zusammengefasst (3 statt 4 Quick-Action-Karten).
  "Patient auswählen" (PatientSelectionCard: /questionnaires, /import,
  Grid-Editor) auf die Standard-Karte umgestellt — Karten-Grid statt
  Eigenbau-Liste, Auswahl-Highlight über neues `selected`-Prop der
  PatientCard, Owner-Badges, i18n statt hartkodiertem Englisch
  (Titel/Beschreibung/Suchfeld). Neuer Schnellfilter "Nur meine Patienten"
  in der /visits-Patientensuche (aus = alle verfügbaren: eigene +
  öffentliche; an = nur zugewiesene/selbst angelegte;
  `getPatientNumsAssignedTo`); derselbe Toggle auch in der
  PatientSelectionCard (/questionnaires, /import, Grid-Editor) und in den
  Filtern der Export-Seite. Footer in der /visits-Patientenauswahl mit
  Zählern: verfügbar (zugriffsgefiltert) / öffentlich / mir zugewiesen.
  Export-Seite: q-table durch das Standard-Karten-Grid ersetzt — Karten
  anklicken toggelt die Auswahl (selected-State), "Alle auswählen" wählt
  alle zum Filter passenden Patienten (nicht nur die Seite), Abwählen
  über das bestehende "Clear Selection"; zentrierte Pagination
  (24/Seite), Owner-Badges auch hier. Data-Grid-Auswahlseite auf dasselbe
  Muster umgestellt (Karten-Grid statt q-table, Klick-Auswahl, "Alle
  auswählen", Pagination); Besuchs-/Beobachtungszahlen in der
  Karten-Meta-Zeile (`observationCount` in der Standard-Karte).
  Ungenutzte Deep-only-i18n-Keys entfernt.

### Added

- **User-Access: Public-Patienten, Owner-Anzeige, Creator-Filter** —
  - Patient-Neuanlage hat einen "Öffentlich"-Toggle (default an): public
    Patienten bekommen zusätzlich zur Creator-Zuordnung eine
    `USER_PATIENT_LOOKUP`-Zeile mit `USER_ID = 0` und sind damit für alle
    Nutzer sichtbar (`database-store.createPatient({ isPublic })`).
  - Migration `012-public-patient-access`: Bestandspatienten ohne
    Nutzer-Zuordnung (u. a. die 425 Lipid-Import-Patienten) werden public.
  - Owner-Badge (rechts oben, Ellipsis + Tooltip) auf den Patientenkarten in
    `/visits`; Owner-Spalte in der Dashboard-Tabelle und Owner in der
    "Recent Patients"-Liste. Auflösung batch-weise über
    `UserPatientLookupRepository.getPatientAccessInfo`.
  - Neuer Filter "Angelegt von" in den erweiterten Filtern des
    Patient-Selectors und auf der Data-Grid-Auswahlseite
    (`getPatientNumsCreatedBy`; Auswahl des Public-Users filtert auf
    öffentliche Patienten). Owner-Anzeige (dezent) auch in der
    Data-Grid-Patiententabelle.

### Fixed

- **User-Access: ungefilterte Anzeigepfade** — "Zuletzt"-Karten im
  Patient-Selector und die Suche/Recents der PatientSelectionCard umgingen die
  Zugriffskontrolle (direktes `findByPatientCode`/SQL): Nutzer sahen Karten,
  deren Klick dann mit "Patient not found or access denied" scheiterte. Alle
  UI-Lookups laufen jetzt über `findAccessiblePatientByCode` bzw.
  `getPatientsPaginated` (beide USER_PATIENT_LOOKUP-gefiltert, Public-User 0
  eingeschlossen). Tests: `tests/unit/20_user-access.test.js`.
- **User-Access-Review (alle Query-Pfade)** — weitere ungefilterte Pfade
  geschlossen: Header-Suche (`SmartSearch`), Studien-Einschreibung
  (`EnrollPatientDialog`), Export-Patiententabelle (`ExportPage`) riefen
  `patientRepo.getPatientsPaginated` ohne User-Kontext auf; der
  Data-Grid-Editor lud gespeicherte Auswahlen ungefiltert
  (`loadBatchPatientData` → neu `findAccessiblePatientsByCodes`).
  `countByCriteriaFromView` warf bei Regular-Usern mit `patientNums`-Kriterium
  "ambiguous column name: PATIENT_NUM" (fehlender Alias) und zählte
  searchTerm-Treffer ohne Access-Filter — beides gefixt. Das
  Zugriffs-Prädikat ist jetzt in `PatientRepository.getAccessFilter()`
  zentralisiert (ein Ort statt fünf SQL-Duplikate).
- **Tiefenanalyse User-Access + Audit-Workflow** (3 parallele Code-Audits):
  - Import-Pfade (CSV/Survey/HL7/JSON via `database-import-service`) und der
    Demo-Generator legten Patienten ohne `USER_PATIENT_LOOKUP`-Zeilen an
    (unsichtbar für normale Nutzer). Importe schreiben jetzt Creator- +
    Public-Zeilen (`assignPatientAccess`, Optionen `currentUserId` /
    `assignPublicAccess`), Demo-Patienten werden public.
  - Patienten-Löschung war für jeden sichtbaren Patienten möglich (inkl.
    public). Jetzt: nur Admins oder der Ersteller (Guard in
    `database-store.deletePatient` + Button-Gating im Dashboard).
  - `StudyDetailsPage` zeigte alle eingeschriebenen Patienten einer Studie
    ungefiltert (Name, ID, Demografie). `getEnrolledPatients` unterstützt
    jetzt `userAccess`; die Seite lädt über den gefilterten Wrapper
    `dbStore.getEnrolledPatientsForStudy`.
  - Grid-Editor lud Observations ungefiltert und synthetisierte daraus
    Zeilen für unzugängliche Patienten — Observations werden jetzt nur für
    die zugriffsgefilterte Patientenliste geladen.
  - `VALUEFLAG_CD`-Konsistenz: Der Visits-Editor ließ Flags beim
    Wertschreiben stehen (NV+Wert-Inkonsistenz möglich), das Grid löschte
    Flags bei Nicht-Numerik nur lokal, nicht in der DB (Divergenz). Beide
    Editoren setzen jetzt bei jedem Wertschreiben `VALUEFLAG_CD = NULL`
    (DB + lokaler Spiegel), gemäß CLAUDE.md §3.
  - Export-Service nutzt im UI-Pfad den zugriffsgefilterten Lookup
    (Defense-in-depth; Headless-Skripte unverändert).

- **Dateneingabe: Autosave + Undo-Fenster** — Observation-Eingaben in der
  Visiten-Dateneingabe speichern jetzt automatisch beim Verlassen des Feldes
  (Blur), bei Enter (Shift+Enter erzeugt im Textfeld weiter einen
  Zeilenumbruch) bzw. sofort bei Auswahl einer Option (S/F/A-Selects).
  Die bisherigen Save-/Cancel-Buttons pro Zeile entfallen. Nach jedem
  Speichern erscheinen für 10 Sekunden ein grünes Häkchen am Feld
  (ersetzt den Erfolgs-Toast) und ein Undo-Button (orange, `undo`-Icon)
  in der Aktionsspalte, der den Wert von vor dem Speichern wiederherstellt
  (schreibt ihn zurück in die DB). "Duplicate previous value" speichert
  jetzt direkt (vorher: nur als pending markiert). Betroffen:
  `ObservationValueEditor.vue` (Blur/Enter/Select-Trigger, Häkchen),
  `ObservationFieldSet.vue` (`recentSaves`-Fenster, `revertRow`,
  NaN-Guard für leere Numerik), `ObservationsTable.vue` /
  `ObservationRowActions.vue` (Event-Durchleitung, Undo-Button).

- **Zusätzliche-Infos-Karte: Location editierbar + eigene Felder** — siehe
  Merge `features/patient-additional-info-edit`: Location (`STATECITYZIP_PATH`)
  ist im Edit-Modus editierbar; frei definierbare Zusatzfelder können angelegt/
  gelöscht werden (JSON in `PATIENT_BLOB.customFields`, reservierte Keys
  `name`/`notes`/`firstName`/`lastName` bleiben unangetastet).

## [0.3_20260521] - 2026-05-21

### Datentabellen-Editor: per-observation date (right-click → edit / reset)

- **`OBSERVATION_FACT.START_DATE` is now editable per cell** via the
  right-click menu on any observation. Two new menu items:
  - **Datum bearbeiten** — opens a small `AppDialog` with a
    `<q-input type="date">` pre-filled with the current observation date.
    Saving runs `UPDATE OBSERVATION_FACT SET START_DATE = ?` and mirrors
    the new date into the grid's local state.
  - **Auf Visitendatum zurücksetzen** — shown only when the observation
    date diverges from the parent visit's `START_DATE`. One-click reset
    that calls the same store action with `startDate = row.visitDate`.
- **Corner badge** — cells whose `obs.startDate !== row.visitDate` now
  render a small calendar icon in the top-left corner (purple `event`
  icon, pointer-events: none so it doesn't intercept clicks).
- **Local-state propagation** — every save (whether via the inline
  editor, the right-click date dialog, or the reset action) carries
  `startDate` through `EditableCell.emit('update', {..., startDate})`
  → `data-grid-store.handleCellUpdate` mirrors it into
  `row.observations[code].startDate`. Same invariant as `valueFlag`,
  documented in CLAUDE.md §3.
- **No schema change** — `OBSERVATION_FACT.START_DATE` already exists
  and was already populated from the visit on INSERT. The grid loader
  (`processObservationDataForGrid` in `database-store.js`) now exposes
  it in the per-cell payload alongside `value`, `valueFlag`, etc.
- **Tests** — 7 new in `tests/unit/18_observation-date.test.js`:
  SQL params, local mirror, reset-to-visit-date, missing-id no-op,
  empty-string rejection, error surface, and `handleCellUpdate`
  backwards-compat (no `startDate` in payload leaves the cell
  untouched). Total suite: 764 passing, 3 skipped.

### Datentabellen-Editor: Audit-Workflow + NV / right-click context menu

- **New right-click menu on grid cells** (`EditableCell.vue`). Mutually-exclusive
  state transitions backed by `OBSERVATION_FACT.VALUEFLAG_CD`:
  - **Wert löschen** — confirm-dialog (shared `AppDialog`), then hard-delete
    the observation row.
  - **Zur Prüfung markieren** / **Prüfung auflösen** — flips
    `VALUEFLAG_CD` between `AUDIT` and `CONFIRMED`. Audit-flagged cells render
    with a 2 px red border, confirmed cells with a 1 px green border.
  - **Als „Kein Wert" markieren** / **„Kein Wert" aufheben** — toggles the
    existing 3-state numeric `NV` state via the menu (previously only the
    inline side button could set it).
- **GridFooter audit chip** — shows `Audits offen: N` when at least one
  cell is flagged AUDIT. Clicking the chip toggles a filter that collapses
  the grid to only the columns and rows that contain open audits; clicking
  again restores the full view.
- **Migration 011 (`011-audit-valueflags.js`)** seeds `AUDIT` + `CONFIRMED`
  codes into `CODE_LOOKUP(OBSERVATION_FACT/VALUEFLAG_CD)` alongside the
  existing `NV` / `NI` codes from migration 010. No schema change.
- **CLAUDE.md §3** rewritten as a `VALUEFLAG_CD` state machine — covers
  3-state numerics and the audit workflow together, including the
  invariant that every save MUST propagate `valueFlag` through to the
  grid's local state.
- **2 bug fixes uncovered during integration**:
  - **Inline NV-toggle on an empty cell silently did nothing** — the
    `<q-input>` carrying the only `@blur="saveEdit"` handler was unmounted
    when `editFlagNV` flipped to `true`, leaving no save trigger. Fix:
    `toggleEditFlag` now fires `saveEdit()` when flipping **into** NV (commit
    is unambiguous — no further input expected), with an `isSaving` re-entry
    guard so a concurrent blur save doesn't double-fire.
  - **`valueFlag` not mirrored to local state after save** — the editor
    persisted `VALUEFLAG_CD='NV'` to the DB but `row.observations[code].valueFlag`
    stayed stale, so the cell rendered empty until a full reload. Fix:
    `EditableCell.emit('update', {…, valueFlag})` now carries the new flag and
    `data-grid-store.handleCellUpdate` mirrors it.
- **Tests**: 17_audit-flagging.test.js (12 new tests covering store actions,
  statistics, audit filter, NV-clears-value, valueFlag in payload) and 3 new
  regressions in 15_editable-cell-nv-state.test.js (empty→NV via toggle,
  emit payload carries `valueFlag`, edit clears stale flag).
  Total suite: 757 passing, 3 skipped.

### Cohort Dashboard / Study Insights

- **New "Insights" tab on `StudyDetailsPage.vue`** — for any study, renders
  six aggregate sections over the enrolled cohort:
  - **Visit Retention** — enrolled + per-visit-type patient counts as KPI
    cards (e.g. Stroke-Lipid: 425 enrolled · 425 V0 · 425 V1 · 187 V2).
  - **Drug Usage** — horizontal bar list with 3-state breakdown
    (`taking` / `not taking` / `unknown`). Bar fill = taking; buffered bar
    extends to `taking + not taking` so the gap to 100 % is the "unknown"
    segment. Reads concepts via `CONCEPT_CD LIKE 'STROKE_LIPID:DRUG:%'`
    (overrideable via store option).
  - **Comorbidity Prevalence** — every F-type Finding concept the cohort
    has at least one observation on, with positive/total counts.
  - **Etiology (TOAST)** + **Event Type** — distribution of the two
    Stroke-Lipid Selection concepts.
  - **Lab Trends (LDL + HDL)** — per-visit-type median (robust against
    single-cell outliers), min/max, count.
- **5 new repository methods** in `study-repository.js`:
  `getCohortPatientCount`, `getCohortDrugUsage`,
  `getCohortFindingPrevalence`, `getCohortSelectionDistribution`,
  `getCohortLabSummary`. Median is computed in JS (SQLite has no
  PERCENTILE_CONT) so a single outlier in a small cohort doesn't blow
  up the V2 lab trend. 9 integration tests with a hand-seeded
  4-patient cohort (`tests/integration/14_cohort-insights.test.js`).
- **`studyStore.loadCohortInsights(studyCd, options?)`** action fires
  the 7 aggregate queries in parallel (~150 ms wall-time for the
  425-patient Stroke-Lipid cohort) and caches the result keyed by
  `cohortInsightsStudyCd`. Re-load on study switch.
- **3 new components** under `src/components/study/`:
  `StudyInsights.vue` (container, ~250 LOC), `CohortBarList.vue`
  (reusable horizontal bar list using `q-linear-progress`),
  `CohortKpiCard.vue` (reusable KPI tile with optional Δ).
- **No new chart library** — the project stays Quasar-only.
  `q-linear-progress` is already used in 5 places and was the
  cheapest, most-consistent path for our bar/KPI aggregates. If
  later we need real charts (histograms, box-plots), Chart.js +
  vue-chartjs are obvious next-step.

### Last-Mile fixes for v0.2

- **3-State Drug Edit-UI in the grid editor** — clicking a numeric drug cell
  now opens an editor with a small side-toggle that flips between entering a
  value and marking the cell as "not taken / no value" (VALUEFLAG_CD='NV').
  Round-trip across the three states works:
  - value → value: UPDATE with `NVAL_NUM` set, `VALUEFLAG_CD` cleared
  - value → NV: UPDATE with `NVAL_NUM=NULL, VALUEFLAG_CD='NV'`
  - NV → value: UPDATE with `NVAL_NUM` set, `VALUEFLAG_CD` cleared
  - value → cleared: DELETE the row (back to "not assessed")
  Covered by 6 unit tests in `tests/unit/15_editable-cell-nv-state.test.js`.
- **In-App Cohort Export** — new "Export Cohort" button on every Study
  Details page opens a small dialog (CSV vs HL7-JSON), triggers
  `exportStore.exportStudyPatients(...)` which runs the same `ExportService`
  the headless CLI uses, then download via Blob. Backed by a new
  `study-repository.findEnrolledPatientCds(studyCd)` method and tested in
  `tests/unit/16_export-store-study.test.js`.
- **CHANGELOG graduation** — the v0.2_20260516 content moved out of
  `[Unreleased]` into its own versioned section below; this `[Unreleased]`
  is the clean staging area for the next release.

## [0.2_20260516] - 2026-05-16

### App version

- **`VITE_APP_VERSION` bumped to `0.2_20260516`** (from `0.1_20251219`). This
  is the first version that ships the Stroke-Lipid data model, the grid view
  improvements, and the verified export pipeline.

### Documentation

- **`AGENTS.md` renamed to `CLAUDE.md`** (full git history preserved via
  `git mv`). Aligns with the Claude Code convention. All internal references
  in `README.md`, `IMPLEMENTATION_STATUS.md`, source comments, and tests
  updated to point at the new filename.
- **New section in `CLAUDE.md`: "Building a New Visit Template"** — a
  step-by-step recipe for introducing new studies / visit-type sets. Covers
  the mental model (concepts + field sets + visit types in CODE_LOOKUP), the
  inventory questions to answer before writing code, the migration skeleton,
  self-healing upserts, importer scaffolding, and a per-step pointer back to
  the Stroke-Lipid worked example. Future studies can be set up by copying
  the recipe rather than re-deriving the pattern.

### Grid view (more)

- **Compact column widths** (50+ Stroke-Lipid columns no longer overflow on a
  standard laptop screen): text columns 150 → 90 px, date 120 → 96 px,
  numeric 100 → 72 px, medication 120 → 84 px. Header text scaled down to
  match (0.7 / 0.6 rem).
- **Focus-column mode**: clicking an observation column header expands that
  one column to 220 px with a subtle blue tint, leaving the rest of the grid
  compact. Click again to collapse, click a different header to switch.
  180 ms transition.

### Export pipeline (CSV + HL7-JSON)

- **Headless export driver** `scripts/import-fw-lipid/export.js` — runs the same
  `ExportService` the app's UI uses, against `production.db` from a Node CLI:

  ```bash
  node export.js                     # both formats, all FW_LIPID patients
  node export.js --format csv        # CSV only
  node export.js --format hl7        # HL7-JSON only
  node export.js --limit 10          # first N (smoke)
  ```

  Mounts a `RealSQLiteConnection` + the five repositories (Patient / Visit /
  Observation / Concept / Cql) and shims a minimal `DatabaseService.getRepository`
  facade so the export path runs unchanged outside the Electron/Pinia boot.

- **Artifact-level verifier** `scripts/import-fw-lipid/export-verify.js` — parses
  the export file directly (no round-trip via import service) and checks every
  cell / entry against the DB state under the same `SOURCESYSTEM_CD`. Reports
  per-cell mismatches and writes a CSV diff if any.

- **Export-side fixes** required by the verifier to make all values round-trip
  safely:
  - `CsvService.formatObservationValue`: returns `''` (empty) instead of
    `'Unknown'` for cells with no value, so re-import treats them as "no
    observation" rather than as T-type `'Unknown'`. Adds explicit handling for
    `F` / `S` (selection answer ref in `TVAL_CHAR`) and prefers `TVAL_CHAR` over
    `START_DATE` for `D` (date) observations.
  - `Hl7Service.formatObservationValue`: same treatment plus emits `[NV]` marker
    for the 3-state numeric "assessed, explicitly no value" pattern.
  - **`[NV]` round-trip marker** in both formats: `VALUEFLAG_CD='NV'` numeric
    observations now serialise to `[NV]` on export; `CsvService.createObservationFromField`
    restores `VALTYPE='N', NVAL_NUM=NULL, VALUEFLAG_CD='NV'` on re-import.
  - `Hl7Service.verifyCda`: hash is now opt-in. Documents without an attached
    hash verify as true (enables headless round-trip / interchange JSON).
    Verification is still enforced when a hash IS present.

### Verified

- Full Stroke-Lipid export verified end-to-end against `production.db`:
  - CSV: 425 patients, 1037 visit rows, 53 columns, 21 969 non-empty cells,
    47 702 cells asserted, **0 mismatches**.
  - HL7-JSON: 425 patients, 1037 visit sections, 1084 sections total,
    21 969 concept-grouped entries asserted, **0 mismatches**.
- Test suite: 723 passing, 3 skipped, 0 failures (up from 717 — added six
  Stroke-Lipid pattern tests in `tests/unit/06_csv-service.test.js` covering NV
  3-state round-trip, F/S findings via SCTID Yes/No A-refs, D-type TVAL
  preference, empty-cell fallback; one HL7 test updated to assert the new
  opt-in signature behaviour).

### Grid view improvements

- **Visit-type chip under the visit date** in the Excel-like grid. Each row now
  shows the resolved visit-type label (e.g. *Stroke-Lipid V0 — Pre-Stroke Baseline*,
  *Parkinson Verlaufskontrolle*, *Routine Check-up*) with the icon + colour pulled
  from `CODE_LOOKUP(VISIT_DIMENSION/VISIT_TYPE_CD).LOOKUP_BLOB`. Loaded once per
  grid session, no per-row DB hit.
- **Category-banded column headers**: visible observation columns are now grouped
  by `CONCEPT_DIMENSION.CATEGORY_CHAR` into a top-level header band (Demographics →
  Vital Signs → Stroke → Laboratory → Medications → …). Helper
  `groupConceptsByCategory` in `src/shared/utils/grid-utils.js` produces the
  ordering; well-known clinical categories use a fixed clinical sequence, unknown
  ones are alphabetised, "Other" trails. Per-category background tints give scan
  cues on dense (50+ column) grids.
- **3-state numeric cell rendering** in `EditableCell.vue`: cells with
  `VALUEFLAG_CD='NV'` (e.g. drug explicitly not taken) now render a small grey
  `block` icon with tooltip *"Erfasst — kein Wert (nicht eingenommen / nicht
  zutreffend)"*, visually distinct from both a value cell and an empty cell.
  Click still opens the numeric editor.
- Grid-data pipeline (`database-store.processObservationDataForGrid`) now
  enriches each row with `visitTypeCode` (parsed from `VISIT_BLOB`), each
  observation cell with `valueFlag` (`VALUEFLAG_CD`), and each concept-column
  descriptor with `category` (`CATEGORY_CHAR`). Same one-shot batch query, just
  carrying three more fields downstream.

### Tests

- `tests/unit/14_grid-utils.test.js` — 9 cases covering `groupConceptsByCategory`
  (ordering, "Other" placement, intra-category stability, unknown-category
  alphabetisation) and smoke checks for existing helpers.

### Added

- **Migration `010-stroke-lipid-seed`** — seeds the Stroke-Lipid research study:
  - 50 concepts (16 study-specific drugs, 5 missing LOINC labs, 2 SNOMED comorbidities,
    9 study findings, 2 selection concepts with 9 A-type option codes, 3 visit-type
    markers, age-at-stroke, stroke-event-date, free-text concepts for symptoms/notes).
  - 5 field sets (`lipid_drugs`, `lipid_labor`, `lipid_pre_stroke`,
    `lipid_stroke_event`, `lipid_followup`) in `CODE_LOOKUP(VISIT_DIMENSION/FIELD_SET_CD)`
    with `{concepts[], categories[]}` for hybrid frontend matching.
  - 3 visit-types (`stroke_lipid_v0/v1/v2`) in `CODE_LOOKUP(VISIT_DIMENSION/VISIT_TYPE_CD)`
    with `LOOKUP_BLOB.fieldSets[]` referencing the field-set IDs.
  - 2 `VALUEFLAG_CD` lookups (`NV` = explicit no-value, `NI` = no information).
  - 1 `STUDY_DIMENSION` row + automatic patient enrollment via `STUDY_PATIENT_LOOKUP`.
- **`VALUEFLAG_CD='NV'` 3-state pattern** for numeric observations: distinguishes
  "asked, explicitly no value" (e.g. patient not taking drug) from "not assessed"
  (no observation at all). Reusable for any numeric concept; no schema change.
- **Stroke-Lipid XLSX importer** (`scripts/import-fw-lipid/`) — isolated Node module
  that imports research master tables into `production.db` with:
  - Idempotent re-runs (`SOURCESYSTEM_CD` tag, per-patient delete-and-rewrite).
  - Full-coverage verifier `spotcheck.js` (was 2 % sample, now defaults to 100 %).
    Cell-by-cell field assertions, orphan-observation detection, study-enrollment
    check, source-row deduplication (last row wins, matching importer behaviour),
    and `_spotcheck_failures.csv` artefact on any mismatch.
  - NBSP (U+00A0) normalisation on header keys (explicit ` ` Unicode escape
    in `spotcheck.js`; `import.js` still uses a literal NBSP byte that's working
    but fragile — TODO refactor).
  - Auto-computed age-at-stroke from `BIRTH_DATE + Datum_Stroke`.

### Verified

- Full Stroke-Lipid import verified end-to-end against the Mastertabelle
  (`Mastertabelle_Franzi_LDL_Daten_20260513.xlsx`):
  - 427 unique patient IDs in source (1 duplicate `10032698`, handled correctly
    via per-patient delete-and-rewrite).
  - 425 patients in DB, 2 legitimately skipped (no `Datum_Stroke` in source).
  - 1037 visits, 21 969 observations.
  - **34 136 cell-level assertions, 0 mismatches, 0 orphan observations,
    425/425 study enrolments.**

### Changed

- **F-type Finding observations** now store their answer in `TVAL_CHAR` as an A-type
  concept reference (`SCTID: 373066001` Yes / `SCTID: 373067005` No), aligning with
  how S-type Selections work. Previously some imports stored `NVAL_NUM = 0/1`, which
  rendered as "Uncategorized" in field-set views.
- **`CONCEPT_DIMENSION.CATEGORY_CHAR`** convention clarified: always use human-readable
  labels (`'Stroke'`, `'Demographics'`, `'Laboratory'`, `'Medications'`, `'Vital Signs'`,
  `'General'`) — never `CAT_*` codes. The frontend's field-set matcher compares against
  these labels.
- **`SCTID: 371484003` (Patient name)** moved from category `'General'` to `'Demographics'`
  (was previously rendering as "Uncategorized").
- **Migration pattern** documented: idempotent migrations should use
  `INSERT ... ON CONFLICT(<key>) DO UPDATE SET ...` for fields that must always reflect
  the migration's intent (self-healing).

### Documentation

- New `CHANGELOG.md` (this file).
- `AGENTS.md` — added "Data Modelling Conventions" section covering F-type findings,
  3-state numerics, CATEGORY_CHAR labels, concept-reuse hierarchy (LOINC → SNOMED →
  custom), visit-type ↔ field-set linkage, and bulk-import tagging.
- `IMPLEMENTATION_STATUS.md` — added Stroke-Lipid migration milestone.
- `scripts/import-fw-lipid/README.md` — full documentation of the research-import
  workflow, including 3-state pattern and rollback recipes.

## Past releases

The project does not yet have tagged releases. The entries below summarise notable
changes from the recent commit history (see `git log` for full detail).

### 2026-05-12

- `feat(visits)`: merged patient search into `/visits` as a single hub.
- `chore(datagrid)`: dropped dead `fillDown*` i18n keys after revert.
- Reverted Ctrl+D fill-down and keyboard cell-navigation features in the data grid
  pending UX revisit.

### 2026-04

- `feat(datagrid)`: undo/redo for cell edits.
- `fix(datagrid)`: show patient row when no visits exist.
- `test(dbBEST)`: smoke tests for UI-prep foundation (notify, session monitor, error boundary).
- `refactor(dbBEST)`: migrated all `$q.notify` calls to `useNotify` composable.

[Unreleased]: https://github.com/JenAIx/BEST/compare/v0.3_20260521...HEAD
[0.3_20260521]: https://github.com/JenAIx/BEST/releases/tag/v0.3_20260521
[0.2_20260516]: https://github.com/JenAIx/BEST/releases/tag/v0.2_20260516
