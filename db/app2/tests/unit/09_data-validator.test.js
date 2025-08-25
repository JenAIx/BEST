/**
 * Unit Tests for DataValidator
 * 
 * Tests comprehensive data validation functionality including:
 * - Standard data type validation (text, numeric, date, blob)
 * - Range and limit validation
 * - Concept-specific validation rules
 * - Structured error reporting with multiple validation issues
 * - Business logic validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import DataValidator from '../../src/core/validators/data-validator.js'

describe('DataValidator', () => {
  let mockConceptRepository
  let mockCqlRepository
  let dataValidator

  beforeEach(() => {
    // Mock repositories
    mockConceptRepository = {
      findByConceptCode: vi.fn()
    }
    
    mockCqlRepository = {
      findByConceptCode: vi.fn()
    }
    
    dataValidator = new DataValidator(mockConceptRepository, mockCqlRepository)
  })

  describe('Constructor', () => {
    it('should initialize with default validation rules', () => {
      expect(dataValidator.dataTypes).toEqual({
        numeric: 'N',
        text: 'T',
        date: 'D',
        blob: 'B',
        boolean: 'BOOL'
      })
      
      expect(dataValidator.standardRules.numeric).toBeDefined()
      expect(dataValidator.standardRules.text).toBeDefined()
      expect(dataValidator.standardRules.date).toBeDefined()
      expect(dataValidator.standardRules.blob).toBeDefined()
    })

    it('should accept repository dependencies', () => {
      expect(dataValidator.conceptRepository).toBe(mockConceptRepository)
      expect(dataValidator.cqlRepository).toBe(mockCqlRepository)
    })
  })

  describe('validateData - Basic Type Validation', () => {
    it('should validate numeric data successfully', async () => {
      const result = await dataValidator.validateData({
        value: 42,
        type: 'numeric'
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.metadata.dataType).toBe('numeric')
      expect(result.metadata.value).toBe(42)
    })

    it('should validate text data successfully', async () => {
      const result = await dataValidator.validateData({
        value: 'Hello World',
        type: 'text'
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.metadata.dataType).toBe('text')
    })

    it('should validate date data successfully', async () => {
      const result = await dataValidator.validateData({
        value: '2024-01-15',
        type: 'date'
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.metadata.dataType).toBe('date')
    })

    it('should validate blob data successfully', async () => {
      const result = await dataValidator.validateData({
        value: '{"key": "value"}',
        type: 'blob'
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.metadata.dataType).toBe('blob')
    })

    it('should reject invalid data type', async () => {
      const result = await dataValidator.validateData({
        value: 'test',
        type: 'invalid_type'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_DATA_TYPE')
      expect(result.errors[0].message).toContain('Invalid data type: invalid_type')
    })

    it('should reject numeric value with string type', async () => {
      const result = await dataValidator.validateData({
        value: 123,
        type: 'text'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.code === 'INVALID_TEXT_VALUE')).toBe(true)
    })

    it('should reject invalid date format', async () => {
      const result = await dataValidator.validateData({
        value: '15-01-2024',
        type: 'date'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_DATE_VALUE')
    })
  })

  describe('validateData - Standard Rules Validation', () => {
    it('should reject numeric value below minimum', async () => {
      dataValidator.setCustomRules('numeric', { min: 10 })
      
      const result = await dataValidator.validateData({
        value: 5,
        type: 'numeric'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('VALUE_BELOW_MINIMUM')
      expect(result.errors[0].message).toContain('Value 5 is below minimum 10')
    })

    it('should reject numeric value above maximum', async () => {
      dataValidator.setCustomRules('numeric', { max: 100 })
      
      const result = await dataValidator.validateData({
        value: 150,
        type: 'numeric'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('VALUE_ABOVE_MAXIMUM')
      expect(result.errors[0].message).toContain('Value 150 is above maximum 100')
    })

    it('should reject negative values when not allowed', async () => {
      dataValidator.setCustomRules('numeric', { allowNegative: false })
      
      const result = await dataValidator.validateData({
        value: -5,
        type: 'numeric'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('NEGATIVE_VALUE_NOT_ALLOWED')
    })

    it('should reject zero values when not allowed', async () => {
      dataValidator.setCustomRules('numeric', { allowZero: false })
      
      const result = await dataValidator.validateData({
        value: 0,
        type: 'numeric'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('ZERO_VALUE_NOT_ALLOWED')
    })

    it('should reject text that is too short', async () => {
      dataValidator.setCustomRules('text', { minLength: 5 })
      
      const result = await dataValidator.validateData({
        value: 'Hi',
        type: 'text'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('TEXT_TOO_SHORT')
      expect(result.errors[0].message).toContain('Text length 2 is below minimum 5')
    })

    it('should reject text that is too long', async () => {
      dataValidator.setCustomRules('text', { maxLength: 10 })
      
      const result = await dataValidator.validateData({
        value: 'This is a very long text that exceeds the limit',
        type: 'text'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('TEXT_TOO_LONG')
    })

    it('should reject empty text when not allowed', async () => {
      dataValidator.setCustomRules('text', { allowEmpty: false })
      
      const result = await dataValidator.validateData({
        value: '',
        type: 'text'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('EMPTY_TEXT_NOT_ALLOWED')
    })

    it('should reject date that is too early', async () => {
      dataValidator.setCustomRules('date', { minDate: '2000-01-01' })
      
      const result = await dataValidator.validateData({
        value: '1990-01-01',
        type: 'date'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('DATE_TOO_EARLY')
    })

    it('should reject date that is too late', async () => {
      dataValidator.setCustomRules('date', { maxDate: '2020-12-31' })
      
      const result = await dataValidator.validateData({
        value: '2024-01-01',
        type: 'date'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('DATE_TOO_LATE')
    })

    it('should reject future dates when not allowed', async () => {
      dataValidator.setCustomRules('date', { allowFuture: false })
      
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      
      const result = await dataValidator.validateData({
        value: futureDate.toISOString().split('T')[0],
        type: 'date'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('FUTURE_DATE_NOT_ALLOWED')
    })

    it('should reject past dates when not allowed', async () => {
      dataValidator.setCustomRules('date', { allowPast: false })
      
      const pastDate = new Date()
      pastDate.setFullYear(pastDate.getFullYear() - 1)
      
      const result = await dataValidator.validateData({
        value: pastDate.toISOString().split('T')[0],
        type: 'date'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('PAST_DATE_NOT_ALLOWED')
    })

    it('should reject BLOB that is too large', async () => {
      dataValidator.setCustomRules('blob', { maxSize: 100 })
      
      const largeText = 'A'.repeat(200)
      
      const result = await dataValidator.validateData({
        value: largeText,
        type: 'blob'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('BLOB_TOO_LARGE')
    })
  })

  describe('validateData - Multiple Validation Issues', () => {
    it('should collect multiple validation errors', async () => {
      dataValidator.setCustomRules('numeric', { 
        min: 10, 
        max: 100, 
        allowNegative: false,
        precision: 0
      })
      
      const result = await dataValidator.validateData({
        value: -5.5,
        type: 'numeric'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(3)
      
      const errorCodes = result.errors.map(e => e.code)
      expect(errorCodes).toContain('VALUE_BELOW_MINIMUM')
      expect(errorCodes).toContain('NEGATIVE_VALUE_NOT_ALLOWED')
      expect(errorCodes).toContain('PRECISION_EXCEEDED')
    })

    it('should handle both errors and warnings', async () => {
      mockCqlRepository.findByConceptCode.mockResolvedValue([])
      
      const result = await dataValidator.validateData({
        value: 'test',
        type: 'text',
        conceptCode: 'TEST:123'
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].code).toBe('NO_CONCEPT_RULES')
    })
  })

  describe('validateData - Concept-Specific Validation', () => {
    it('should validate against concept rules', async () => {
      const mockRule = {
        CQL_ID: 1,
        NAME_CHAR: 'Test Rule',
        JSON_CHAR: JSON.stringify({ type: 'range', min: 10, max: 100 })
      }
      
      mockCqlRepository.findByConceptCode.mockResolvedValue([mockRule])
      
      const result = await dataValidator.validateData({
        value: 5,
        type: 'numeric',
        conceptCode: 'TEST:123'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('CONCEPT_RULE_VIOLATION')
      expect(result.errors[0].ruleId).toBe(1)
      expect(result.errors[0].ruleName).toBe('Test Rule')
    })

    it('should handle rule execution errors gracefully', async () => {
      const mockRule = {
        CQL_ID: 1,
        NAME_CHAR: 'Broken Rule',
        JSON_CHAR: 'invalid json'
      }
      
      mockCqlRepository.findByConceptCode.mockResolvedValue([mockRule])
      
      const result = await dataValidator.validateData({
        value: 50,
        type: 'numeric',
        conceptCode: 'TEST:123'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('CONCEPT_RULE_VIOLATION')
      expect(result.errors[0].details).toContain('Rule execution failed')
    })

    it('should warn when no concept rules found', async () => {
      mockCqlRepository.findByConceptCode.mockResolvedValue([])
      
      const result = await dataValidator.validateData({
        value: 50,
        type: 'numeric',
        conceptCode: 'TEST:123'
      })

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].code).toBe('NO_CONCEPT_RULES')
    })
  })

  describe('validateData - Business Logic Validation', () => {
    it('should validate age ranges', async () => {
      const result = await dataValidator.validateData({
        value: 200,
        type: 'numeric',
        metadata: { field: 'AGE_IN_YEARS' }
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_AGE_RANGE')
      expect(result.errors[0].message).toContain('Age must be between 0 and 150 years')
    })

    it('should validate blood pressure ranges', async () => {
      const result = await dataValidator.validateData({
        value: 400,
        type: 'numeric',
        metadata: { field: 'BLOOD_PRESSURE' }
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_BLOOD_PRESSURE')
      expect(result.errors[0].message).toContain('Blood pressure must be between 50 and 300 mmHg')
    })

    it('should validate heart rate ranges', async () => {
      const result = await dataValidator.validateData({
        value: 300,
        type: 'numeric',
        metadata: { field: 'HEART_RATE' }
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_HEART_RATE')
      expect(result.errors[0].message).toContain('Heart rate must be between 30 and 250 bpm')
    })
  })

  describe('validateData - Error Handling', () => {
    it('should handle validation system errors gracefully', async () => {
      // Mock a method to throw an error
      vi.spyOn(dataValidator, 'validateDataType').mockImplementation(() => {
        throw new Error('System failure')
      })

      const result = await dataValidator.validateData({
        value: 'test',
        type: 'text'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('VALIDATION_ERROR')
      expect(result.errors[0].severity).toBe('critical')
    })
  })

  describe('Utility Methods', () => {
    describe('isValidDate', () => {
      it('should validate correct date format', () => {
        expect(dataValidator.isValidDate('2024-01-15')).toBe(true)
        expect(dataValidator.isValidDate('2000-12-31')).toBe(true)
        expect(dataValidator.isValidDate('1999-02-29')).toBe(true) // JavaScript Date handles invalid dates gracefully
      })

      it('should reject invalid date formats', () => {
        expect(dataValidator.isValidDate('15-01-2024')).toBe(false)
        expect(dataValidator.isValidDate('2024/01/15')).toBe(false)
        expect(dataValidator.isValidDate('Jan 15, 2024')).toBe(false)
        expect(dataValidator.isValidDate('')).toBe(false)
        expect(dataValidator.isValidDate(null)).toBe(false)
        expect(dataValidator.isValidDate(123)).toBe(false)
      })
    })

    describe('setCustomRules', () => {
      it('should update validation rules for a data type', () => {
        const customRules = { min: 50, max: 150 }
        dataValidator.setCustomRules('numeric', customRules)
        
        expect(dataValidator.standardRules.numeric.min).toBe(50)
        expect(dataValidator.standardRules.numeric.max).toBe(150)
      })

      it('should preserve existing rules when updating', () => {
        const originalPrecision = dataValidator.standardRules.numeric.precision
        dataValidator.setCustomRules('numeric', { min: 100 })
        
        expect(dataValidator.standardRules.numeric.min).toBe(100)
        expect(dataValidator.standardRules.numeric.precision).toBe(originalPrecision)
      })
    })

    describe('getRules', () => {
      it('should return rules for valid data type', () => {
        const rules = dataValidator.getRules('numeric')
        expect(rules).toBeDefined()
        expect(rules.min).toBeDefined()
        expect(rules.max).toBeDefined()
      })

      it('should return null for invalid data type', () => {
        const rules = dataValidator.getRules('invalid_type')
        expect(rules).toBeNull()
      })
    })

    describe('resetToDefaults', () => {
      it('should reset all rules to default values', () => {
        // Modify some rules
        dataValidator.setCustomRules('numeric', { min: 100, max: 200 })
        dataValidator.setCustomRules('text', { maxLength: 500 })
        
        // Reset to defaults
        dataValidator.resetToDefaults()
        
        expect(dataValidator.standardRules.numeric.min).toBe(-Infinity)
        expect(dataValidator.standardRules.numeric.max).toBe(Infinity)
        expect(dataValidator.standardRules.text.maxLength).toBe(1000)
      })
    })
  })

  describe('executeBasicRule', () => {
    it('should validate range rules', () => {
      const ruleData = { type: 'range', min: 10, max: 100 }
      
      expect(dataValidator.executeBasicRule(ruleData, 50).isValid).toBe(true)
      expect(dataValidator.executeBasicRule(ruleData, 5).isValid).toBe(false)
      expect(dataValidator.executeBasicRule(ruleData, 150).isValid).toBe(false)
    })

    it('should validate enum rules', () => {
      const ruleData = { type: 'enum', values: ['red', 'green', 'blue'] }
      
      expect(dataValidator.executeBasicRule(ruleData, 'red').isValid).toBe(true)
      expect(dataValidator.executeBasicRule(ruleData, 'yellow').isValid).toBe(false)
    })

    it('should handle unknown rule types', () => {
      const ruleData = { type: 'unknown', someProperty: 'value' }
      
      expect(dataValidator.executeBasicRule(ruleData, 'test').isValid).toBe(true)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complex validation scenario with multiple issues', async () => {
      // Set strict rules
      dataValidator.setCustomRules('numeric', { 
        min: 20, 
        max: 80, 
        allowNegative: false,
        precision: 1
      })
      
      dataValidator.setCustomRules('text', { 
        minLength: 5, 
        maxLength: 20,
        allowEmpty: false
      })
      
      // Mock concept rules
      const mockRule = {
        CQL_ID: 1,
        NAME_CHAR: 'Strict Range Rule',
        JSON_CHAR: JSON.stringify({ type: 'range', min: 30, max: 70 })
      }
      mockCqlRepository.findByConceptCode.mockResolvedValue([mockRule])
      
      const result = await dataValidator.validateData({
        value: 15.55,
        type: 'numeric',
        conceptCode: 'TEST:123',
        metadata: { field: 'HEART_RATE' }
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
      
      // Should have multiple validation errors
      const errorCodes = result.errors.map(e => e.code)
      expect(errorCodes).toContain('VALUE_BELOW_MINIMUM')
      expect(errorCodes).toContain('PRECISION_EXCEEDED')
      expect(errorCodes).toContain('CONCEPT_RULE_VIOLATION')
      expect(errorCodes).toContain('INVALID_HEART_RATE')
    })

    it('should provide comprehensive error details for debugging', async () => {
      dataValidator.setCustomRules('numeric', { min: 100 })
      
      const result = await dataValidator.validateData({
        value: 50,
        type: 'numeric',
        conceptCode: 'TEST:123'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      
      const error = result.errors[0]
      expect(error.code).toBe('VALUE_BELOW_MINIMUM')
      expect(error.field).toBe('value')
      expect(error.message).toContain('Value 50 is below minimum 100')
      expect(error.details).toContain('Numeric values must be >= 100')
      expect(error.severity).toBe('error')
      
      // Check metadata
      expect(result.metadata.validatedAt).toBeDefined()
      expect(result.metadata.dataType).toBe('numeric')
      expect(result.metadata.conceptCode).toBe('TEST:123')
      expect(result.metadata.value).toBe(50)
    })
  })
})
