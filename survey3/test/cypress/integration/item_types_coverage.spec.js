/// <reference types="cypress" />
//
// E2E-Datenmodell-Abdeckung JE ITEM-TYP: echte UI-Interaktion → Prüfung der
// im Store gespeicherten Wert-FORM/-TYP (window.__mainStore.QUESTMAN.activeQuest).
// Ergänzt quest_store_coverage.spec.js (dort v. a. multiple_radio + Scoring) um
// die zuvor ungetesteten Typen: number, radio (numerisch & String), checkbox,
// date, date_year, time, slider, image — plus Fokus-Modus (onValue-Pfad).
//
// Items werden über ihre Listen-ID `#qitem_<index>` adressiert (RenderQuest.vue),
// der Wert direkt aus dem Store gelesen → prüft UI→Store-Reaktivität + Wert-Typ.

const route = (short) =>
  `/#/quest/${encodeURIComponent(JSON.stringify({ presets: short, mode: 'single' }))}`

// Liest den rohen item.value aus dem Store und ruft cb damit auf.
function storeValue(idx, cb) {
  cy.window().then((win) => {
    const items = win.__mainStore.QUESTMAN.activeQuest.value.items
    cb(items[idx].value)
  })
}

context('Item-type data model (UI → store)', () => {
  beforeEach(() => {
    cy.viewport(1280, 900) // Desktop → Listen-Modus
    cy.on('window:confirm', () => true)
  })

  it('number: Eingabe wird als Zahl gespeichert (nicht String)', () => {
    cy.visit(route('biomag_fw'))
    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('#qitem_0 input').first().type('42')
    storeValue(0, (v) => {
      expect(v).to.equal(42)
      expect(v).to.be.a('number')
    })
  })

  it('radio (numerisch): Skalar-Zahl im Store', () => {
    cy.visit(route('biomag_fw'))
    cy.get('#qitem_4 .q-radio').eq(1).click({ force: true }) // opts [0,1] → 1
    storeValue(4, (v) => {
      expect(v).to.equal(1)
      expect(v).to.be.a('number')
    })
  })

  it('radio (String-Wert): String bleibt erhalten', () => {
    cy.visit(route('biomag_fw'))
    cy.get('#qitem_6 .q-radio').eq(0).click({ force: true })
    storeValue(6, (v) => expect(v).to.equal('current every day smoker'))
  })

  it('checkbox: Mehrfachauswahl als Array gespeichert', () => {
    cy.visit(route('lecseq-adr'))
    cy.get('[data-cy=page_quest]').should('exist')
    // opts: ["V2","V3","V4","ungeplant","telefonisch","stationaer"]
    cy.get('#qitem_2 .q-checkbox').eq(0).click({ force: true })
    cy.get('#qitem_2 .q-checkbox').eq(2).click({ force: true })
    storeValue(2, (v) => {
      expect(v).to.be.an('array')
      expect(v).to.deep.equal(['V2', 'V4'])
    })
  })

  it('date: Eingabe als String DD.MM.YYYY', () => {
    cy.visit(route('lecseq-adr'))
    cy.get('#qitem_1 input').first().type('15.03.2024')
    storeValue(1, (v) => expect(v).to.equal('15.03.2024'))
  })

  it('date_year: Eingabe als String YYYY', () => {
    cy.visit(route('iqcode'))
    cy.get('#qitem_0 input').first().type('1985')
    storeValue(0, (v) => expect(v).to.equal('1985'))
  })

  it('time: Eingabe als String HH:mm (24h)', () => {
    cy.visit(route('psqi'))
    cy.get('#qitem_1 input').first().type('1430')
    storeValue(1, (v) => expect(v).to.equal('14:30'))
  })

  it('slider: Interaktion ergibt Zahl im Bereich', () => {
    cy.visit(route('eq5d'))
    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('#qitem_0 .q-slider').click() // Klick ~Mitte
    storeValue(0, (v) => {
      expect(v).to.be.a('number')
      expect(v).to.be.within(0, 100)
    })
  })

  it('image: nicht-interaktiv, kein Crash, summary verfügbar', () => {
    cy.visit(route('schnelles Demenzscreening'))
    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('#qitem_14 img').should('exist') // Bild gerendert
    cy.window().then((win) => {
      const summary = win.__mainStore.QUESTMAN.summary
      expect(summary).to.exist
      const img = win.__mainStore.QUESTMAN.activeQuest.value.items[14]
      expect(img.type).to.equal('image')
      expect(img.value).to.be.an('array') // Dateinamen, kein Score
    })
  })

  it('multiple_radio: Teilantwort setzt NUR ihren Slot (kein example_value/Seed-Leck)', () => {
    cy.visit(route('phq_9'))
    cy.get('[data-cy=page_quest]').should('exist')
    // nur Zeile 2 (index 2) beantworten, Spalte für Wert 2
    cy.get('#qitem_1 .mr-table tbody tr').eq(2).find('.q-radio').eq(2).click({ force: true })
    storeValue(1, (v) => {
      expect(v).to.be.an('array').with.length(9)
      expect(v[2]).to.equal(2)
      // alle anderen Slots bleiben null (nicht mit Beispiel-/Fremdwerten geseedet)
      expect(v.filter((_, i) => i !== 2).every((x) => x === null || x === undefined)).to.be.true
    })
  })

  it('Fokus-Modus: radio schreibt über onValue in den Store', () => {
    cy.visit(route('eq5d5l'))
    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('[data-cy=btn_toggle_focus]').click() // Liste → Fokus-Wizard
    // Schritt 1: PID
    cy.get('[data-cy=PID]').type('CY_FOCUS')
    cy.get('[data-cy=quest_next]').click()
    // Schritt 2: erste Frage (mobility, opts [1..5]) — Klick löst onValue + Auto-Advance aus
    cy.get('[data-cy=list_entries] .q-radio').eq(2).click({ force: true }) // → 3
    storeValue(0, (v) => {
      expect(v).to.equal(3)
      expect(v).to.be.a('number')
    })
  })
})
