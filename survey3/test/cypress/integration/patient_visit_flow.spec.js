/// <reference types="cypress" />
//
// E2E: kompletter Patienten-/Visiten-Flow in der echten UI (headless).
//   Patient anlegen → Visite → Fragebogen ergänzen → Vollständigkeit (0 %) →
//   ausfüllen → Entwurf (fortsetzbar) → abschließen (100 %) → Visite exportieren.
// Router läuft im Hash-Modus (/#/...).

context('Patient/Visit Flow', () => {
  // eindeutige PID je Lauf, damit Tests sich nicht überlagern
  const PID = `CY_${Date.now()}`

  beforeEach(() => {
    cy.viewport(1280, 900)
    // window.confirm bei Bedarf bestätigen (z. B. Export-Warnung)
    cy.on('window:confirm', () => true)
  })

  it('legt Patient + Visite an und sieht die LEC-SEQ-Vorlagen', () => {
    cy.visit('/#/patients')
    cy.get('[data-cy=page_patients]').should('exist')

    // Patient anlegen
    cy.get('[data-cy=new_pid]').type(PID)
    cy.get('[data-cy=btn_add_patient]').click()

    // → Patientenseite
    cy.get('[data-cy=page_patient]').should('exist')
    cy.contains(PID).should('exist')

    // geseedete LEC-SEQ-Vorlagen müssen in der Auswahl auftauchen
    cy.get('[data-cy=select_template]').click()
    cy.get('.q-menu').contains('LEC-SEQ V1 – Baseline').should('exist')
    // für den UI-Test eine leere Visite anlegen (ad-hoc Fragebögen)
    cy.get('.q-menu').contains('Leere Visite').click()
    cy.get('[data-cy=btn_add_visit]').click()

    // → Visitenseite
    cy.get('[data-cy=page_visit]').should('exist')
  })

  it('füllt einen Fragebogen aus: offen → Entwurf → abgeschlossen + Export', () => {
    // frische Visite über die Patientenseite
    cy.visit('/#/patients')
    cy.get('[data-cy=new_pid]').type(`${PID}_b`)
    cy.get('[data-cy=btn_add_patient]').click()
    cy.get('[data-cy=select_template]').click()
    cy.get('.q-menu').contains('Leere Visite').click()
    cy.get('[data-cy=btn_add_visit]').click()
    cy.get('[data-cy=page_visit]').should('exist')

    // Fragebogen MRS ergänzen (ein einzelnes Radio-Item)
    cy.get('[data-cy=select_questionnaire]').click().type('MRS')
    cy.get('.q-menu').contains('MRS').click()
    cy.get('[data-cy=btn_add_questionnaire]').click()

    // Slot ist offen mit 0 %
    cy.get('[data-cy=slot_item]').should('contain', 'offen').and('contain', '0 %')

    // ausfüllen
    cy.get('[data-cy=btn_fill_slot]').click()
    cy.get('[data-cy=page_visit_quest]').should('exist')
    cy.get('[data-cy=list_entries]').find('.q-radio').first().click({ force: true })

    // als Entwurf speichern → zurück zur Visite
    cy.get('[data-cy=btn_save_draft]').click()
    cy.get('[data-cy=page_visit]').should('exist')
    cy.get('[data-cy=slot_item]').should('contain', 'Entwurf')

    // Entwurf fortsetzen → gespeicherte Auswahl ist wiederhergestellt
    cy.get('[data-cy=btn_fill_slot]').click()
    cy.get('[data-cy=page_visit_quest]').should('exist')
    cy.get('[data-cy=list_entries]').find('[aria-checked=true]').should('exist')

    // abschließen → zurück zur Visite, Status abgeschlossen / 100 %
    cy.get('[data-cy=btn_finish]').click()
    cy.get('[data-cy=page_visit]').should('exist')
    cy.get('[data-cy=slot_item]').should('contain', 'abgeschlossen').and('contain', '100 %')

    // Visite exportieren → Erfolgsmeldung (alle Bögen abgeschlossen → kein Abbruch)
    cy.get('[data-cy=btn_export_visit]').click()
    cy.contains('Export erfolgreich').should('exist')
  })

  it('Visiten-Datum-Edit speichert ms-Timestamp (System-Datum)', () => {
    cy.visit('/#/patients')
    cy.get('[data-cy=new_pid]').type(`${PID}_d`)
    cy.get('[data-cy=btn_add_patient]').click()
    cy.get('[data-cy=select_template]').click()
    cy.get('.q-menu').contains('Leere Visite').click()
    cy.get('[data-cy=btn_add_visit]').click()
    cy.get('[data-cy=page_visit]').should('exist')

    // Visite-Datum editieren
    cy.get('[data-cy=btn_edit_visit]').click()
    cy.get('[data-cy=edit_date]').clear().type('2024-03-15')
    cy.get('[data-cy=btn_save_visit]').click()
    cy.get('[data-cy=page_visit]').should('exist')

    // im Store muss visit.date eine Zahl (ms) sein, kein Locale-String
    cy.hash().then((h) => {
      const id = h.split('/').pop()
      cy.window().then((win) => {
        const v = win.__mainStore.VISITMAN.get_visit(id)
        expect(v.date).to.be.a('number')
      })
    })
  })

  it('blockt unvollständige Visite beim Patienten-Export nicht stillschweigend', () => {
    cy.visit('/#/patients')
    cy.get('[data-cy=new_pid]').type(`${PID}_c`)
    cy.get('[data-cy=btn_add_patient]').click()
    cy.get('[data-cy=select_template]').click()
    cy.get('.q-menu').contains('Leere Visite').click()
    cy.get('[data-cy=btn_add_visit]').click()
    cy.get('[data-cy=page_visit]').should('exist')

    // Fragebogen ergänzen, aber NICHT ausfüllen
    cy.get('[data-cy=select_questionnaire]').click().type('MRS')
    cy.get('.q-menu').contains('MRS').click()
    cy.get('[data-cy=btn_add_questionnaire]').click()
    cy.get('[data-cy=slot_item]').should('contain', 'offen')

    // zurück zum Patienten und exportieren → keine abgeschlossenen Bögen → Hinweis „leer"
    cy.go('back')
    cy.get('[data-cy=page_patient]').should('exist')
    cy.get('[data-cy=btn_export_patient]').click()
    cy.contains('Nichts zu exportieren').should('exist')
  })
})
