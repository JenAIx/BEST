<template>
  <q-page>
    <div class="page-container help-container">
      <PageHeader :title="$t('help.title')" :subtitle="$t('help.subtitle')">
        <q-input v-model="filter" dense outlined :placeholder="$t('help.searchPlaceholder')" clearable style="min-width: 220px">
          <template v-slot:prepend>
            <q-icon name="search" size="18px" />
          </template>
        </q-input>
      </PageHeader>

      <div class="row q-col-gutter-lg">
        <!-- TOC -->
        <div class="col-12 col-md-3 gt-sm">
          <q-list dense class="help-toc content-box q-py-sm">
            <q-item v-for="section in visibleSections" :key="section.id" clickable :active="activeSection === section.id" active-class="text-primary text-weight-bold" @click="scrollTo(section.id)">
              <q-item-section avatar class="toc-icon">
                <q-icon :name="section.icon" size="18px" />
              </q-item-section>
              <q-item-section>{{ section.title }}</q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- Content -->
        <div class="col-12 col-md-9">
          <div v-if="visibleSections.length === 0" class="content-box q-pa-lg text-center text-grey-6">
            <q-icon name="search_off" size="40px" class="q-mb-sm" />
            <div>{{ $t('help.noResults') }}</div>
          </div>

          <div v-for="section in visibleSections" :key="section.id" :id="`help-${section.id}`" class="help-section content-box q-pa-lg q-mb-md">
            <div class="row items-center q-gutter-sm q-mb-sm">
              <q-icon :name="section.icon" color="primary" size="26px" />
              <h2 class="help-section-title q-ma-none">{{ section.title }}</h2>
            </div>

            <p v-for="(paragraph, i) in section.paragraphs" :key="`p-${i}`" class="help-text">{{ paragraph }}</p>

            <img v-if="section.image" :src="`help/${section.image}.png`" :alt="section.title" class="help-screenshot" @click="lightbox = section.image" />

            <template v-for="(sub, si) in section.subsections" :key="`sub-${si}`">
              <h3 class="help-sub-title">{{ sub.title }}</h3>
              <p v-for="(paragraph, i) in sub.paragraphs" :key="`sp-${i}`" class="help-text">{{ paragraph }}</p>
              <ul v-if="sub.bullets" class="help-list">
                <li v-for="(bullet, bi) in sub.bullets" :key="`sb-${bi}`">{{ bullet }}</li>
              </ul>
              <img v-if="sub.image" :src="`help/${sub.image}.png`" :alt="sub.title" class="help-screenshot" @click="lightbox = sub.image" />
            </template>

            <ul v-if="section.bullets" class="help-list">
              <li v-for="(bullet, bi) in section.bullets" :key="`b-${bi}`">{{ bullet }}</li>
            </ul>

            <template v-if="section.steps">
              <div class="text-subtitle2 q-mt-md q-mb-xs">{{ section.stepsTitle || $t('help.stepsTitle') }}</div>
              <ol class="help-steps">
                <li v-for="(step, sti) in section.steps" :key="`st-${sti}`">{{ step }}</li>
              </ol>
            </template>

            <q-banner v-if="section.tip" dense rounded class="bg-blue-1 text-blue-9 q-mt-md">
              <template v-slot:avatar>
                <q-icon name="lightbulb" size="20px" />
              </template>
              {{ section.tip }}
            </q-banner>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <q-dialog v-model="lightboxOpen">
      <q-card class="lightbox-card">
        <img v-if="lightbox" :src="`help/${lightbox}.png`" class="lightbox-img" />
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import PageHeader from 'src/components/shared/PageHeader.vue'

defineOptions({
  name: 'HelpPage',
})

const filter = ref('')
const activeSection = ref(null)
const lightbox = ref(null)

const lightboxOpen = computed({
  get: () => !!lightbox.value,
  set: (v) => {
    if (!v) lightbox.value = null
  },
})

const scrollTo = (id) => {
  activeSection.value = id
  document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---------------------------------------------------------------------------
// Hilfe-Inhalte (deutsch). Struktur: Abschnitt → Absätze/Screenshots/Listen.
// Screenshots liegen in public/help/ und werden mit
// `node scripts/help-screenshots/capture.js` neu erzeugt (siehe README dort).
// ---------------------------------------------------------------------------
const sections = [
  {
    id: 'overview',
    icon: 'medical_services',
    title: 'Überblick',
    paragraphs: [
      'BEST (Base for Experiment Storage & Tracking) ist eine Forschungsdatenbank für neurowissenschaftliche und klinische Daten. Die Anwendung verwaltet Patienten, Besuche (Visiten), klinische Beobachtungen, Fragebögen und Forschungsstudien in einer lokalen SQLite-Datenbank — alle Daten bleiben auf Ihrem Rechner.',
      'Die Oberfläche ist zweisprachig (Deutsch/Englisch, umschaltbar über das Globus-Symbol in der Kopfzeile) und in drei Bereiche gegliedert: die Seitenleiste links für die Navigation, die Kopfzeile mit globaler Patientensuche, Benachrichtigungen und Benutzermenü, sowie der Inhaltsbereich. Die Seitenleiste zeigt im Ruhezustand nur Symbole und klappt beim Überfahren mit der Maus auf.',
    ],
    image: 'dashboard',
    tip: 'Wenn Sie mit der Maus über den Titel einer Seite fahren, zeigt ein Tooltip den internen Routen-Pfad an — hilfreich, wenn Sie ein Problem melden möchten.',
  },
  {
    id: 'concepts',
    icon: 'schema',
    title: 'Konzepte & Datenmodell',
    paragraphs: ['Alle Daten folgen einem einfachen Grundmodell — wer es kennt, findet sich überall in der App zurecht:'],
    bullets: [
      'Patient: die zentrale Akte mit Demografie (Alter, Geschlecht, Vitalstatus). Jeder Patient hat eine eindeutige Patienten-ID.',
      'Visite (Besuch): ein Kontakt/Termin des Patienten zu einem Datum, mit Visitentyp (z. B. Erstvorstellung, Verlaufskontrolle, Studienvisite V0/V1/V2). Der Visitentyp bestimmt, welche Eingabefelder angeboten werden.',
      'Beobachtung: ein einzelner Messwert oder Befund innerhalb einer Visite — z. B. ein Laborwert, ein Medikament mit Dosis, ein Ja/Nein-Befund oder ein Fragebogen-Score.',
      'Konzept: die standardisierte Definition einer Beobachtung (SNOMED CT, LOINC, ICD-10 oder eigene Codes). Konzepte sorgen dafür, dass „LDL-Cholesterin“ überall dasselbe bedeutet.',
      'Werttypen einer Beobachtung: Zahl (mit Einheit), Text, Datum, Ja/Nein-Befund, Auswahl aus einer Liste, Medikament (Wirkstoff, Dosis, Schema), Fragebogen und Datei (PDF/Bild/Video an einer Visite). Jede Beobachtung trägt ihr eigenes Datum — standardmäßig das der Visite, bei Bedarf abweichend (z. B. Laborabnahme an einem anderen Tag).',
      'Drei Zustände bei Zahlenwerten: ein Wert = gemessen; „kein Wert“ (NV, ∅) = erfragt, aber bewusst kein Wert (etwa Medikament nicht eingenommen); gar keine Beobachtung = nicht erhoben. So bleibt „0“ von „unbekannt“ unterscheidbar.',
      'Prüfmarkierung (Audit): Jede Beobachtung kann „zur Prüfung“ markiert (roter Rahmen) oder als „geprüft“ bestätigt (grüner Rahmen) werden — in der Datentabelle wie in der Zeitlinie. Zu jeder Beobachtung führt die App einen Prüfverlauf: wer wann markiert, bestätigt oder kommentiert hat und ob eine Wertänderung die Markierung zurückgesetzt hat. Details im Abschnitt „Datenprüfung (Audit)“.',
      'Feldgruppen: Der Visitentyp verweist auf Feldgruppen (z. B. „Labor“, „Medikamente“), und jede Feldgruppe listet die Konzepte, die dort erfasst werden. Administratoren pflegen beides unter „Globale Einstellungen“ — neue Studienvisiten brauchen keine Programmierung.',
      'Studie: fasst Patienten zu einer Kohorte zusammen. Patienten werden mit Einschlussdatum eingeschrieben (Status: aktiv, abgeschlossen, zurückgezogen) und können studienspezifische Visiten erhalten. Das Einschlussdatum ist die Basis für Zeitraum-Auswertungen in den Kohorten-Insights.',
      'Sichtbarkeit: Jeder Patient hat einen Besitzer (Ersteller). „Öffentliche“ Patienten sehen alle Nutzer, private nur der Besitzer und Administratoren. Löschen darf nur der Besitzer oder ein Admin.',
      'Bearbeiter: Jede gespeicherte Beobachtung merkt sich den zuletzt bearbeitenden Benutzer; die Team-Aktivität in den Studien-Insights und die Audit-Übersicht bauen darauf auf.',
      'Rollen: Administratoren sehen zusätzlich die Bereiche Konzepte, CQL, Benutzerverwaltung, Globale Einstellungen und Datenbank-Test.',
    ],
    tip: 'Alle Daten liegen in einer einzigen SQLite-Datei (Sternschema nach i2b2-Vorbild: Patient → Visite → Beobachtung, Konzepte als Dimension). Beim Öffnen einer älteren Datei aktualisiert die App das Schema automatisch — ein Backup vorab ist trotzdem gute Praxis.',
  },
  {
    id: 'login',
    icon: 'login',
    title: 'Anmeldung',
    paragraphs: [
      'Beim Start wählen Sie die Datenbank (in der Regel „Production Database“) und melden sich mit Benutzername und Passwort an. „Angemeldet bleiben“ hält die Sitzung über einen Neustart hinweg offen.',
      'Nach einem administrativen Passwort-Reset führt Sie die App beim nächsten Login automatisch zur Passwort-Änderung in den Einstellungen.',
    ],
    image: 'login',
  },
  {
    id: 'dashboard',
    icon: 'dashboard',
    title: 'Dashboard',
    paragraphs: [
      'Das Dashboard ist die Startseite nach der Anmeldung. Oben liegen drei Schnellaktionen: Patienten & Besuche öffnen, einen neuen Patienten anlegen und der Schnell-Import. Darunter zeigen Karten die zuletzt bearbeiteten Patienten (mit Besitzer-Kennzeichnung), die aktuellen Studien und die Tagesstatistik.',
      'Die Patientenkarten sind überall in der App identisch: Ein Klick öffnet die Besuchsansicht des Patienten, ein Rechtsklick öffnet das Kontextmenü mit Aktionen wie „Besuche öffnen“, „ID kopieren“, Studienzuordnung, Export sowie (für Besitzer/Admins) Sichtbarkeit und Löschen.',
    ],
    image: 'dashboard',
  },
  {
    id: 'visits',
    icon: 'people',
    title: 'Patienten & Besuche',
    paragraphs: [
      'Der Bereich „Patientenbesuche“ (Seitenleiste → Patientenverwaltung) ist die zentrale Anlaufstelle für die Patientenarbeit. Die Suchseite bietet eine Live-Suche nach Name oder Patienten-ID, erweiterte Filter (Alter, Geschlecht, Vitalstatus, Studie) über das Regler-Symbol und den Schalter „Nur meine Patienten“. Darunter erscheinen die zuletzt verwendeten Patienten.',
    ],
    image: 'visits',
    subsections: [
      {
        title: 'Die Patientenansicht (Vollbild)',
        paragraphs: [
          'Ein Klick auf einen Patienten öffnet dessen Akte im Vollbildmodus — bewusst ohne Seitenleiste, wie der Datentabellen-Editor. Der Zurück-Pfeil oben links führt wieder dorthin, wo Sie herkamen. Der violette Kopfbereich zeigt die Stammdaten; rechts wechseln Sie zwischen zwei Ansichten:',
        ],
        bullets: [
          'Zeitlinie: alle Visiten als aufklappbare Karten am Zeitstrahl, links eine Schnellnavigation der Feldgruppen. Der Stift am Visitenkopf startet die Bearbeitung direkt in der Karte (Feldgruppen des Visitentyps, Autosave); über das 3-Punkte-Menü lassen sich Visiten klonen oder löschen, unten können Dateien (PDF, Bild, Video) an eine Visite angehängt werden.',
          'Datenprüfung (Audit) direkt in der Zeitlinie: Rechtsklick auf eine Kachel (oder das Flaggen-Symbol im Feldkopf während der Bearbeitung) markiert eine Beobachtung „zur Prüfung“ (roter Rahmen), löst sie auf (grün) oder entfernt die Markierung. „Prüfung & Kommentare …“ öffnet den Verlauf der Beobachtung — wer wann markiert oder bestätigt hat — samt Kommentarfunktion; ein Klick auf das Flaggen-Eck einer Kachel tut dasselbe. Der Chip „N Audits offen“ neben der Suche filtert die Zeitlinie auf offene Prüfungen.',
          'Patientendaten: Stammdaten bearbeiten, Statistiken, Studienmitgliedschaften (mit Status-Umschalter und Entfernen) sowie die Rechte-Karte (Besitzer, öffentlich/privat).',
        ],
        image: 'visits-patient',
      },
      {
        title: 'Patientendaten & Rechte',
        paragraphs: [
          'Im Tab „Patientendaten“ verwalten Sie neben den Stammdaten auch die Sichtbarkeit: Der Öffentlich-Schalter macht den Patienten für alle Nutzer sichtbar; der Besitzer kann übertragen werden. Änderungen an Sichtbarkeit und Besitzer dürfen Admins, der Besitzer selbst — und bei besitzerlosen öffentlichen Patienten jeder angemeldete Nutzer.',
        ],
        image: 'patient-data',
      },
    ],
    tip: 'Neue Patienten sind standardmäßig „öffentlich“. Den Schalter dafür finden Sie direkt im Anlege-Dialog.',
  },
  {
    id: 'questionnaires',
    icon: 'quiz',
    title: 'Fragebögen',
    paragraphs: [
      'Der Fragebogen-Bereich führt in fünf Schritten durch die Erhebung: Patient wählen → Visite wählen (oder anlegen) → Fragebogen auswählen → ausfüllen → abschicken. Die Antworten werden als Beobachtungen an der gewählten Visite gespeichert; berechnete Scores (z. B. BDI-II) landen automatisch mit im Datensatz.',
      'Welche Fragebögen zur Verfügung stehen, konfigurieren Administratoren unter Globale Einstellungen (Questionnaire-Definitionen im JSON-Format).',
    ],
    image: 'questionnaires',
  },
  {
    id: 'studies',
    icon: 'science',
    title: 'Studien',
    paragraphs: [
      'Die Studienseite listet alle Forschungsstudien mit Suchfeld, Kategorien-Chips und Statuskennzahlen. Die Badges auf den Karten zeigen den Abschluss-Fortschritt („x/y abgeschlossen“) und offene Daten-Audits.',
    ],
    image: 'studies',
    subsections: [
      {
        title: 'Studiendetails',
        paragraphs: [
          'Die Detailseite einer Studie bündelt Stammdaten (bearbeitbar), Einschreibungs-Fortschritt und drei Tabs: „Übersicht“ mit der Patientenliste, „Kohorten-Insights“ mit Auswertungen und „Audit“ mit den offenen Datenprüfungen.',
          'Patienten schreiben Sie über das Rechtsklick-Menü einer Patientenkarte („Studie zuordnen“) oder direkt auf der Studienseite ein. Der Einschreibestatus (aktiv/abgeschlossen/zurückgezogen) lässt sich am Status-Chip jeder Patientenkarte umschalten; „Gefilterte als abgeschlossen markieren“ erledigt das für eine ganze Auswahl. Der Kohorten-Export (CSV oder HL7-JSON) liegt oben rechts, der Sprung in den Datentabellen-Editor öffnet die ausgewählten Patienten direkt dort.',
        ],
        image: 'study-details',
      },
      {
        title: 'Kohorten-Insights',
        paragraphs: [
          'Der Tab fasst die Kohorte in Karten zusammen: „Visiten-Verlauf“ (Eingeschriebene und je Visitentyp die Patienten, die diese Visite haben), „Medikamenten-Nutzung“ (nehmen / erfragt), „Komorbiditäten“, die Auswahlverteilungen (Ätiologie, Event-Typ), „Team-Aktivität“ (Patienten und Beobachtungen pro Benutzer) und „Lab-Verlauf“ (Median je Visite).',
        ],
        bullets: [
          'Einschluss-Zeitraum: Die Felder „von/bis“ im Kopf des Visiten-Verlaufs grenzen die Kacheln auf Patienten ein, die in diesem Zeitraum eingeschlossen wurden — die Visiten zählen unabhängig vom Visitendatum. So lassen sich Teilkohorten getrennt betrachten, z. B. „bis 14.09.2025“ und „ab 15.09.2025“. Der Filter bleibt beim Tab-Wechsel erhalten; das × setzt ihn zurück.',
          'Einschlüsse pro Monat: Das Balkendiagramm zählt die neu eingeschlossenen Patienten je Kalendermonat vom ersten Einschluss bis heute (Lücken als Nullmonate). Die Kennzahlenzeile nennt Gesamt, Durchschnitt pro Monat, die letzten 12 Monate und den stärksten Monat; beim Überfahren zeigt jeder Balken Monat, Anzahl und kumulierten Stand. Bei aktivem Zeitraum-Filter erscheinen Monate außerhalb grau.',
          'Die Zahlen berücksichtigen nur aktive und abgeschlossene Einschreibungen; zurückgezogene Patienten zählen nicht mit.',
        ],
        image: 'study-insights',
      },
      {
        title: 'Audit-Tab',
        paragraphs: [
          'Der Tab „Audit“ zeigt die offenen Prüfmarkierungen der Kohorte: Gesamtzahl, Verteilung pro Benutzer und eine Liste pro Patient mit Anzahl. Von dort springen Sie mit „Im Grid öffnen“ in den Datentabellen-Editor oder mit „Im Patientenbesuch öffnen“ in die Zeitlinie des Patienten — in beiden Fällen ist der Filter „Nur offene Audits“ bereits aktiv, sodass nur die zu prüfenden Werte sichtbar sind. Das Badge am Tab und auf der Studienkarte zählt die offenen Prüfungen.',
        ],
      },
    ],
    tip: 'Die App merkt sich Ihre zuletzt geöffnete Studie: Wer „Studien“ in der Seitenleiste wählt, landet direkt wieder in ihr. Der Zurück-Pfeil in der Studie führt zur Studienliste.',
  },
  {
    id: 'audit',
    icon: 'flag',
    title: 'Datenprüfung (Audit) & Kommentare',
    paragraphs: [
      'Die Prüfmarkierung ist das Werkzeug für die Datenqualität im Team: Wer einen Wert für fragwürdig hält, markiert ihn „zur Prüfung“; wer ihn geprüft hat, bestätigt ihn. Der Wert selbst bleibt dabei unverändert. Markierungen sind überall sichtbar, wo der Wert erscheint — Datentabelle, Zeitlinie, Studienseite und Dashboard — und lassen sich an jeder dieser Stellen setzen.',
    ],
    bullets: [
      'Zustände: roter Rahmen mit Flagge = „zur Prüfung markiert“ (offen); grüner Rahmen mit Häkchen = „geprüft“. „Prüfmarkierung entfernen“ nimmt beides zurück.',
      'Setzen und auflösen: in der Datentabelle per Rechtsklick auf die Zelle; in der Zeitlinie per Rechtsklick auf eine Kachel oder über das Flaggen-Symbol im Feldkopf während der Bearbeitung. Beim Auflösen wechselt die Markierung von rot auf grün.',
      'Kommentare und Verlauf: „Prüfung & Kommentare …“ (im Kontextmenü, oder ein Klick auf das Flaggen-Eck einer Kachel) öffnet den Dialog zur Beobachtung. Oben stehen Konzept, Wert und Zustand, darunter der Verlauf: jede Markierung, Bestätigung, Entfernung und jeder Kommentar mit Autor und Zeitpunkt. Ein eingetippter Kommentar wird an die gewählte Aktion angehängt; „Kommentar hinzufügen“ speichert ihn ohne Zustandswechsel (Strg+Enter). Eigene Kommentare lassen sich löschen, Administratoren dürfen alle löschen.',
      'Kommentar-Zähler: Kacheln mit Kommentaren zeigen neben der Flagge die Anzahl; die Kontextmenüs nennen sie ebenfalls.',
      'Wertänderung: Wird ein markierter Wert geändert, setzt die App die Markierung zurück — der Prüfverlauf hält das als „Markierung durch Wertänderung zurückgesetzt“ fest, damit nachvollziehbar bleibt, warum eine Flagge verschwunden ist. Soll der Wert erneut geprüft werden, markieren Sie ihn wieder.',
      'Filter: Der Chip „N Audits offen“ (Fußzeile der Datentabelle bzw. Kopf der Zeitlinie) blendet alles außer den offenen Prüfungen aus. In der Zeitlinie zeigt jede Visitenkarte zusätzlich ihren Zähler, ebenso die Schnellnavigation links.',
      'Löschen: Wird eine Beobachtung gelöscht, verschwindet ihr Prüfverlauf mit ihr.',
    ],
    image: 'audit-dialog',
    tip: 'Typischer Ablauf: markieren mit kurzem Kommentar („Wert unplausibel, bitte Laborbefund prüfen“) → Kollege korrigiert oder antwortet im Dialog → Prüfung auflösen. Der Studien-Tab „Audit“ zeigt jederzeit, wo noch etwas offen ist.',
  },
  {
    id: 'datagrid',
    icon: 'grid_on',
    title: 'Datentabelle (Excel-Editor)',
    paragraphs: [
      'Die Datentabelle ist das Werkzeug für die Massenbearbeitung: Beobachtungen vieler Patienten und Visiten in einer Excel-ähnlichen Matrix. Auf der Auswahlseite filtern Sie Patienten (Suche, Geschlecht, Status, Ersteller), wählen sie per Klick aus — die Auswahl bleibt für das nächste Mal gespeichert — und öffnen dann den Editor.',
    ],
    image: 'data-grid',
    subsections: [
      {
        title: 'Arbeiten im Editor',
        paragraphs: [
          'Jede Zeile ist eine Visite, jede Spalte ein Konzept; die farbigen Bänder gruppieren Spalten nach Kategorie (Demografie, Labor, Medikamente …). Zellen werden per Klick direkt bearbeitet, Tab/Enter navigiert, Änderungen speichern automatisch. Rückgängig/Wiederholen liegt in der Kopfzeile, ebenso Zoom und die Visitentyp-Sperre.',
        ],
        bullets: [
          'Visitentyp-Sperre (Kalender-Schloss-Symbol neben dem Zoom): blendet Zellen aus, deren Konzept nicht zum Visitentyp der Zeile gehört — schraffierte Zellen sind gesperrt, vorhandene Werte bleiben sichtbar.',
          'Rechtsklick auf eine Zelle: Wert löschen, „kein Wert“ (NV) setzen, Audit-Markierung (roter Rahmen = zu prüfen, grüner Rahmen = geprüft), „Prüfung & Kommentare …“ (Verlauf und Kommentare zur Beobachtung), Beobachtungsdatum abweichend von der Visite setzen.',
          'Fußzeile: Speicherstatus, Spalten-/Zellstatistik, „% ausgefüllt“ und der Audit-Chip — ein Klick darauf filtert die Ansicht auf offene Audits.',
          '„Hinzufügen“ in der Kopfzeile ergänzt Spalten (Konzepte), Visiten oder Patienten, ohne den Editor zu verlassen.',
        ],
        image: 'grid-editor',
      },
    ],
    tip: 'Drei-Zustands-Logik bei Zahlenwerten: Ein Wert bedeutet „gemessen“, das NV-Kästchen bedeutet „erfragt, aber bewusst kein Wert“, eine leere Zelle bedeutet „nicht erhoben“.',
  },
  {
    id: 'import-export',
    icon: 'import_export',
    title: 'Import & Export',
    paragraphs: [
      'Der Import führt in vier Schritten von der Datei zum Datensatz: Datei hochladen (CSV, JSON/HL7, XLSX, HTML-Fragebogen) → automatische Analyse mit Vorschau → Import-Modus wählen → Import ausführen. Die Analyse zeigt vorab, wie viele Patienten, Visiten und Beobachtungen erkannt wurden, und warnt bei Auffälligkeiten.',
      'Der Export stellt Patienten über dieselbe Filter- und Auswahlliste zusammen wie die Datentabelle; anschließend wählen Sie das Format (CSV für Tabellenkalkulation, HL7-JSON als FHIR-Composition) und die zu exportierenden Inhalte. Kohorten einer Studie exportieren Sie direkt von der Studiendetailseite.',
    ],
    image: 'import',
  },
  {
    id: 'smartbutton',
    icon: 'smart_toy',
    title: 'SmartButton: Notizen, Nachrichten & Werkzeuge',
    paragraphs: [
      'Der runde Knopf unten rechts schwebt über allen Seiten und öffnet eine Werkzeug-Palette: Quick Notes, Rechner, Einheiten-Umrechner, BMI-Rechner, Levodopa-Äquivalenz-Rechner, KI-Assistent und Text-Umformulierung. Jedes Werkzeug öffnet ein eigenes schwebendes Fenster, das den Hintergrund nicht blockiert — Sie können also weiterarbeiten, das Fenster an der Titelzeile verschieben, minimieren (es parkt als kleine Karte unten links) oder mehrere Werkzeuge gleichzeitig offen halten.',
    ],
    image: 'smartbutton-notes',
    subsections: [
      {
        title: 'Quick Notes',
        paragraphs: [
          'Notizen werden dauerhaft gespeichert und merken sich ihren Kontext: Ist gerade ein Patient, eine Studie oder eine bestimmte Seite geöffnet, hängt die Notiz einen klickbaren Chip an, der später direkt dorthin zurückspringt. Der Tab „Neue Notiz“ zeigt die letzten drei Notizen, der Tab „Notizen“ die vollständige Liste mit Suche, Bearbeiten und Löschen. Jeder Nutzer sieht nur seine eigenen Notizen.',
        ],
      },
      {
        title: 'Nachrichten (Messenger)',
        paragraphs: [
          'Im Tab „Nachrichten“ schreiben Sie anderen Nutzern — Empfänger wählen, Text senden, fertig. „An alle“ erreicht als Rundnachricht jeden Nutzer. Ungelesene Nachrichten zeigt ein rotes Zähler-Badge direkt am SmartButton; das Öffnen des Tabs markiert sie als gelesen. Mit dem Antworten-Pfeil reagieren Sie direkt, und auch Nachrichten tragen den Patienten-/Studien-Kontext als klickbaren Chip — ideal für „Schau dir diesen Patienten an“.',
          'Die Empfänger-Auswahl filtert gleichzeitig die Nachrichtenliste: Wählen Sie z. B. eine Kollegin aus, sehen Sie darunter nur die Konversation mit ihr.',
        ],
      },
    ],
  },
  {
    id: 'admin',
    icon: 'admin_panel_settings',
    title: 'Administration (nur Admins)',
    paragraphs: ['Administratoren sehen in der Seitenleiste den zusätzlichen Bereich „Administration“:'],
    bullets: [
      'Konzepte: das medizinische Vokabular der Datenbank (SNOMED CT, LOINC, ICD-10, eigene Codes) durchsuchen, filtern, anlegen, bearbeiten und als CSV importieren/exportieren.',
      'CQL-Regeln: Validierungsregeln (Clinical Quality Language) verwalten und mit Konzepten verknüpfen — sie prüfen Eingaben, z. B. Wertebereiche.',
      'Benutzerverwaltung: Konten anlegen, Rollen (Admin/Benutzer) vergeben, Passwörter zurücksetzen; im Tab „Patient Access“ die Patient-Zuordnungen einzelner Nutzer pflegen.',
      'Globale Einstellungen: die CODE_LOOKUP-Konfiguration — Visitentypen, Feldgruppen (Field Sets) und Fragebogen-Definitionen als JSON. Hierüber sind neue Visitentypen ohne Programmierung möglich.',
      'Datenbank-Test: Verbindungs-Diagnose, Schema-Inspektion, Demo-Daten anlegen/löschen.',
    ],
    image: 'concepts',
  },
  {
    id: 'settings',
    icon: 'settings',
    title: 'Einstellungen',
    paragraphs: [
      'Unter Einstellungen (Benutzermenü oben rechts → Zahnrad) pflegen Sie Ihr Profil (Anzeigename), ändern Ihr Passwort und sehen Ihre Kontoinformationen. Die lokalen Einstellungen (z. B. Sprache, gemerkte Auswahl der Datentabelle) werden pro Gerät gespeichert.',
      'Die Sprache wechseln Sie jederzeit über das Globus-Symbol in der Kopfzeile — die gesamte Oberfläche schaltet sofort zwischen Deutsch und Englisch um.',
    ],
    image: 'settings',
  },
  {
    id: 'workflows',
    icon: 'route',
    title: 'Standard-Workflows',
    paragraphs: ['Die drei häufigsten Abläufe Schritt für Schritt:'],
    subsections: [
      {
        title: 'Neuen Patienten anlegen und Daten erfassen',
        bullets: [
          '1. Dashboard → „Neuer Patient“ (oder Patientenbesuche → „Patient hinzufügen“). Stammdaten eingeben, ggf. Sichtbarkeit und Studienzuordnung direkt im Dialog setzen.',
          '2. Die App öffnet die Patientenansicht. In der Zeitlinie „Neuer Besuch“ wählen — Datum und Visitentyp festlegen; die neue Visite öffnet direkt im Bearbeitungsmodus.',
          '3. Die Feldgruppen des Visitentyps ausfüllen (Vitalwerte, Labor, Medikamente …). Alles speichert direkt; „Fertig“ schließt die Bearbeitung.',
          '4. Optional: Über den Fragebogen-Bereich einen Score erheben — er landet an derselben Visite.',
        ],
      },
      {
        title: 'Studie durchführen und Datenqualität prüfen',
        bullets: [
          '1. Studie auf der Studienseite anlegen („Neue Studie“) mit Kategorie und Ziel-Patientenzahl.',
          '2. Patienten einschreiben: Rechtsklick auf Patientenkarten → „Studie zuordnen“, oder auf der Studienseite hinzufügen.',
          '3. Daten in der Datentabelle erfassen; unklare Werte per Rechtsklick mit einer Audit-Markierung versehen.',
          '4. Im Studien-Tab „Audit“ die offenen Prüfungen abarbeiten („Im Grid öffnen“ oder „Im Patientenbesuch öffnen“ springt mit aktivem Audit-Filter dorthin); Rückfragen als Kommentar an der Beobachtung hinterlassen („Prüfung & Kommentare …“), geprüfte Werte grün bestätigen.',
          '5. Abgeschlossene Patienten über den Status-Chip auf „abgeschlossen“ setzen; am Ende die Kohorte exportieren.',
        ],
      },
      {
        title: 'Einem Kollegen einen Patienten zeigen',
        bullets: [
          '1. Den Patienten öffnen (damit der Kontext gesetzt ist).',
          '2. SmartButton → Quick Notes → Tab „Nachrichten“: Empfänger wählen, kurze Nachricht schreiben, senden.',
          '3. Der Empfänger sieht das rote Badge am SmartButton, öffnet die Nachricht und springt über den Patienten-Chip direkt in die Akte.',
        ],
      },
    ],
  },
]

const visibleSections = computed(() => {
  const term = (filter.value || '').toLowerCase().trim()
  if (!term) return sections
  const matches = (text) => String(text || '').toLowerCase().includes(term)
  return sections.filter((section) => {
    if (matches(section.title)) return true
    if ((section.paragraphs || []).some(matches)) return true
    if ((section.bullets || []).some(matches)) return true
    if ((section.subsections || []).some((sub) => matches(sub.title) || (sub.paragraphs || []).some(matches) || (sub.bullets || []).some(matches))) return true
    return false
  })
})
</script>

<style lang="scss" scoped>
.help-container {
  max-width: 1100px;
}

.help-toc {
  position: sticky;
  top: 16px;

  .toc-icon {
    min-width: 32px;
  }
}

.help-section {
  scroll-margin-top: 12px;
}

.help-section-title {
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.3;
}

.help-sub-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 20px 0 8px;
}

.help-text {
  color: $grey-9;
  line-height: 1.6;
  margin-bottom: 10px;
}

.help-list {
  line-height: 1.6;
  color: $grey-9;
  padding-left: 22px;
  margin: 6px 0 12px;

  li {
    margin-bottom: 6px;
  }
}

.help-steps {
  line-height: 1.6;
  color: $grey-9;
  padding-left: 22px;

  li {
    margin-bottom: 6px;
  }
}

.help-screenshot {
  display: block;
  width: 100%;
  max-width: 860px;
  border: 1px solid $grey-4;
  border-radius: 8px;
  margin: 10px 0 14px;
  cursor: zoom-in;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.lightbox-card {
  max-width: 92vw;
  width: 1400px;
}

.lightbox-img {
  display: block;
  width: 100%;
}
</style>
