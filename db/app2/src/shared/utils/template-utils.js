/**
 * Visit Template Utilities
 * 
 * Shared utilities for handling visit templates across different components
 */

/**
 * Map visit templates to appropriate field sets for data entry
 * @param {Object} template - Template object with id and type
 * @returns {Array} Array of field set IDs
 */
export const getTemplateFieldSets = (template) => {
  if (!template) return ['vitals', 'symptoms']
  
  // Map template IDs to specific field sets (highest priority)
  const templateFieldSetMap = {
    'annual-checkup': ['vitals', 'symptoms', 'physical', 'lab', 'assessment'],
    'follow-up-labs': ['vitals', 'lab', 'assessment'],
    'medication-review': ['vitals', 'symptoms', 'medications', 'assessment'],
    'emergency-visit': ['vitals', 'symptoms', 'physical', 'assessment'],
    'procedure-visit': ['vitals', 'physical', 'assessment'],
  }
  
  // Use template-specific mapping if available
  if (templateFieldSetMap[template.id]) {
    return templateFieldSetMap[template.id]
  }
  
  // Fallback to type-based mapping
  switch (template.type) {
    case 'routine':
      return ['vitals', 'symptoms', 'physical', 'assessment']
    case 'followup':
      return ['vitals', 'symptoms', 'assessment']  
    case 'emergency':
      return ['vitals', 'symptoms', 'physical', 'assessment']
    case 'consultation':
      return ['vitals', 'symptoms', 'medications', 'assessment']
    case 'procedure':
      return ['vitals', 'physical', 'assessment']
    default:
      return ['vitals', 'symptoms']
  }
}

/**
 * Get template description for tooltips and UI display
 * @param {Object} template - Template object
 * @returns {string} Description text
 */
export const getTemplateDescription = (template) => {
  if (!template) return 'Standard visit template'
  
  const descriptions = {
    'annual-checkup': 'Comprehensive yearly physical examination with full assessment',
    'follow-up-labs': 'Review laboratory results and follow-up on previous findings', 
    'medication-review': 'Review current medications, adjust dosages, and assess compliance',
    'emergency-visit': 'Urgent care assessment with focus on immediate medical needs',
    'procedure-visit': 'Medical procedure or intervention with pre/post assessment',
  }
  
  return descriptions[template.id] || template.notes || 'Visit template for streamlined workflow'
}

/**
 * Get template field set summary for display
 * @param {Object} template - Template object
 * @returns {string} Field sets summary
 */
export const getTemplateFieldSetSummary = (template) => {
  const fieldSets = getTemplateFieldSets(template)
  return fieldSets.join(', ')
}

/**
 * Validate template object structure
 * @param {Object} template - Template to validate
 * @returns {boolean} True if valid template
 */
export const isValidTemplate = (template) => {
  return template && 
         typeof template === 'object' && 
         template.id && 
         template.name && 
         template.type
}

/**
 * Get default template for a given visit type
 * @param {string} visitType - Visit type (routine, emergency, etc.)
 * @returns {Object|null} Default template or null
 */
export const getDefaultTemplateForVisitType = (visitType) => {
  const typeTemplateMap = {
    'routine': 'annual-checkup',
    'followup': 'follow-up-labs',
    'emergency': 'emergency-visit',
    'consultation': 'medication-review',
    'procedure': 'procedure-visit',
  }
  
  return typeTemplateMap[visitType] || null
}

/**
 * Enhanced template with computed properties
 * @param {Object} template - Base template object
 * @returns {Object} Enhanced template with additional properties
 */
export const enhanceTemplate = (template) => {
  if (!isValidTemplate(template)) return null
  
  return {
    ...template,
    fieldSets: getTemplateFieldSets(template),
    fieldSetSummary: getTemplateFieldSetSummary(template),
    description: getTemplateDescription(template),
    isValid: true,
  }
}
