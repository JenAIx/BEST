# Codebase Refactoring Analysis

## Issues Identified

### 1. Redundant Dialog Components

#### Duplicate Create/Edit Dialogs:
- **ConceptCreateDialog.vue** + **ConceptEditDialog.vue** → Can be merged into **ConceptDialog.vue**
- **UserCreateDialog.vue** + **UserEditDialog.vue** → Can be merged into **UserDialog.vue**  
- **CqlCreateDialog.vue** + **CqlEditDialog.vue** → Can be merged into **CqlDialog.vue**
- **CreateObservationDialog.vue** + **AddObservationDialog.vue** → Similar functionality, can be unified
- **CreatePatientDialog.vue** + **EditVisitDialog.vue** → Share similar patterns

#### Common Dialog Pattern Issues:
- Repeated form validation logic
- Duplicate state management
- Similar submit/cancel handlers
- Redundant field definitions

### 2. Store Architecture Inconsistencies

#### Pattern Inconsistencies:
- **database-store.js**: Uses Composition API with `defineStore(() => {})`
- **auth-store.js**: Uses Options API with `defineStore('auth', { state, getters, actions })`
- Mixed patterns make maintenance harder

#### Data Flow Issues:
- Some stores directly execute SQL queries instead of using database-store
- visit-observation-store.js: Direct `dbStore.executeQuery()` calls
- questionnaire-store.js: Direct database access
- Should centralize all DB operations through database-store

#### Responsibility Issues:
- Stores handling UI notifications (using Quasar $q.notify)
- Business logic mixed with UI concerns
- Missing clear separation of concerns

### 3. Code Redundancies

#### Repeated Patterns:
- Concept search functionality duplicated in multiple components
- Form validation rules repeated across dialogs
- Similar loading/error state management
- Duplicate field mapping logic

## Refactoring Plan

### Phase 1: Create Shared Components

1. **BaseEntityDialog.vue** - Generic CRUD dialog component
   - Props: mode (create/edit), entity, fields configuration
   - Emits: save, cancel
   - Handles: validation, loading states, form management

2. **ConceptSearch.vue** - Reusable concept search component
   - Used by multiple dialogs and pages
   - Centralized search logic

### Phase 2: Consolidate Dialogs

1. **ConceptDialog.vue** - Unified concept CRUD
   - Replaces: ConceptCreateDialog + ConceptEditDialog
   - Mode: create/edit based on prop

2. **UserDialog.vue** - Unified user CRUD
   - Replaces: UserCreateDialog + UserEditDialog
   - Mode: create/edit based on prop

3. **CqlDialog.vue** - Unified CQL CRUD
   - Replaces: CqlCreateDialog + CqlEditDialog
   - Mode: create/edit based on prop

4. **ObservationDialog.vue** - Unified observation management
   - Replaces: CreateObservationDialog + AddObservationDialog
   - Context-aware (grid vs patient view)

### Phase 3: Refactor Stores

1. **Standardize on Composition API**
   - Convert auth-store to composition pattern
   - Ensure consistent patterns across all stores

2. **Centralize Database Access**
   - All DB operations through database-store
   - Stores request data via database-store methods
   - Clear data flow: DB → database-store → domain stores → components

3. **Separate Concerns**
   - Move UI notifications to components/composables
   - Keep stores focused on state management
   - Extract business logic to service layer

### Phase 4: Create Composables

1. **useEntityForm** - Shared form logic
   - Validation
   - Loading states
   - Submit/cancel handlers

2. **useConceptSearch** - Concept search logic
   - Search functionality
   - Recent concepts
   - Results management

3. **useNotifications** - UI notifications
   - Success/error messages
   - Loading indicators
   - Centralized notification handling

## Data Flow Architecture

```
┌─────────────┐
│   Database  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ database-store  │ (Single point of DB access)
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│     Domain Stores            │
│ - visit-observation-store    │
│ - concept-resolution-store   │
│ - questionnaire-store        │
│ - medications-store          │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────┐
│    Components    │
└──────────────────┘
```

## Implementation Priority

1. **High Priority** (Breaking changes, high impact):
   - Consolidate dialog components
   - Create BaseEntityDialog
   - Standardize store patterns

2. **Medium Priority** (Improves maintainability):
   - Extract composables
   - Centralize DB access patterns
   - Separate UI concerns from stores

3. **Low Priority** (Nice to have):
   - Additional code optimizations
   - Performance improvements
   - Documentation updates

## Benefits

1. **Reduced Code**: ~40% less code by eliminating duplicates
2. **Maintainability**: Single source of truth for each entity
3. **Consistency**: Uniform patterns across the application
4. **Testability**: Cleaner separation of concerns
5. **Performance**: Better caching and data flow
6. **Developer Experience**: Easier to understand and modify
