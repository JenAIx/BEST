# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Released]

### [Unreleased]

#### Added

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

#### Fixed

- [2025-01-XX] Fixed auto-selection issue in concept import - concepts are no longer auto-selected, requiring manual selection by user
- [2025-01-XX] Fixed import logic to only import explicitly selected concepts
