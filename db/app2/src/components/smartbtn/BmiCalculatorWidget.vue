<template>
  <div class="bmi-calculator">
    <div class="text-h6 q-mb-md">BMI Calculator</div>
    
    <div class="row q-gutter-md">
      <div class="col">
        <q-input
          v-model.number="height"
          type="number"
          label="Height (cm)"
          outlined
          suffix="cm"
          @input="calculateBMI"
        />
      </div>
      <div class="col">
        <q-input
          v-model.number="weight"
          type="number"
          label="Weight (kg)"
          outlined
          suffix="kg"
          @input="calculateBMI"
        />
      </div>
    </div>
    
    <div v-if="bmi" class="q-mt-lg">
      <q-card flat bordered class="q-pa-md">
        <div class="text-center">
          <div class="text-h4 text-primary">{{ bmi.toFixed(1) }}</div>
          <div class="text-subtitle1">{{ bmiCategory }}</div>
          <q-linear-progress
            :value="bmiProgress"
            :color="bmiColor"
            size="20px"
            class="q-mt-md"
          />
        </div>
      </q-card>
      
      <div class="q-mt-md">
        <q-expansion-item label="BMI Categories" icon="info">
          <q-list>
            <q-item v-for="category in bmiCategories" :key="category.range">
              <q-item-section>
                <q-item-label>{{ category.range }}</q-item-label>
                <q-item-label caption>{{ category.description }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip 
                  :color="category.color" 
                  text-color="white" 
                  size="sm"
                >
                  {{ category.label }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineOptions({
  name: 'BmiCalculatorWidget'
})

const height = ref(null)
const weight = ref(null)

const bmi = computed(() => {
  if (!height.value || !weight.value || height.value <= 0 || weight.value <= 0) {
    return null
  }
  const heightInMeters = height.value / 100
  return weight.value / (heightInMeters * heightInMeters)
})

const bmiCategories = [
  { range: '< 18.5', label: 'Underweight', color: 'blue', description: 'Below normal weight' },
  { range: '18.5 - 24.9', label: 'Normal', color: 'green', description: 'Healthy weight range' },
  { range: '25.0 - 29.9', label: 'Overweight', color: 'orange', description: 'Above normal weight' },
  { range: '30.0 - 34.9', label: 'Obese I', color: 'red', description: 'Moderately obese' },
  { range: '35.0 - 39.9', label: 'Obese II', color: 'red', description: 'Severely obese' },
  { range: '≥ 40.0', label: 'Obese III', color: 'red', description: 'Very severely obese' }
]

const bmiCategory = computed(() => {
  if (!bmi.value) return ''
  
  if (bmi.value < 18.5) return 'Underweight'
  if (bmi.value < 25) return 'Normal weight'
  if (bmi.value < 30) return 'Overweight'
  if (bmi.value < 35) return 'Obese I'
  if (bmi.value < 40) return 'Obese II'
  return 'Obese III'
})

const bmiColor = computed(() => {
  if (!bmi.value) return 'grey'
  
  if (bmi.value < 18.5) return 'blue'
  if (bmi.value < 25) return 'green'
  if (bmi.value < 30) return 'orange'
  return 'red'
})

const bmiProgress = computed(() => {
  if (!bmi.value) return 0
  // Normalize BMI to 0-1 range for progress bar (15-40 range)
  return Math.min(Math.max((bmi.value - 15) / 25, 0), 1)
})

const calculateBMI = () => {
  // BMI calculation is handled by computed property
}
</script>

<style lang="scss" scoped>
.bmi-calculator {
  min-width: 350px;
}
</style>
