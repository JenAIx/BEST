<template>
  <div class="unit-converter">
    <div class="text-h6 q-mb-md">Medical Unit Converter</div>
    
    <q-select
      v-model="selectedCategory"
      :options="categories"
      label="Category"
      outlined
      class="q-mb-md"
      @update:model-value="resetValues"
    />
    
    <div v-if="selectedCategory" class="converter-content">
      <div class="row q-gutter-md">
        <div class="col">
          <q-input
            v-model.number="inputValue"
            type="number"
            :label="`Value in ${selectedCategory.fromUnit}`"
            outlined
            @input="convertValue"
            @update:model-value="convertValue"
          />
        </div>
        <div class="col">
          <q-input
            v-model="outputValue"
            :label="`Value in ${selectedCategory.toUnit}`"
            outlined
            readonly
          />
        </div>
      </div>
      
      <div class="q-mt-md">
        <q-btn-toggle
          v-model="conversionDirection"
          :options="[
            { label: selectedCategory.fromUnit, value: 'forward' },
            { label: selectedCategory.toUnit, value: 'reverse' }
          ]"
          @update:model-value="swapUnits"
          class="q-mb-md"
        />
      </div>
      
      <div v-if="selectedCategory.formula" class="formula-info">
        <q-expansion-item label="Conversion Formula" icon="functions">
          <div class="text-caption q-pa-sm bg-grey-1">
            {{ selectedCategory.formula }}
          </div>
        </q-expansion-item>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

defineOptions({
  name: 'UnitConverterWidget'
})

const selectedCategory = ref(null)
const inputValue = ref(0)
const outputValue = ref(0)
const conversionDirection = ref('forward')

const categories = [
  {
    label: 'Weight',
    value: 'weight',
    fromUnit: 'kg',
    toUnit: 'lbs',
    formula: '1 kg = 2.20462 lbs',
    convert: (val) => val * 2.20462,
    reverse: (val) => val / 2.20462
  },
  {
    label: 'Height',
    value: 'height',
    fromUnit: 'cm',
    toUnit: 'inches',
    formula: '1 cm = 0.393701 inches',
    convert: (val) => val * 0.393701,
    reverse: (val) => val / 0.393701
  },
  {
    label: 'Temperature',
    value: 'temperature',
    fromUnit: '°C',
    toUnit: '°F',
    formula: '°F = (°C × 9/5) + 32',
    convert: (val) => (val * 9/5) + 32,
    reverse: (val) => (val - 32) * 5/9
  },
  {
    label: 'Blood Pressure',
    value: 'pressure',
    fromUnit: 'mmHg',
    toUnit: 'kPa',
    formula: '1 mmHg = 0.133322 kPa',
    convert: (val) => val * 0.133322,
    reverse: (val) => val / 0.133322
  },
  {
    label: 'Volume',
    value: 'volume',
    fromUnit: 'ml',
    toUnit: 'fl oz',
    formula: '1 ml = 0.033814 fl oz',
    convert: (val) => val * 0.033814,
    reverse: (val) => val / 0.033814
  }
]

const resetValues = () => {
  inputValue.value = 0
  outputValue.value = 0
  conversionDirection.value = 'forward'
}

const convertValue = () => {
  if (!selectedCategory.value || inputValue.value === null || inputValue.value === '') {
    outputValue.value = ''
    return
  }
  
  const numValue = parseFloat(inputValue.value)
  if (isNaN(numValue)) {
    outputValue.value = ''
    return
  }
  
  if (conversionDirection.value === 'forward') {
    outputValue.value = selectedCategory.value.convert(numValue).toFixed(4)
  } else {
    outputValue.value = selectedCategory.value.reverse(numValue).toFixed(4)
  }
}

const swapUnits = () => {
  if (!selectedCategory.value) return
  
  // Swap the units
  const tempUnit = selectedCategory.value.fromUnit
  selectedCategory.value.fromUnit = selectedCategory.value.toUnit
  selectedCategory.value.toUnit = tempUnit
  
  // Swap the values
  const tempValue = inputValue.value
  inputValue.value = outputValue.value
  outputValue.value = tempValue
  
  // Recalculate after swap
  convertValue()
}

// Watch for changes in input value and automatically convert
watch(inputValue, () => {
  convertValue()
})

// Watch for changes in conversion direction and recalculate
watch(conversionDirection, () => {
  convertValue()
})
</script>

<style lang="scss" scoped>
.unit-converter {
  min-width: 400px;
}

.converter-content {
  .row {
    align-items: end;
  }
}

.formula-info {
  margin-top: 16px;
}
</style>
