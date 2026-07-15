// Sync PROVIDER_DIMENSION with USER_MANAGEMENT.
//
// OBSERVATION_FACT.PROVIDER_ID records who created/last edited an observation.
// The application stamps the current user's USER_CD there (auth-store.providerId),
// so USER_CD doubles as PROVIDER_DIMENSION.PROVIDER_ID. This migration creates
// one provider row per user (and the legacy 'SYSTEM' / '@' writers) so that
// PROVIDER_ID values resolve to display names via PROVIDER_DIMENSION.
//
// Self-healing upsert: re-running refreshes NAME_CHAR from USER_MANAGEMENT
// (e.g. after a user was renamed). New users are synced on creation by
// UserRepository.createUser; this migration covers pre-existing users.

export const providerUserSync = {
  name: '013-provider-user-sync',
  description: 'Seed PROVIDER_DIMENSION from USER_MANAGEMENT (PROVIDER_ID = USER_CD) plus legacy SYSTEM/@ providers',
  execute: async (connection) => {
    await connection.executeCommand(
      `INSERT INTO PROVIDER_DIMENSION (PROVIDER_ID, PROVIDER_PATH, NAME_CHAR, SOURCESYSTEM_CD, UPDATE_DATE, IMPORT_DATE)
       SELECT u.USER_CD, '\\Provider\\' || u.USER_CD || '\\', COALESCE(u.NAME_CHAR, u.USER_CD), 'USER_SYNC', datetime('now'), datetime('now')
       FROM USER_MANAGEMENT u
       WHERE u.USER_CD IS NOT NULL
       ON CONFLICT(PROVIDER_ID) DO UPDATE SET
         NAME_CHAR = excluded.NAME_CHAR,
         UPDATE_DATE = excluded.UPDATE_DATE`,
    )

    // Legacy writers that predate user stamping (kept resolvable for old rows).
    await connection.executeCommand(
      `INSERT OR IGNORE INTO PROVIDER_DIMENSION (PROVIDER_ID, PROVIDER_PATH, NAME_CHAR, SOURCESYSTEM_CD, UPDATE_DATE, IMPORT_DATE)
       VALUES
         ('SYSTEM', '\\Provider\\SYSTEM\\', 'System (automatisch)', 'USER_SYNC', datetime('now'), datetime('now')),
         ('@', '\\Provider\\@\\', 'Questionnaire (legacy)', 'USER_SYNC', datetime('now'), datetime('now'))`,
    )
  },
}
