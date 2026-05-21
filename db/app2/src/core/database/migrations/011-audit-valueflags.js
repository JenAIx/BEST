// Two extra VALUEFLAG_CD codes that power the Datentabellen-Editor audit
// workflow (right-click "Zur Prüfung markieren" / "Prüfung auflösen"):
//
//   AUDIT     — observation flagged for discussion; cell renders with a 2px
//               red border in the grid.
//   CONFIRMED — observation was audited and confirmed OK; cell renders with
//               a subtle 1px green border.
//
// Same column as the existing NV/NI codes (seeded by 010-stroke-lipid-seed),
// just additional rows — no schema change.

const NOW = "datetime('now')"

const VALUEFLAG_CODES = [
  {
    code: 'AUDIT',
    name: 'Audit – needs review',
    blob: {
      description: 'Observation flagged for discussion / review. Cell renders with red border in the grid.',
      color: 'red',
    },
  },
  {
    code: 'CONFIRMED',
    name: 'Audit – confirmed',
    blob: {
      description: 'Observation has been audited and confirmed correct.',
      color: 'green',
    },
  },
]

export const auditValueflags = {
  name: '011-audit-valueflags',
  description: 'Seed AUDIT and CONFIRMED VALUEFLAG_CD codes for the grid audit workflow',
  execute: async (connection) => {
    for (const vf of VALUEFLAG_CODES) {
      await connection.executeCommand(
        `INSERT OR IGNORE INTO CODE_LOOKUP
          (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB,
           SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE)
         VALUES ('OBSERVATION_FACT', 'VALUEFLAG_CD', ?, ?, ?, 'AUDIT_MIGRATION', ${NOW}, ${NOW})`,
        [vf.code, vf.name, JSON.stringify(vf.blob)],
      )
    }
  },
}
