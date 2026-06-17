// MANUELLE FIXTURES — semantisches Netz mit HANDBEFÜLLTEN Antwortsätzen und
// VON HAND BERECHNETEN Erwartungswerten.
//
// Ergänzt den auto-befüllten Golden Master: hier sind die Eingaben bewusst
// gewählt und die erwarteten Scores per Kommentar nachgerechnet, sodass ein
// Refactor der Engine (ids-Pfad, Relabeling) inhaltlich abgesichert ist.
// Zusätzlich wird die KOMPLETTE summary (items + results) als Snapshot
// eingefroren — der bestehende Golden Master deckt nur results ab.
//
// Repräsentative Bögen decken alle Scoring-Konstrukte ab.
//
// Run: npm run test:unit test/jest/__tests__/questman_manual_fixtures.test.js

import { QUESTMAN } from '../../../src/tools/questman'

// Aktiviert den Bogen, ruft die Befüll-Funktion auf den (deep-kopierten) Items
// und liefert die summary OHNE die nicht-reproduzierbaren Datumsfelder.
function summaryFor(label, fill) {
  QUESTMAN.activeQuest = label
  expect(QUESTMAN.activeQuest).toBeDefined()
  fill(QUESTMAN.activeQuest.value.items)
  const s = QUESTMAN.summary
  const { date_start, date_end, ...rest } = s
  return rest
}
const dom = (s, label) => {
  const r = s.results.find((x) => x.label === label)
  return r ? r.value : undefined
}
const evalOf = (s, label) => {
  const r = s.results.find((x) => x.label === label)
  return r ? r.evaluation : undefined
}

describe('QuestMan manuelle Fixtures', () => {
  // --- BDI-2: value[]->score[]-Mapping inkl. Reverse, Domäne "sum", evaluation ---
  test('bdi2: sum + reverse-mapping + evaluation', () => {
    const s = summaryFor('bdi2', (items) => {
      items.forEach((it) => (it.value = 1)) // ids 1..21 = Antwort 1
      items[15].value = -2 // id16 (reverse-map): value -2 -> score 2
      items[17].value = -2 // id18 (reverse-map): value -2 -> score 2
    })
    // ids 1-15 -> 1 (=15) | id16 -> 2 | id17 -> 1 | id18 -> 2 | id19,20,21 -> 1 (=3)
    // sum = 15 + 2 + 1 + 2 + 3 = 23
    expect(dom(s, 'sum')).toBe(23)
    expect(evalOf(s, 'sum')).toBe('mittelgradiges depressives Syndrom') // Bereich 20-28
    expect(s).toMatchSnapshot()
  })

  // --- SUS: Domäne sum_multiply (x2.5) + Reverse-Scoring der geraden Items ---
  test('sus: sum_multiply x2.5 + reverse scoring', () => {
    const s = summaryFor('sus', (items) => {
      items[1].value = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] // alle 10 Sub-Fragen = 4
    })
    // ungerade ids (1,3,5,7,9): 4 -> 4  => 5*4 = 20
    // gerade ids (2,4,6,8,10): 4 -> reverse 0 => 0
    // Raw sum = 20 ; x2.5 = 50
    expect(dom(s, 'Raw sum')).toBe(50)
    expect(s).toMatchSnapshot()
  })

  // --- BFI-10: mehrere avg-Subskalen + Reverse-Scoring ---
  test('bfi10: avg subscales + reverse scoring', () => {
    const s = summaryFor('bfi10', (items) => {
      items[0].value = [1, 1, 1, 1, 1, 5, 5, 5, 5, 5] // Sub-Fragen id1..id5 = 1, id6..id10 = 5
    })
    // reverse ids (1,3,4,5,7): value->6-value ; identity ids (2,6,8,9,10)
    // Extraversion avg(id1=5, id6=5) = 5
    // Neurotizismus avg(id4=5, id9=5) = 5
    // Offenheit avg(id5=5, id10=5) = 5
    // Gewissenhaftigkeit avg(id3=5, id8=5) = 5
    // Verträglichkeit avg(id2=1, id7=1) = 1
    expect(dom(s, 'Extraversion')).toBe(5)
    expect(dom(s, 'Neurotizismus')).toBe(5)
    expect(dom(s, 'Offenheit')).toBe(5)
    expect(dom(s, 'Gewissenhaftigkeit')).toBe(5)
    expect(dom(s, 'Verträglichkeit')).toBe(1)
    expect(s).toMatchSnapshot()
  })

  // --- Falling Stick: per-Item raw + Domänen avg (Rundung auf 2 Nachkommastellen) ---
  test('falling_stick: raw + avg domains', () => {
    const s = summaryFor('falling_stick', (items) => {
      items[1].value = 145
      items[2].value = 152
      items[3].value = 148 // rechts = (145+152+148)/3 = 148.333.. -> 148.33
      items[5].value = 160
      items[6].value = 155
      items[7].value = 158 // links = (160+155+158)/3 = 157.666.. -> 157.67
    })
    expect(dom(s, 'rechts')).toBe(148.33)
    expect(dom(s, 'links')).toBe(157.67)
    expect(s).toMatchSnapshot()
  })

  // --- CAIDE: Top-Level "sum" ---
  test('caide: top-level sum', () => {
    const s = summaryFor('caide', (items) => {
      items[0].value = 4
      items[1].value = 1
      items[2].value = 3
      items[3].value = 2
      items[4].value = 2
      items[5].value = 2
      items[6].value = 1 // 4+1+3+2+2+2+1 = 15
    })
    expect(dom(s, 'sum')).toBe(15)
    expect(s).toMatchSnapshot()
  })

  // --- IQCODE: Top-Level "avg" über multiple_radio ---
  test('iqcode: top-level avg', () => {
    const s = summaryFor('iqcode', (items) => {
      items[2].value = [1, 2, 3, 4, 5, 1, 2] // 7 Sub-Fragen
    })
    // avg = (1+2+3+4+5+1+2)/7 = 18/7 = 2.571.. -> 2.57
    expect(dom(s, 'avg')).toBe(2.57)
    expect(s).toMatchSnapshot()
  })

  // --- Biomag Handedness: Top-Level "count" (Häufigkeit je Antwort) ---
  test('biomag_handedness: top-level count', () => {
    const s = summaryFor('biomag_handedness', (items) => {
      items[0].value = ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'both', 'both']
    })
    expect(dom(s, 'left')).toBe(3)
    expect(dom(s, 'right')).toBe(5)
    expect(dom(s, 'both')).toBe(2)
    expect(s).toMatchSnapshot()
  })

  // --- MWT-B: Top-Level "count_targets" (Anzahl korrekter Antworten = 1) ---
  test('mwtb: count_targets', () => {
    const s = summaryFor('mwtb', (items) => {
      for (let i = 4; i <= 13; i++) items[i].value = 1 // 10 korrekte
      for (let i = 14; i <= 40; i++) items[i].value = -1 // restliche falsch
    })
    expect(dom(s, 'correct')).toBe(10)
    expect(s).toMatchSnapshot()
  })

  // --- B-ADL: avg mit ignore_zeros (Marker-Werte -1/-2 -> Score 0, vom Divisor ausgenommen) ---
  test('badl: avg with ignore_zeros', () => {
    const s = summaryFor('badl', (items) => {
      // 25 Sub-Fragen: 10x Wert 3, 10x Wert 8, 5x Marker -1 (-> Score 0)
      items[3].value = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, -1, -1, -1, -1, -1]
    })
    // Scores: 10*3 + 10*8 + 5*0 = 110 ; count_zeros = 5 ; Divisor = 25-5 = 20
    // avg = 110/20 = 5.5  (ohne ignore_zeros wäre es 110/25 = 4.4)
    expect(dom(s, 'avg')).toBe(5.5)
    expect(s).toMatchSnapshot()
  })

  // --- CFS/ME: checkbox + count, sum_range, String-Ref-Verkettung, evaluation ---
  test('cfsme: count + sum_range + chained sum + evaluation', () => {
    const s = summaryFor('cfsme', (items) => {
      items[0].value = ['reduction_activity_level', 'delayed_recovery_phase', 'worsening_by_stress'] // id1 count 3
      items[1].value = ['falling_asleep'] // id2 count 1
      items[2].value = ['joint_pain'] // id3 count 1
      items[3].value = ['impairement_concentrate_memory', 'difficulties_words_information'] // id4 count 2
      items[4].value = ['vertigo'] // id5 count 1
      items[5].value = ['body_temperature'] // id6 count 1
      items[6].value = [] // id7 count 0
      items[7].value = 8 // id8 raw (Dauer Monate)
    })
    // fatigue: 3 -> [3,999]=1 | sleep: 1 -> 1 | pain: 1 -> 1 | neurologic_cognitive: 2 -> [2,999]=1
    // others: id5+id6+id7 = 1+1+0 = 2 -> [2,999]=1 | duration: 8 -> [6,999]=1
    expect(dom(s, 'fatigue')).toBe(1)
    expect(dom(s, 'sleep')).toBe(1)
    expect(dom(s, 'pain')).toBe(1)
    expect(dom(s, 'neurologic_cognitive')).toBe(1)
    expect(dom(s, 'others')).toBe(1)
    expect(dom(s, 'duration')).toBe(1)
    // sum = 6 -> evaluation Bereich [6,99]
    expect(dom(s, 'sum')).toBe(6)
    expect(evalOf(s, 'sum')).toBe('Kriterien für CFS/ME erfüllt')
    expect(s).toMatchSnapshot()
  })

  // --- PSQI: multiply, range, sum_range, String-Ref-Verkettung (7 Komponenten -> Summe), evaluation ---
  test('psqi: multiply + range + sum_range + chained sum + evaluation', () => {
    const s = summaryFor('psqi', (items) => {
      items[2].value = 20 // id2 (Einschlaf-Latenz min) -> range [16,30]=1
      items[4].value = 7 // id31 (Schlafeffizienz) x10 = 70 -> efficiency [65,74.99]=2
      items[5].value = 4 // id4 (effektive Schlafzeit h) -> range [0,5]=3
      items[8].value = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // multiple_radio ids 6..15 alle = 1
      items[10].value = 2 // id16 (Schlafqualität)
      items[11].value = 1 // id17 (Schlafmittel)
      items[12].value = 1 // id18 (wach bleiben)
      items[13].value = 2 // id19 (Schwung)
    })
    // duration(id4)=3 | disturbance(ids7-15=9x1 -> 9 -> [1,9]=1) | latency(id6=1 + id2=1 -> 2 -> [1,2]=1)
    // day_dysfunction(id18=1 + id19=2 -> 3 -> [3,4]=2) | efficiency=2 | quality(id16)=2 | meds(id17)=1
    expect(dom(s, 'duration')).toBe(3)
    expect(dom(s, 'disturbance')).toBe(1)
    expect(dom(s, 'latency')).toBe(1)
    expect(dom(s, 'day_dysfunction')).toBe(2)
    expect(dom(s, 'efficiency')).toBe(2)
    expect(dom(s, 'quality')).toBe(2)
    expect(dom(s, 'meds')).toBe(1)
    // sum = 3+1+1+2+2+2+1 = 12 -> [6,99]
    expect(dom(s, 'sum')).toBe(12)
    expect(evalOf(s, 'sum')).toBe('schlechte Schlafqualität')
    expect(s).toMatchSnapshot()
  })

  // --- WHOQOL-BREF: avg_multiply -> sum_sub_multiply (verkettete Transformation), Reverse-Scoring ---
  test('whoqol: avg_multiply + chained sum_sub_multiply transform', () => {
    const s = summaryFor('whoqol', (items) => {
      // Trick: jedes gescorte Item bekommt Score 4 -> identity-Items = 4, reverse-Items (3,4,26) = 2 (->6-2=4)
      items[10].value = 4 // id1
      items[11].value = 4 // id2
      items[12].value = [2, 2, 4, 4] // ids 3,4 (reverse, ->4), 5,6 (->4)
      items[13].value = [4, 4, 4] // ids 7,8,9
      items[14].value = [4, 4, 4, 4, 4] // ids 10-14
      items[15].value = [4] // id15
      items[16].value = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] // ids 16-25
      items[17].value = [2] // id26 (reverse, ->4)
    })
    // Jede Basis-Domäne: avg(lauter 4) * 4 = 16
    expect(dom(s, 'Physische Gesundheit')).toBe(16)
    expect(dom(s, 'Psychologische Gesundheit')).toBe(16)
    expect(dom(s, 'Soziale Beziehungen')).toBe(16)
    expect(dom(s, 'Umwelt')).toBe(16)
    // Transformation: (16 - 4) * 6.25 = 75
    expect(dom(s, 'Score_physisch')).toBe(75)
    expect(dom(s, 'Score_psychisch')).toBe(75)
    expect(dom(s, 'Score_sozial')).toBe(75)
    expect(dom(s, 'Score_umwelt')).toBe(75)
    expect(s).toMatchSnapshot()
  })

  // --- TWSTRS: sum_multiply + String-Ref-Verkettung. Schmerzgrad ist eine INTERNE
  //     Domäne (internal:true): wird berechnet und von III_Schmerz genutzt, aber NICHT
  //     ausgegeben. III_Schmerz/sum bleiben unverändert.
  test('twstrs: sum_multiply + chained pain domain (internal Schmerzgrad)', () => {
    const s = summaryFor('twstrs', (items) => {
      items[2].value = 2 // id1
      items[3].value = 2 // id2
      items[5].value = 2 // id31
      items[6].value = 2 // id32
      items[7].value = 1 // id4 (0-1)
      items[8].value = 1 // id5 (0-1)
      items[9].value = 2 // id6
      items[10].value = 2 // id7
      items[11].value = 2 // id8
      items[12].value = 2 // id9
      items[13].value = 2 // id10
      items[15].value = 3 // id11
      items[16].value = 3 // id12
      items[17].value = 3 // id13
      items[18].value = 3 // id14
      items[19].value = 3 // id15
      items[20].value = 3 // id16
      items[22].value = [4, 4, 4] // ids 17,18,19 (A[0],A[1],A[2]); 19 wird x2 gewichtet
      items[23].value = 3 // id20
      items[24].value = 2 // id21
    })
    // I_Schweregrad = 2+2+2+2+1+1+2+2+2+2+2 = 20
    // II_Aktivitaetseinschraenkung = 6x3 = 18
    // Schmerzgrad (intern) = (raw17 + raw18 + 2*raw19) * 0.25 = (4 + 4 + 8) * 0.25 = 4
    // III_Schmerz = id20 + id21 + Schmerzgrad = 3 + 2 + 4 = 9
    // sum = 20 + 18 + 9 = 47
    expect(dom(s, 'I_Schweregrad')).toBe(20)
    expect(dom(s, 'II_Aktivitaetseinschraenkung')).toBe(18)
    expect(dom(s, 'Schmerzgrad')).toBeUndefined() // intern -> nicht im Ergebnis
    expect(dom(s, 'III_Schmerz')).toBe(9) // nutzt Schmerzgrad intern weiter
    expect(dom(s, 'sum')).toBe(47)
    expect(s).toMatchSnapshot()
  })
})
