/**
 * Database Triggers Migration
 * Creates all database triggers for automatic cascade deletions and update tracking
 * Consolidates: 004-add-cascade-triggers, 007-patient-update-triggers
 */

export const databaseTriggers = {
  name: '003-triggers',
  description: 'Create all database triggers for cascade deletions and automatic updates',
  sql: `
    -- Drop existing triggers for clean recreation
    DROP TRIGGER IF EXISTS delete_patient_cascade;
    DROP TRIGGER IF EXISTS delete_visit_cascade;
    DROP TRIGGER IF EXISTS delete_concept_cql_lookup;
    DROP TRIGGER IF EXISTS delete_concept_cascade;
    DROP TRIGGER IF EXISTS delete_user_cascade;
    DROP TRIGGER IF EXISTS update_patient_on_patient_update;
    DROP TRIGGER IF EXISTS update_patient_on_visit_insert;
    DROP TRIGGER IF EXISTS update_patient_on_visit_update;
    DROP TRIGGER IF EXISTS update_patient_on_visit_delete;
    DROP TRIGGER IF EXISTS update_patient_on_observation_insert;
    DROP TRIGGER IF EXISTS update_patient_on_observation_update;
    DROP TRIGGER IF EXISTS update_patient_on_observation_delete;

    -- CASCADE DELETION TRIGGERS
    CREATE TRIGGER delete_patient_cascade 
    BEFORE DELETE ON PATIENT_DIMENSION 
    FOR EACH ROW 
    BEGIN 
      DELETE FROM VISIT_DIMENSION WHERE PATIENT_NUM = OLD.PATIENT_NUM; 
      DELETE FROM USER_PATIENT_LOOKUP WHERE PATIENT_NUM = OLD.PATIENT_NUM; 
    END;

    CREATE TRIGGER delete_visit_cascade 
    BEFORE DELETE ON VISIT_DIMENSION 
    FOR EACH ROW 
    BEGIN 
      DELETE FROM OBSERVATION_FACT WHERE ENCOUNTER_NUM = OLD.ENCOUNTER_NUM; 
      DELETE FROM NOTE_FACT WHERE ENCOUNTER_NUM = OLD.ENCOUNTER_NUM; 
    END;

    CREATE TRIGGER delete_concept_cql_lookup 
    BEFORE DELETE ON CONCEPT_DIMENSION 
    FOR EACH ROW 
    BEGIN 
      DELETE FROM CONCEPT_CQL_LOOKUP WHERE CONCEPT_CD = OLD.CONCEPT_CD; 
    END;

    CREATE TRIGGER delete_concept_cascade 
    BEFORE DELETE ON CONCEPT_DIMENSION 
    FOR EACH ROW 
    BEGIN 
      DELETE FROM OBSERVATION_FACT WHERE CONCEPT_CD = OLD.CONCEPT_CD; 
    END;

    CREATE TRIGGER delete_user_cascade 
    BEFORE DELETE ON USER_MANAGEMENT 
    FOR EACH ROW 
    BEGIN 
      DELETE FROM USER_PATIENT_LOOKUP WHERE USER_ID = OLD.USER_ID; 
    END;

    -- PATIENT UPDATE TRACKING TRIGGERS
    CREATE TRIGGER update_patient_on_patient_update
    AFTER UPDATE ON PATIENT_DIMENSION
    FOR EACH ROW
    WHEN OLD.UPDATE_DATE IS NEW.UPDATE_DATE
    BEGIN
      UPDATE PATIENT_DIMENSION SET UPDATE_DATE = datetime('now') WHERE PATIENT_NUM = NEW.PATIENT_NUM;
    END;

    CREATE TRIGGER update_patient_on_visit_insert 
    AFTER INSERT ON VISIT_DIMENSION 
    FOR EACH ROW 
    BEGIN 
      UPDATE PATIENT_DIMENSION SET UPDATE_DATE = datetime('now') WHERE PATIENT_NUM = NEW.PATIENT_NUM; 
    END;

    CREATE TRIGGER update_patient_on_visit_update 
    AFTER UPDATE ON VISIT_DIMENSION 
    FOR EACH ROW 
    BEGIN 
      UPDATE PATIENT_DIMENSION SET UPDATE_DATE = datetime('now') WHERE PATIENT_NUM = NEW.PATIENT_NUM; 
    END;

    CREATE TRIGGER update_patient_on_visit_delete 
    AFTER DELETE ON VISIT_DIMENSION 
    FOR EACH ROW 
    BEGIN 
      UPDATE PATIENT_DIMENSION SET UPDATE_DATE = datetime('now') WHERE PATIENT_NUM = OLD.PATIENT_NUM; 
    END;

    CREATE TRIGGER update_patient_on_observation_insert 
    AFTER INSERT ON OBSERVATION_FACT 
    FOR EACH ROW 
    BEGIN 
      UPDATE PATIENT_DIMENSION SET UPDATE_DATE = datetime('now') WHERE PATIENT_NUM = NEW.PATIENT_NUM; 
    END;

    CREATE TRIGGER update_patient_on_observation_update 
    AFTER UPDATE ON OBSERVATION_FACT 
    FOR EACH ROW 
    BEGIN 
      UPDATE PATIENT_DIMENSION SET UPDATE_DATE = datetime('now') WHERE PATIENT_NUM = NEW.PATIENT_NUM; 
    END;

    CREATE TRIGGER update_patient_on_observation_delete 
    AFTER DELETE ON OBSERVATION_FACT 
    FOR EACH ROW 
    BEGIN 
      UPDATE PATIENT_DIMENSION SET UPDATE_DATE = datetime('now') WHERE PATIENT_NUM = OLD.PATIENT_NUM; 
    END;
  `,
}
