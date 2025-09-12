# 🐛 Language Toggle Error Analysis & Debugging

## Problem
Global errors occurring specifically on DashboardPage when toggling language, but not on other pages.

## Error Location
- **File**: DashboardPage.vue
- **Trigger**: Language toggle (DE ↔ EN)
- **Error Type**: Global error caught by logging-service.js
- **Symptom**: Only affects Dashboard, other pages work fine

## Potential Causes Identified

### 1. **Reactive Translation in Computed Functions**
- `tableColumns` originally used `t()` directly in computed()
- Vue I18n reactivity can cause timing issues during language switches
- **Solution Applied**: Separated static columns from reactive translation

### 2. **Format Functions Using t()**
- `formatDate()` and `formatRelativeTime()` use `t()` 
- Called asynchronously during data loading
- Could cause errors if `t()` is not available during language transition
- **Solution Applied**: Added try-catch with logging

### 3. **Patient Name Resolution**
- `getPatientName()` uses `t()` for unknown patient fallback
- Called during patient data mapping
- **Solution Applied**: Added error handling and logging

## Debugging Measures Implemented

### Enhanced Error Handling
```javascript
// Before
const formatDate = (dateStr) => {
  if (!dateStr) return t('common.unknown')
  return new Date(dateStr).toLocaleDateString()
}

// After
const formatDate = (dateStr) => {
  try {
    console.log('formatDate called with:', dateStr)
    if (!dateStr) {
      const result = t('common.unknown')
      console.log('formatDate returning unknown:', result)
      return result
    }
    const result = new Date(dateStr).toLocaleDateString()
    console.log('formatDate returning:', result)
    return result
  } catch (error) {
    console.error('Error in formatDate:', error, { dateStr })
    return 'Unknown'
  }
}
```

### Table Columns Debugging
```javascript
const translatedTableColumns = computed(() => {
  try {
    console.log('Computing translated table columns')
    return tableColumns.map((col) => {
      // Individual column translation with error handling
      let translatedLabel = col.label
      try {
        switch (col.name) {
          case 'id': translatedLabel = t('patient.patientId'); break
          // ... other cases
        }
      } catch (translationError) {
        console.error('Error translating column:', col.name, translationError)
        translatedLabel = col.label // fallback
      }
      return { ...col, label: translatedLabel }
    })
  } catch (error) {
    console.error('Error in translatedTableColumns computed:', error)
    return tableColumns // fallback
  }
})
```

### Language Toggle Logging
```javascript
const toggleLanguage = () => {
  try {
    console.log('Language toggle started', { currentLocale: locale.value })
    const newLocale = locale.value === 'de' ? 'en' : 'de'
    console.log('Switching to locale:', newLocale)
    locale.value = newLocale
    console.log('Locale changed successfully')
    // ... rest with logging
  } catch (error) {
    console.error('Error in toggleLanguage:', error)
    // Error notification
  }
}
```

## Expected Debug Output

When language toggle is clicked, check console for:

1. **Language Toggle Logs**:
   - "Language toggle started"
   - "Switching to locale: en/de"
   - "Locale changed successfully"

2. **Table Column Logs**:
   - "Computing translated table columns"
   - Any column translation errors

3. **Format Function Logs**:
   - "formatDate called with: ..."
   - "formatRelativeTime called with: ..."
   - Return values

4. **Patient Name Logs**:
   - "getPatientName called with: ..."
   - "getPatientName returning: ..."

## Next Steps

1. **Test language toggle on Dashboard**
2. **Check browser console** for detailed error logs
3. **Identify exact error location** from console output
4. **Apply targeted fix** based on logging results
5. **Remove debug logging** once issue is resolved

## Hypothesis

The error likely occurs because:
- **Async data loading** happens during language switch
- **Format functions** are called with stale data
- **Vue I18n context** might be temporarily unavailable
- **Computed reactivity** triggers at wrong timing

The enhanced logging will reveal the exact sequence and timing of the error.
