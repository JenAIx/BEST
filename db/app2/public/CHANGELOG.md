# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Released]

### [Unreleased]

#### Added

- [2025-12-30] **User-Patient Access Control System**
  - Implemented comprehensive row-level security for patient data
  - Automatic assignment: New patients automatically assigned to creator via `USER_PATIENT_LOOKUP` table
  - Repository-level filtering: Regular users see only their assigned patients
  - Admin bypass: Admins have full access to all patients regardless of assignments
  - Public access: Special `public` user (USER_ID=0) grants access to all users
  - Created new `PatientAccessManagement.vue` component with patient-centric UI
  - Patient table shows assigned users as chips with tooltips (name, username, role)
  - Inline user management with add/remove functionality
  - Remove confirmation using `AppRemoveConfirmationButton` with styled buttons for chip context
  - Duplicate prevention for both create and update operations
  - Graceful error handling with automatic switch to edit mode for existing associations
  - Comprehensive filtering across all patient query paths (pagination, search, direct lookup)
  - Dashboard, Data Grid, and all patient lists respect user access rights
  - Admin UI at `/users` → "Patient Access" tab for managing user-patient associations
  - Dashboard statistics for non-admin users: Shows "Visible Patients" and "Hidden Patients" counts under "Today's Statistics"
  - Added I18n translations for access control UI elements (German and English)

- [2025-12-19] Added medication handling to Data Grid Editor
  - Icon-based medication display showing medication icon with count (e.g., "💊 2") in 120px columns
  - Created `MedicationOverviewDialog` for managing all medications in a visit with inline editing
  - Integrated `AppRemoveConfirmationButton` for consistent delete confirmation UX
  - Implemented drug autocomplete search with suggestions from CODE_LOOKUP table
  - Auto-fill medication details (dosage, unit, frequency, route) from drug metadata
  - Support for multiple medication observations per visit (INSTANCE_NUM)
  - On-demand BLOB loading for optimal performance (prevents loading images/large files in grid)
  - Medication count cache with async loading for fast grid rendering
  - Full CRUD operations: Create, Edit (inline), Delete (with confirmation), View all
  - All medication data stored in OBSERVATION_BLOB as JSON (drugName, dosage, dosageUnit, frequency, route, instructions)
  - TVAL_CHAR contains only drug name for display, NVAL_NUM contains dosage
  - Added I18n translations for medication UI elements (German and English)

- [2025-01-XX] Added zoom functionality to Data Grid Editor
  - Added Zoom In, Zoom Out, and Reset Zoom buttons in editor header
  - Zoom range from 0.5x to 2.0x with 0.1x step increments
  - Smooth CSS transform scaling with automatic table width adjustment
  - Buttons grouped with subtle color styling (light blue background) positioned on right side of header
  - Zoom controls disabled at min/max limits and when at default zoom level
  - Added I18n translations for zoom controls (German and English)

- [2025-01-XX] Comprehensive localization for Data Grid Editor
  - Localized Refresh and View Options buttons in editor header
  - Fully localized Column Management dialog (title, subtitle, all buttons, tooltips, empty states, footer)
  - Localized GridLayout header (editor title, patient/observation counts, navigation hints, back button tooltip)
  - Localized GridFooter status section (saved/unsaved changes, update time)
  - Localized GridFooter statistics labels (cols, visible, hidden, filled, cells)
  - All translations added for German and English
  - Removed CSS text-transform lowercase rule to properly display capitalized labels

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

- [2025-12-30] **Code Cleanup and Optimization**
  - Removed all debug console.log statements from production code
  - Cleaned up `AppRemoveConfirmationButton.vue`, `DeletePatientDialog.vue`, and page components
  - Removed redundant `createNameObservation()` function from `CreatePatientDialog.vue` (~30 lines)
  - Eliminated circular dependency risk in `App.vue` by removing redundant directory import
  - Refactored `ConceptsImportDialog.selectAll()` for simpler, more robust implementation
  - Maintained essential functionality (isDeleting flag, event propagation prevention)
  - Improved code readability and performance by eliminating unnecessary logging and redundant code

- [2025-12-30] **Improved Patient Data Architecture**
  - Patient names now stored exclusively in `PATIENT_BLOB` instead of as separate observations
  - Eliminated architectural inconsistency where observations were created without visit context
  - Observations now strictly require `ENCOUNTER_NUM` (visit context) as per database schema
  - Simplified patient creation workflow by removing redundant name observation logic

- [2025-12-30] **Refactored User-Patient Association Management**
  - Replaced association-centric view with patient-centric approach
  - Users now displayed as chips in patient table for better overview
  - Edit dialog provides focused management interface for each patient
  - Simplified workflow: Find patient → Edit → Add/Remove users
  - Improved visual design with color-coded chips (blue for regular users, green for public)
  - Enhanced tooltips showing complete user information on hover

- [2025-12-19] Optimized Data Grid column widths for better space utilization
  - Date columns (D): Reduced from 150px to 120px (-30px)
  - Numeric columns (N): Reduced from 150px to 100px (-50px)
  - Medication columns (M): Set to 120px for icon + count display
  - Text columns (T): Kept at 150px (default)
  - Dynamic CSS classes based on value type for flexible column sizing

- [2025-12-19] Enhanced MedicationFieldView component with display modes
  - Added `simpleDisplay` prop to control display complexity
  - Simple mode (Data Grid): Shows only drug name for performance
  - Full mode (VisitDataEntry): Shows elegant format "ASS 100mg 1-0-0 p.o." with BLOB data loading
  - Conditional BLOB loading based on context to prevent unnecessary database queries

- [2025-12-19] Improved DataGridPage and DataGridEditorPage code quality
  - Replaced all console.error/console.log statements with proper logger usage
  - Added `loggingStore.createLogger()` for consistent logging throughout pages
  - Localized all hardcoded notification messages for multilingual support
  - Added error handling for store initialization with user notifications
  - Removed verbose drug loading logs from global-settings-store (reduced from 56+ logs to 1)
  - Added user notification for failed visit/observation count queries
  - Cleaned up outdated comments and empty code blocks

- [2025-12-19] Refactored Data Grid Editor to reduce code duplication and complexity
  - Created `usePatientSearch` composable for reusable patient search functionality with flexible filtering options
  - Created `useDialogManager` composable for centralized dialog state management
  - Replaced custom patient search dialog in ExcelLikeEditor with existing `PatientSelectionCard` component
  - Simplified dialog state management from 8+ separate refs to 6 direct refs with centralized control functions
  - Eliminated ~110 lines of duplicate code (60 lines patient search, 50 lines dialog management)
  - Reduced dialog management complexity by 40-50%
  - Improved code maintainability and consistency across components
  - All functionality preserved and tested

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

- [2025-12-30] Fixed Dashboard showing patients without access rights - now uses `dbStore.getPatientsPaginated()` for proper filtering
- [2025-12-30] Fixed SQL syntax error in user-filtered queries - corrected ORDER BY handling for complex expressions like `COALESCE()`
- [2025-12-30] Fixed patient detail page access - added user context to `loadPatientByCode()` method
- [2025-12-30] Fixed search and filter functions - all patient queries now respect user access rights
- [2025-12-30] Fixed Data Grid page patient list - now properly filters patients based on user access
- [2025-12-30] Fixed patient search composable - integrated user context for consistent filtering
- [2025-12-30] Fixed duplicate association error handling - now gracefully switches to edit mode instead of showing error
- [2025-12-30] Fixed remove button visibility in chips - styled with contrasting colors (black on light background, white on confirmation)
- [2025-12-30] Fixed patient deletion requiring multiple clicks - standardized delete dialog across all pages using shared `DeletePatientDialog` component
- [2025-12-30] Fixed click event propagation on delete buttons - added `@click.stop` to prevent card/row click handlers from triggering
- [2025-12-30] Fixed dialog initialization timing issue - patient data now passed directly as parameters to `show()` method instead of relying on props
- [2025-12-30] Fixed Foreign Key Constraint error when deleting patients - `USER_PATIENT_LOOKUP` entries are now deleted before patient deletion
- [2025-12-30] Fixed redundant module import in `App.vue` - removed circular dependency risk by eliminating unnecessary directory import alongside direct component import
- [2025-12-30] Fixed duplicate selections in Concepts Import Dialog - `selectAll()` now replaces array instead of appending, preventing duplicate concept imports
- [2025-12-30] Fixed `SQLITE_CONSTRAINT: NOT NULL constraint failed: OBSERVATION_FACT.ENCOUNTER_NUM` error when creating patients - removed redundant `createNameObservation()` function that attempted to create observations without a visit context; patient names are now properly stored in `PATIENT_BLOB` only

#### Changed

- [2025-12-30] **Standardized Patient Deletion UI**
  - Created shared `DeletePatientDialog.vue` component for consistent deletion experience across all pages
  - Replaced custom delete dialogs in `PatientSearchPage.vue`, `DashboardPage.vue`, and `PatientPage.vue`
  - Unified two-step deletion process: initial confirmation → data check → warning (if data exists) → actual deletion
  - Improved code maintainability by centralizing deletion logic in single component
  - Enhanced user experience with consistent deletion workflow across application
  - Removed duplicate code (~200 lines) from individual page components

- [2025-12-19] Fixed Data Grid Editor "Add" menu dialogs not opening - simplified dialog state management to use direct refs instead of composable for better reactivity
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
