/* eslint-disable jest/expect-expect */
// Run Test with:
// * npm run test:unit test/jest/__tests__/storage_export_hl7.test.js 

import { STORAGE } from "../../../src/tools/Storage"
import { QUESTMAN } from "../../../src/tools/questman"
import { USER } from "../../../src/tools/User"

import * as CDA from "../../../src/tools/CDA_H7_JSON"


describe('Test the CDA-HL7-JSON Export', () => {

  it('Perform hl7 json export', () => {
    QUESTMAN.activeQuest = 'sf36';
    expect(QUESTMAN.activeQuest).not.toBe(undefined)
    expect(QUESTMAN.random_fill()).toBeTruthy()

    const summary = QUESTMAN.summary
    
    USER.create()
    
    const document = CDA.import_quest({
      data: {
        PID: 'someRandomPID',
        quest: summary
      },
      investigator: {
        uid: USER.uid,
        keyPair: USER.keyPair
      }
    })

    expect(document).not.toBe(undefined)
    expect(document.cda).not.toBe(undefined)
    expect(document.hash).not.toBe(undefined)
    expect(document.exported).not.toBe(undefined)

    STORAGE.clear()
    STORAGE.add(document)
  })

  it('can get a cda from the STORAGE', () => {
    const document = STORAGE.get(0)

    expect(document).not.toBe(undefined)
    expect(document.cda).not.toBe(undefined)
    expect(document.hash).not.toBe(undefined)
    expect(document.exported).not.toBe(undefined)

  })

  it('formatiert die Uhrzeit im 24-Stunden-Format (HH, kein 12h-Bug)', () => {
    // 14:30 lokale Zeit → getHours() ist immer 14, unabhängig von der CI-Zeitzone.
    const ts = new Date(2026, 0, 1, 14, 30, 0).getTime()
    USER.create()
    const document = CDA.import_quest({
      data: {
        PID: 'pid',
        date: ts,
        quest: { ...QUESTMAN.summary, date_start: ts, date_end: ts },
      },
      investigator: { uid: USER.uid, keyPair: USER.keyPair },
    })
    // Vorher ('h'): 14:30 → "2:30". Jetzt ('HH'): "14:30".
    expect(document.cda.date).toContain('T14:30')
    expect(document.cda.event[0].period.start).toContain('T14:30')
    expect(document.cda.date).not.toContain('T2:30')
  })

})
