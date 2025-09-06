/**
 * Data Validation Layer
 *
 * Comprehensive validation system for clinical data including:
 * - Standard data type validation (text, numeric, date, blob)
 * - Range and limit validation
 * - Concept-specific validation rules
 * - Structured error reporting with multiple validation issues
 *
 * Based on the previous CQL implementation but modernized for the new architecture
 */

// Repository imports removed - repositories are passed as constructor parameters

export class DataValidator {
  constructor(conceptRepository, cqlRepository) {
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository

    // Standard data type definitions
    this.dataTypes = {
      numeric: 'N',
      text: 'T',
      date: 'D',
      blob: 'B',
      boolean: 'BOOL',
    }

    // Standard validation rules
    this.standardRules = {
      numeric: {
        min: -Infinity,
        max: Infinity,
        precision: 2,
        allowNegative: true,
        allowZero: true,
      },
      text: {
        minLength: 0,
        maxLength: 1000,
        allowEmpty: false,
        pattern: null, // regex pattern if needed
        trim: true,
      },
      date: {
        minDate: '1900-01-01',
        maxDate: '2100-12-31',
        format: 'YYYY-MM-DD',
        allowFuture: true,
        allowPast: true,
      },
      blob: {
        maxSize: 1024 * 1024, // 1MB
        allowedTypes: ['json', 'xml', 'text', 'binary'],
        validateContent: false,
      },
    }
  }

  /**
   * Validate a single data entry with comprehensive rule checking
   * @param {Object} data - Data to validate
   * @param {string} data.value - The value to validate
   * @param {string} data.type - Data type (numeric, text, date, blob)
   * @param {string} data.conceptCode - Medical concept code for concept-specific rules
   * @param {Object} data.metadata - Additional validation metadata
   * @returns {Object} Validation result with detailed error information
   */
  async validateData(data) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        validatedAt: new Date().toISOString(),
        dataType: data.type,
        conceptCode: data.conceptCode,
        value: data.value,
      },
    }

    try {
      // 1. Basic data type validation
      const typeValidation = this.validateDataType(data)
      if (!typeValidation.isValid) {
        validationResult.errors.push(...typeValidation.errors)
        validationResult.isValid = false
      }

      // 2. Standard range/limit validation
      const rangeValidation = this.validateStandardRules(data)
      if (!rangeValidation.isValid) {
        validationResult.errors.push(...rangeValidation.errors)
        validationResult.isValid = false
      }

      // 3. Concept-specific validation (if concept code provided)
      if (data.conceptCode) {
        const conceptValidation = await this.validateConceptRules(data)
        if (!conceptValidation.isValid) {
          validationResult.errors.push(...conceptValidation.errors)
          validationResult.isValid = false
        }
        if (conceptValidation.warnings.length > 0) {
          validationResult.warnings.push(...conceptValidation.warnings)
        }
      }

      // 4. Business logic validation
      const businessValidation = this.validateBusinessRules(data)
      if (!businessValidation.isValid) {
        validationResult.errors.push(...businessValidation.errors)
        validationResult.isValid = false
      }
    } catch (error) {
      validationResult.errors.push({
        code: 'VALIDATION_ERROR',
        field: 'system',
        message: 'Validation system error',
        details: error.message,
        severity: 'critical',
      })
      validationResult.isValid = false
    }

    return validationResult
  }

  /**
   * Validate data type and basic format
   * @param {Object} data - Data to validate
   * @returns {Object} Type validation result
   */
  validateDataType(data) {
    const result = { isValid: true, errors: [] }
    const { value, type } = data

    if (!type || !this.dataTypes[type]) {
      result.errors.push({
        code: 'INVALID_DATA_TYPE',
        field: 'type',
        message: `Invalid data type: ${type}`,
        details: `Supported types: ${Object.keys(this.dataTypes).join(', ')}`,
        severity: 'error',
      })
      result.isValid = false
      return result
    }

    switch (type) {
      case 'numeric':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          result.errors.push({
            code: 'INVALID_NUMERIC_VALUE',
            field: 'value',
            message: 'Value must be a valid number',
            details: `Received: ${typeof value} "${value}"`,
            severity: 'error',
          })
          result.isValid = false
        }
        break

      case 'text':
        if (typeof value !== 'string') {
          result.errors.push({
            code: 'INVALID_TEXT_VALUE',
            field: 'value',
            message: 'Value must be a string',
            details: `Received: ${typeof value}`,
            severity: 'error',
          })
          result.isValid = false
        }
        break

      case 'date':
        if (!this.isValidDate(value)) {
          result.errors.push({
            code: 'INVALID_DATE_VALUE',
            field: 'value',
            message: 'Value must be a valid date',
            details: `Received: "${value}". Expected format: YYYY-MM-DD`,
            severity: 'error',
          })
          result.isValid = false
        }
        break

      case 'blob':
        if (value === null || value === undefined) {
          result.errors.push({
            code: 'INVALID_BLOB_VALUE',
            field: 'value',
            message: 'BLOB value cannot be null or undefined',
            details: 'BLOB must contain actual data',
            severity: 'error',
          })
          result.isValid = false
        }
        break
    }

    return result
  }

  /**
   * Validate standard range and limit rules
   * @param {Object} data - Data to validate
   * @returns {Object} Range validation result
   */
  validateStandardRules(data) {
    const result = { isValid: true, errors: [] }
    const { value, type } = data
    const rules = this.standardRules[type]

    if (!rules) return result

    switch (type) {
      case 'numeric': {
        const numValue = Number(value)

        if (numValue < rules.min) {
          result.errors.push({
            code: 'VALUE_BELOW_MINIMUM',
            field: 'value',
            message: `Value ${numValue} is below minimum ${rules.min}`,
            details: `Numeric values must be >= ${rules.min}`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (numValue > rules.max) {
          result.errors.push({
            code: 'VALUE_ABOVE_MAXIMUM',
            field: 'value',
            message: `Value ${numValue} is above maximum ${rules.max}`,
            details: `Numeric values must be <= ${rules.max}`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (!rules.allowNegative && numValue < 0) {
          result.errors.push({
            code: 'NEGATIVE_VALUE_NOT_ALLOWED',
            field: 'value',
            message: 'Negative values are not allowed',
            details: `Received: ${numValue}`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (!rules.allowZero && numValue === 0) {
          result.errors.push({
            code: 'ZERO_VALUE_NOT_ALLOWED',
            field: 'value',
            message: 'Zero values are not allowed',
            details: `Received: ${numValue}`,
            severity: 'error',
          })
          result.isValid = false
        }

        // Check precision
        const decimalPlaces = (numValue.toString().split('.')[1] || '').length
        if (decimalPlaces > rules.precision) {
          result.errors.push({
            code: 'PRECISION_EXCEEDED',
            field: 'value',
            message: `Precision exceeded: ${decimalPlaces} decimal places`,
            details: `Maximum allowed: ${rules.precision} decimal places`,
            severity: 'error',
          })
          result.isValid = false
        }
        break
      }

      case 'text': {
        const textValue = rules.trim ? value.trim() : value

        if (textValue.length < rules.minLength) {
          result.errors.push({
            code: 'TEXT_TOO_SHORT',
            field: 'value',
            message: `Text length ${textValue.length} is below minimum ${rules.minLength}`,
            details: `Text must be at least ${rules.minLength} characters`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (textValue.length > rules.maxLength) {
          result.errors.push({
            code: 'TEXT_TOO_LONG',
            field: 'value',
            message: `Text length ${textValue.length} exceeds maximum ${rules.maxLength}`,
            details: `Text must be no more than ${rules.maxLength} characters`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (!rules.allowEmpty && textValue.length === 0) {
          result.errors.push({
            code: 'EMPTY_TEXT_NOT_ALLOWED',
            field: 'value',
            message: 'Empty text is not allowed',
            details: 'Text must contain at least one character',
            severity: 'error',
          })
          result.isValid = false
        }

        // Pattern validation if specified
        if (rules.pattern && !rules.pattern.test(textValue)) {
          result.errors.push({
            code: 'PATTERN_MISMATCH',
            field: 'value',
            message: 'Text does not match required pattern',
            details: `Pattern: ${rules.pattern.toString()}`,
            severity: 'error',
          })
          result.isValid = false
        }
        break
      }

      case 'date': {
        const dateValue = new Date(value)
        const minDate = new Date(rules.minDate)
        const maxDate = new Date(rules.maxDate)
        const now = new Date()

        if (dateValue < minDate) {
          result.errors.push({
            code: 'DATE_TOO_EARLY',
            field: 'value',
            message: `Date ${value} is before minimum ${rules.minDate}`,
            details: `Dates must be >= ${rules.minDate}`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (dateValue > maxDate) {
          result.errors.push({
            code: 'DATE_TOO_LATE',
            field: 'value',
            message: `Date ${value} is after maximum ${rules.maxDate}`,
            details: `Dates must be <= ${rules.maxDate}`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (!rules.allowFuture && dateValue > now) {
          result.errors.push({
            code: 'FUTURE_DATE_NOT_ALLOWED',
            field: 'value',
            message: 'Future dates are not allowed',
            details: `Received: ${value}`,
            severity: 'error',
          })
          result.isValid = false
        }

        if (!rules.allowPast && dateValue < now) {
          result.errors.push({
            code: 'PAST_DATE_NOT_ALLOWED',
            field: 'value',
            message: 'Past dates are not allowed',
            details: `Received: ${value}`,
            severity: 'error',
          })
          result.isValid = false
        }
        break
      }

      case 'blob': {
        if (typeof value === 'string') {
          const blobSize = new Blob([value]).size
          if (blobSize > rules.maxSize) {
            result.errors.push({
              code: 'BLOB_TOO_LARGE',
              field: 'value',
              message: `BLOB size ${blobSize} bytes exceeds maximum ${rules.maxSize}`,
              details: `Maximum allowed size: ${rules.maxSize} bytes`,
              severity: 'error',
            })
            result.isValid = false
          }
        }
        break
      }
    }

    return result
  }

  /**
   * Validate concept-specific rules from CQL_FACT
   * @param {Object} data - Data to validate
   * @returns {Object} Concept validation result
   */
  async validateConceptRules(data) {
    const result = { isValid: true, errors: [], warnings: [] }
    const { value, conceptCode } = data

    try {
      // Find concept-specific CQL rules
      const conceptRules = await this.cqlRepository.findByConceptCode(conceptCode)

      if (!conceptRules || conceptRules.length === 0) {
        result.warnings.push({
          code: 'NO_CONCEPT_RULES',
          field: 'conceptCode',
          message: `No validation rules found for concept: ${conceptCode}`,
          details: 'Using standard validation rules only',
          severity: 'warning',
        })
        return result
      }

      // Validate against each rule
      for (const rule of conceptRules) {
        try {
          const ruleValidation = await this.executeCqlRule(rule, value)
          if (!ruleValidation.isValid) {
            result.errors.push({
              code: 'CONCEPT_RULE_VIOLATION',
              field: 'value',
              message: `Failed concept rule: ${rule.NAME_CHAR || rule.CQL_ID}`,
              details: ruleValidation.error || 'Rule validation failed',
              severity: 'error',
              ruleId: rule.CQL_ID,
              ruleName: rule.NAME_CHAR,
            })
            result.isValid = false
          }
        } catch (error) {
          result.errors.push({
            code: 'RULE_EXECUTION_ERROR',
            field: 'value',
            message: `Error executing rule: ${rule.NAME_CHAR || rule.CQL_ID}`,
            details: error.message,
            severity: 'error',
            ruleId: rule.CQL_ID,
            ruleName: rule.NAME_CHAR,
          })
          result.isValid = false
        }
      }
    } catch (error) {
      result.errors.push({
        code: 'CONCEPT_VALIDATION_ERROR',
        field: 'conceptCode',
        message: 'Error during concept validation',
        details: error.message,
        severity: 'error',
      })
      result.isValid = false
    }

    return result
  }

  /**
   * Validate business logic rules
   * @param {Object} data - Data to validate
   * @returns {Object} Business validation result
   */
  validateBusinessRules(data) {
    const result = { isValid: true, errors: [] }
    const { value, type, metadata = {} } = data

    // Age validation (if applicable)
    if (metadata.field === 'AGE_IN_YEARS' && type === 'numeric') {
      const age = Number(value)
      if (age < 0 || age > 150) {
        result.errors.push({
          code: 'INVALID_AGE_RANGE',
          field: 'value',
          message: 'Age must be between 0 and 150 years',
          details: `Received: ${age} years`,
          severity: 'error',
        })
        result.isValid = false
      }
    }

    // Blood pressure validation (if applicable)
    if (metadata.field === 'BLOOD_PRESSURE' && type === 'numeric') {
      const bp = Number(value)
      if (bp < 50 || bp > 300) {
        result.errors.push({
          code: 'INVALID_BLOOD_PRESSURE',
          field: 'value',
          message: 'Blood pressure must be between 50 and 300 mmHg',
          details: `Received: ${bp} mmHg`,
          severity: 'error',
        })
        result.isValid = false
      }
    }

    // Heart rate validation (if applicable)
    if (metadata.field === 'HEART_RATE' && type === 'numeric') {
      const hr = Number(value)
      if (hr < 30 || hr > 250) {
        result.errors.push({
          code: 'INVALID_HEART_RATE',
          field: 'value',
          message: 'Heart rate must be between 30 and 250 bpm',
          details: `Received: ${hr} bpm`,
          severity: 'error',
        })
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Execute CQL rule validation
   * @param {Object} rule - CQL rule object
   * @param {*} value - Value to validate
   * @returns {Object} Rule execution result
   */
  async executeCqlRule(rule, value) {
    try {
      // For now, implement basic rule execution
      // In a full implementation, this would use the cql-execution library

      if (rule.JSON_CHAR) {
        const ruleData = JSON.parse(rule.JSON_CHAR)
        return this.executeBasicRule(ruleData, value)
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: `Rule execution failed: ${error.message}`,
      }
    }
  }

  /**
   * Execute basic rule validation (placeholder for CQL execution)
   * @param {Object} ruleData - Parsed rule data
   * @param {*} value - Value to validate
   * @returns {Object} Basic rule result
   */
  executeBasicRule(ruleData, value) {
    // This is a simplified rule execution
    // In production, this would use the full CQL execution engine

    if (ruleData.type === 'range') {
      const numValue = Number(value)
      if (numValue < ruleData.min || numValue > ruleData.max) {
        return {
          isValid: false,
          error: `Value ${numValue} outside range [${ruleData.min}, ${ruleData.max}]`,
        }
      }
    }

    if (ruleData.type === 'enum') {
      if (!ruleData.values.includes(value)) {
        return {
          isValid: false,
          error: `Value "${value}" not in allowed values: [${ruleData.values.join(', ')}]`,
        }
      }
    }

    return { isValid: true }
  }

  /**
   * Check if a string is a valid date
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid date
   */
  isValidDate(dateString) {
    if (typeof dateString !== 'string') return false

    // Check format first
    if (!dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return false

    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date) && date.getFullYear() > 0
  }

  /**
   * Set custom validation rules for a data type
   * @param {string} dataType - Data type to customize
   * @param {Object} rules - Custom rules
   */
  setCustomRules(dataType, rules) {
    if (this.standardRules[dataType]) {
      this.standardRules[dataType] = { ...this.standardRules[dataType], ...rules }
    }
  }

  /**
   * Get current validation rules for a data type
   * @param {string} dataType - Data type to get rules for
   * @returns {Object} Current rules
   */
  getRules(dataType) {
    return this.standardRules[dataType] || null
  }

  /**
   * Reset validation rules to defaults
   */
  resetToDefaults() {
    this.standardRules = {
      numeric: {
        min: -Infinity,
        max: Infinity,
        precision: 2,
        allowNegative: true,
        allowZero: true,
      },
      text: {
        minLength: 0,
        maxLength: 1000,
        allowEmpty: false,
        pattern: null,
        trim: true,
      },
      date: {
        minDate: '1900-01-01',
        maxDate: '2100-12-31',
        format: 'YYYY-MM-DD',
        allowFuture: true,
        allowPast: true,
      },
      blob: {
        maxSize: 1024 * 1024,
        allowedTypes: ['json', 'xml', 'text', 'binary'],
        validateContent: false,
      },
    }
  }
}

export default DataValidator
