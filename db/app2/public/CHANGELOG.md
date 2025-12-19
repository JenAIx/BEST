# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Released]

### [Unreleased]

#### Added

- [2025-01-XX] Enhanced Visit Summary dialog with questionnaires section
  - Added dedicated "Questionnaires & Surveys" section at bottom of visit summary
  - Displays all questionnaires (valueType='Q') with full response details using `CompletedQuestionnaireView` component
  - Shows questionnaire count in visit summary header when questionnaires are present
  - Questionnaires are automatically loaded when dialog opens
  - Each questionnaire displays title, completion date, final results, and individual question responses
  - Added "View Full Questionnaire" button to open detailed questionnaire preview dialog
  - Enhanced PDF export to include complete questionnaire responses with all questions and answers
  - PDF export now includes questionnaire results summary and individual responses formatted for printing
  - Created sub-components for better code organization: `VisitSummaryPatientHeader`, `VisitSummaryHeader`, `VisitSummaryObservations`, `VisitSummaryQuestionnaires`, `VisitSummaryQuestionnaireItem`
  - Extracted PDF generation logic to reusable `useVisitSummaryPDF` composable

- [2025-01-XX] Added comprehensive study support functionality
  - Created `StudyDetailsPage.vue` - dedicated page for viewing and managing study details (replaces study details dialog)
  - Added study enrollment management with `EnrollPatientDialog.vue` component
  - Implemented patient enrollment in studies with enrollment date and status tracking
  - Added study enrollment chips to `PatientPage.vue` showing studies a patient is enrolled in
  - Added "Current Studies" list to `DashboardPage.vue` displaying recent studies with enrolled patient counts
  - Added study filter to `PatientSearchPage.vue` advanced filters section for filtering patients by enrolled studies
  - Implemented study-patient enrollment relationship with `STUDY_PATIENT_LOOKUP` table
  - Added dynamic patient count calculation for studies from enrollment data
  - Added navigation between study details and patient pages with clickable study/patient links
  - Added study enrollment tooltips and visual indicators
  - Added comprehensive I18n translations for study-related UI elements (German and English)
  - Study enrollment dialog features patient search with autocomplete suggestions (5-10 results)
  - Study details page supports editing study information and managing enrolled patients
  - Study filter in patient search correctly integrates with pagination and other filters

- [2025-01-XX] Added CSV import functionality for concepts
  - Created `ConceptsImportDialog` component for importing concepts from CSV files
  - Added import button to ConceptsPage with upload icon
  - Implemented CSV parsing with proper quote and delimiter handling
  - Added duplicate detection based on CONCEPT_CD
  - Added concept selection table with checkboxes and select all/deselect all functionality
  - Added search filter for concept names, codes, and paths in import dialog
  - Implemented import results display with success, skipped (duplicates), and error counts
  - Added logging entries for import operations in notification system
  - Added I18n translations for import functionality (German and English)
  - CSV import validates file structure, headers, and required fields before import
  - Supports the same CSV format as the export function (13 columns matching CONCEPT_DIMENSION table)

#### Changed

- [2025-01-XX] Refactored Visit Summary dialog for better maintainability
  - Split monolithic 1190-line component into smaller, focused sub-components (reduced main dialog to 366 lines)
  - Created `VisitSummaryPatientHeader.vue` for patient information display
  - Created `VisitSummaryHeader.vue` for visit overview information
  - Created `VisitSummaryObservations.vue` for observations table display
  - Created `VisitSummaryQuestionnaires.vue` and `VisitSummaryQuestionnaireItem.vue` for questionnaire display
  - Extracted PDF generation logic to `useVisitSummaryPDF.js` composable for reusability
  - Improved code organization and maintainability while preserving all functionality

- [2025-01-XX] Replaced study details dialog with dedicated `StudyDetailsPage.vue` for better user experience
  - Study details now accessible via route `/studies/:studyId`
  - Provides more space for managing study information and enrolled patients
  - Improved navigation flow between studies and patients

- [2025-01-XX] Enhanced patient_list view to calculate age from multiple sources:
  - First priority: Age observations from OBSERVATION_FACT (numeric observations with age-related concept names or units)
  - Second priority: Stored AGE_IN_YEARS from PATIENT_DIMENSION
  - Third priority: Calculated from BIRTH_DATE using SQLite's julianday() function
  - This ensures accurate age filtering even when AGE_IN_YEARS is not directly stored

#### Fixed

- [2025-12-19] Fixed observation creation from questionnaires failing with "No patient selected" error - now allows observation creation when PATIENT_NUM is explicitly provided, even without a selected patient in the store
- [2025-12-19] Fixed observations not appearing immediately on PatientPage after questionnaire submission - modified visit-observation-service to always reload observations when loading patient data, ensuring fresh data is displayed
- [2025-12-18] Fixed questionnaire submission error when auto-creating visits - now uses visit repository which properly handles `lastInsertRowid` being undefined in Electron environment
- [2025-12-18] Fixed Vue prop type warning for `completionDate` in questionnaire preview - now properly converts number timestamps to ISO string format
- [2025-12-18] Fixed questionnaire submission summary showing "0 Questions Answered" - now correctly displays `items.length` and shows detailed counts including answers added as separate observations
- [2025-12-18] Fixed VALTYPE_CD being incorrectly set to 'T' for Selection type observations from questionnaires - now correctly uses the concept's VALTYPE_CD from database (typically 'S' for Selection) to enable proper ID-to-text resolution
- [2025-01-XX] Fixed auto-selection issue in concept import - concepts are no longer auto-selected, requiring manual selection by user
- [2025-01-XX] Fixed import logic to only import explicitly selected concepts
- [2025-01-XX] Fixed age range filtering in patient search - corrected field name usage (ageRange instead of ageMin/ageMax)
- [2025-01-XX] Fixed age range filter condition to correctly detect when range differs from default values (20-80)
- [2025-01-XX] Fixed combination of study filter and age range filter - age range now properly converted to repository format
- [2025-01-XX] Fixed age calculation in patient_list view - now properly handles NULL age values when filtering
- [2025-01-XX] Fixed age filtering in count queries - age range now correctly applied in both search and count operations
