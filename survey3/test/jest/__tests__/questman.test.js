// Run Test with:
// npm run test:unit test/jest/__tests__/questman.test.js 

import { QUESTMAN } from "../../../src/tools/questman"

describe('QuestMAN Class', () => {

  // GENERAL FUNCTOIN
  it('QuestMAN main functions', () => {
    expect(QUESTMAN.check()).toBeTruthy()
    expect(QUESTMAN.quest_list.length > 0).toBeTruthy()
    // console.log(QUESTMAN.quest_list)
    expect(QUESTMAN.get('bfi').short_title).toBe('bfi')
  });

    // ACTIVE QUEST
    it('QuestMAN active Quest', () => {
      expect(QUESTMAN.activeQuest).toBe(undefined)
      QUESTMAN.activeQuest = 'bsssfi';
      expect(QUESTMAN.activeQuest).toBe(undefined)
      QUESTMAN.activeQuest = 'bfi';
      expect(QUESTMAN.activeQuest).not.toBe(undefined)
      expect(QUESTMAN.activeQuest.label).toBe('bfi')
      expect(QUESTMAN.activeQuest.value.short_title).toBe('bfi')
    });

      // TEST RPESETS
    it('QuestMAN PRESETS', () => {
      expect(QUESTMAN.presets.length).toBe(0)
      QUESTMAN.presets = 'bdi2'
      QUESTMAN.presets = 'bdi'
      expect(QUESTMAN.presets.length).toBe(1)
      QUESTMAN.clear_preset()
      QUESTMAN.presets = ['bdi2', 'bdi', 'nihs']
      expect(QUESTMAN.presets.length).toBe(2)
      expect(QUESTMAN.next_preset).toBe('bdi2')
      expect(QUESTMAN.presets.length).toBe(1)
      expect(QUESTMAN.next_preset).toBe('nihs')
      expect(QUESTMAN.next_preset).toBe(undefined)
    });

    // GLOBALE KETTEN-POSITION (preset_total / preset_index)
    it('QuestMAN preset chain counters', () => {
      QUESTMAN.clear_preset()
      expect(QUESTMAN.preset_total).toBe(0)
      expect(QUESTMAN.preset_index).toBe(0)

      QUESTMAN.presets = ['bdi2', 'nihs', 'phq_9']
      expect(QUESTMAN.preset_total).toBe(3)
      expect(QUESTMAN.preset_index).toBe(0) // vor dem ersten next()

      expect(QUESTMAN.next()).toBe(true)
      expect(QUESTMAN.preset_index).toBe(1)
      expect(QUESTMAN.next()).toBe(true)
      expect(QUESTMAN.preset_index).toBe(2)
      expect(QUESTMAN.next()).toBe(true)
      expect(QUESTMAN.preset_index).toBe(3)
      // Kette erschöpft: next() false, Position bleibt am Gesamtwert
      expect(QUESTMAN.next()).toBe(false)
      expect(QUESTMAN.preset_index).toBe(3)
      expect(QUESTMAN.preset_total).toBe(3)

      // clear_preset() setzt die Zähler zurück
      QUESTMAN.clear_preset()
      expect(QUESTMAN.preset_total).toBe(0)
      expect(QUESTMAN.preset_index).toBe(0)

      // Einzelbogen (String): total 1
      QUESTMAN.presets = 'bdi2'
      expect(QUESTMAN.preset_total).toBe(1)
      expect(QUESTMAN.next()).toBe(true)
      expect(QUESTMAN.preset_index).toBe(1)
    });

    it('manipulation in active Quest does not alter the QUEST LIST', () => {
      QUESTMAN.activeQuest = 'bfi';
      QUESTMAN.activeQuest.value.short_title = 'bfi2'
      expect(QUESTMAN.activeQuest.value.short_title).toBe('bfi2')
      expect(QUESTMAN.get('bfi').short_title).toBe('bfi')
    });

    // RESULTS
    it('results creates a list with all results', () => {
      QUESTMAN.activeQuest = undefined;
      expect(QUESTMAN.activeQuest).toBe(undefined)
      expect(QUESTMAN.summary).toBe(undefined)
      QUESTMAN.activeQuest = 'bfi';
      const results = QUESTMAN.summary
      expect(results).not.toBe(undefined)
    });

    // FILL QUESTS
    it('can fill a NIHS (nihs) with random data', () => {
      QUESTMAN.activeQuest = 'nihs';
      expect(QUESTMAN.activeQuest).not.toBe(undefined)
      expect(QUESTMAN.random_fill()).toBeTruthy()
      expect(QUESTMAN.summary.results[0].value > 0).toBeTruthy()
    });

    it('can fill biomag_handedness with random data', () => {
      QUESTMAN.activeQuest = 'biomag_handedness';
      expect(QUESTMAN.activeQuest).not.toBe(undefined)
      expect(QUESTMAN.random_fill()).toBeTruthy()
      const summary = QUESTMAN.summary
      expect(QUESTMAN.summary.results.length > 0).toBeTruthy()
    });

    it('can fill sf36 with random data', () => {
      QUESTMAN.activeQuest = 'sf36';
      expect(QUESTMAN.activeQuest).not.toBe(undefined)
      // QUESTMAN.random_fill()
      expect(QUESTMAN.random_fill()).toBeTruthy()
      const summary = QUESTMAN.summary
      expect(QUESTMAN.summary.results.length > 0).toBeTruthy()
      expect(QUESTMAN.summary.results[0].label).toBe('Physical functioning')
    });

    it('can fill hads_d with random data', () => {
      QUESTMAN.activeQuest = 'hads_d';
      expect(QUESTMAN.activeQuest).not.toBe(undefined)
      expect(QUESTMAN.random_fill()).toBeTruthy()
      const summary = QUESTMAN.summary
      expect(QUESTMAN.summary.results.length > 0).toBeTruthy()
    });

    it('can fill mwtb with random data', () => {
      QUESTMAN.activeQuest = 'mwtb';
      expect(QUESTMAN.activeQuest).not.toBe(undefined)
      // QUESTMAN.random_fill()
      expect(QUESTMAN.random_fill()).toBeTruthy()
      const summary = QUESTMAN.summary
      expect(QUESTMAN.summary.results.length > 0).toBeTruthy()
    });

    // IMPORT/ADD: { ok, errors }-Kontrakt inkl. Schema-Validierung
    it('add() lehnt ungültige Bögen ab und akzeptiert valide', () => {
      expect(QUESTMAN.add(null).ok).toBe(false)
      expect(QUESTMAN.add('{ kein valides json').ok).toBe(false)
      // Pflichtfelder fehlen
      expect(QUESTMAN.add(JSON.stringify({ title: 'X' })).ok).toBe(false)
      // Item ohne type → Schema-Fehler
      const badType = QUESTMAN.add(JSON.stringify({
        title: 'Bad', short_title: '__test_bad__', items: [{ label: 'frage ohne typ' }],
      }))
      expect(badType.ok).toBe(false)
      expect(badType.errors.join(' ')).toMatch(/MISSING_TYPE/)
      // valider Minimal-Bogen
      const ok = QUESTMAN.add(JSON.stringify({
        title: 'Gut', short_title: '__test_ok__',
        items: [{ type: 'text', label: 'Name' }],
      }))
      expect(ok.ok).toBe(true)
      expect(QUESTMAN.quest_list).toContain('__test_ok__')
      // aufräumen, damit der Singleton-Zustand andere Tests nicht beeinflusst
      QUESTMAN.remove_by_name('__test_ok__')
    });

})
