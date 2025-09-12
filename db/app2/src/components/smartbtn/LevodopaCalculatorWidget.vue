<template>
  <div class="levodopa-calculator">
    <div class="text-h6 q-mb-md">Levodopa Equivalence Calculator</div>
    <div class="text-caption text-grey-6 q-mb-lg">
      Calculate total Levodopa Equivalent Dose (LED) for Parkinson's medications
      <br />Based on 2023 systematic review and consensus proposal (MDS 2023)
    </div>

    <div class="medications-table">
      <q-table :rows="medicationsWithLED" :columns="columns" row-key="id" flat bordered :rows-per-page-options="[0]" hide-pagination class="medication-table">
        <template v-slot:body-cell-drug="props">
          <q-td :props="props">
            <q-select
              :model-value="props.row.drugType"
              @update:model-value="updateMedicationType(props.row, $event)"
              :options="filteredDrugOptions"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              use-input
              hide-selected
              fill-input
              input-debounce="0"
              @filter="filterDrugs"
              outlined
              dense
              class="drug-select"
              :placeholder="$t('smartButton.searchMedications')"
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey"> No medications found </q-item-section>
                </q-item>
              </template>

              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey-6"> {{ scope.opt.category }} • Factor: {{ scope.opt.factor }} </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-chip size="sm" :color="getFactorColor(scope.opt.factor.toString())" text-color="white">
                      {{ scope.opt.factor }}
                    </q-chip>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-td>
        </template>

        <template v-slot:body-cell-dosage="props">
          <q-td :props="props">
            <q-input :model-value="props.row.dose" @update:model-value="updateDose(props.row, $event)" type="number" outlined dense min="0" step="0.1">
              <template v-slot:append>
                <q-chip size="sm" color="primary" text-color="white">
                  {{ props.row.unit }}
                </q-chip>
              </template>
            </q-input>
          </q-td>
        </template>

        <template v-slot:body-cell-equivalent="props">
          <q-td :props="props">
            <q-input :model-value="props.row.ledEquivalent" outlined dense readonly class="led-equivalent">
              <template v-slot:append>
                <q-chip size="sm" color="green" text-color="white"> mg </q-chip>
              </template>
            </q-input>
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn icon="delete" size="sm" flat round color="red" @click="removeMedication(props.rowIndex)" :disable="medications.length <= 1">
              <q-tooltip>Remove medication</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

    <div class="q-mb-md">
      <q-btn icon="add" :label="$t('smartButton.addMedication')" color="primary" outline @click="addMedication" class="q-mr-sm" />
      <q-btn icon="refresh" :label="$t('smartButton.resetAll')" color="grey" outline @click="resetAll" />
    </div>

    <q-separator class="q-my-md" />

    <div class="led-summary">
      <q-card flat bordered class="q-pa-md">
        <div class="text-center">
          <div class="text-h4 text-primary">{{ totalLED.toFixed(1) }}</div>
          <div class="text-subtitle1">Total LED (mg/day)</div>
          <div class="text-caption text-grey-6 q-mt-sm">
            {{ getLEDInterpretation() }}
          </div>
        </div>
      </q-card>
    </div>

    <div class="q-mt-md">
      <q-expansion-item :label="$t('smartButton.conversionReference')" icon="info">
        <div class="q-pa-sm">
          <div class="text-caption text-grey-6 q-mb-md">
            Based on 2023 systematic review and consensus proposal (MDS)
            <br />DD = Daily Dose, L-DOPA = Levodopa subtotal
          </div>

          <div v-for="category in referenceMedications" :key="category.category" class="q-mb-lg">
            <div class="text-subtitle2 text-primary q-mb-sm">
              {{ category.category }}
            </div>

            <div v-if="category.special" class="text-caption text-orange q-mb-sm">
              <q-icon name="info" size="sm" class="q-mr-xs" />
              {{ category.special }}
            </div>

            <q-list dense bordered class="rounded-borders">
              <q-item v-for="item in category.items" :key="item.name">
                <q-item-section>
                  <q-item-label>{{ item.name }}</q-item-label>
                  <q-item-label caption class="text-grey-7">{{ item.formula }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-chip size="sm" :color="getFactorColor(item.factor)" text-color="white">
                    {{ item.factor }}
                  </q-chip>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <div class="text-caption text-grey-6 q-mt-md">
            <strong>Special Rules:</strong><br />
            • COMT inhibitors: Calculate LED of levodopa drugs first, then multiply by factor<br />
            • Fixed LED: Safinamide, Zonisamide, Trihexyphenidyl provide constant values<br />
            • Istradefylline: Multiplies total levodopa subtotal by 0.2<br />
            • Anticholinergics: Only if single dose yields ≥5 UPDRS-III points improvement
          </div>
        </div>
      </q-expansion-item>
    </div>

    <div class="q-mt-md">
      <q-expansion-item :label="$t('smartButton.calculationDetails')" icon="calculate">
        <div class="q-pa-sm">
          <div class="text-caption text-grey-6 q-mb-sm">Current calculations:</div>
          <div v-for="med in medicationsWithLED" :key="med.id" class="q-mb-xs">
            <span class="text-weight-medium">{{ med.name }}:</span>
            <span class="q-mx-sm">
              <template v-if="getSpecialCalculationNote(med)"> {{ getSpecialCalculationNote(med) }} = {{ med.ledEquivalent }} mg LED </template>
              <template v-else> {{ med.dose || 0 }} mg × {{ med.factor }} = {{ med.ledEquivalent }} mg LED </template>
            </span>
          </div>
          <q-separator class="q-my-sm" />
          <div class="text-weight-bold">Total: {{ totalLED.toFixed(1) }} mg LED</div>
          <div class="text-caption text-grey-6 q-mt-sm">
            * COMT inhibitors and Istradefylline multiply levodopa subtotal<br />
            * Fixed LED drugs provide constant values when dose > 0
          </div>
        </div>
      </q-expansion-item>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineOptions({
  name: 'LevodopaCalculatorWidget',
})

const medications = ref([
  {
    id: 'med-1',
    drugType: 'levodopa',
    name: 'Levodopa (Standard)',
    dose: 0,
    unit: 'mg/day',
    factor: 1.0,
  },
])

const columns = [
  {
    name: 'drug',
    label: 'Drug',
    field: 'name',
    align: 'left',
    style: 'min-width: 200px',
  },
  {
    name: 'dosage',
    label: 'Dosage',
    field: 'dose',
    align: 'center',
    style: 'min-width: 150px',
  },
  {
    name: 'equivalent',
    label: 'LED Equivalent',
    field: 'equivalent',
    align: 'center',
    style: 'min-width: 150px',
  },
  {
    name: 'actions',
    label: 'Actions',
    field: 'actions',
    align: 'center',
    style: 'width: 80px',
  },
]

const drugOptions = [
  // Levodopa-containing drugs
  {
    label: 'Levodopa (Standard)',
    value: 'levodopa',
    factor: 1.0,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'Dual-release Levodopa',
    value: 'levodopa-dual',
    factor: 0.85,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'Controlled-release Levodopa',
    value: 'levodopa-cr',
    factor: 0.75,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'Extended-release Levodopa (IPX066)',
    value: 'levodopa-er',
    factor: 0.5,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'Inhaled Levodopa (Capsules)',
    value: 'levodopa-inhaled',
    factor: 0.69,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'LCIG (Intrajejunal L/C)',
    value: 'lcig',
    factor: 1.11,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'LECIG Morning Dose',
    value: 'lecig-morning',
    factor: 1.11,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'LECIG Maintenance/Extra',
    value: 'lecig-maintenance',
    factor: 1.46,
    unit: 'mg/day',
    category: 'Levodopa',
  },
  {
    label: 'Foslevodopa/Foscarbidopa (SC)',
    value: 'foslevodopa',
    factor: 0.75,
    unit: 'mg/day',
    category: 'Levodopa',
  },

  // COMT Inhibitors (special calculation)
  {
    label: 'Entacapone',
    value: 'entacapone',
    factor: 0.33,
    unit: 'mg/day',
    category: 'COMT',
    special: 'comt',
  },
  {
    label: 'Tolcapone',
    value: 'tolcapone',
    factor: 0.5,
    unit: 'mg/day',
    category: 'COMT',
    special: 'comt',
  },
  {
    label: 'Opicapone',
    value: 'opicapone',
    factor: 0.5,
    unit: 'mg/day',
    category: 'COMT',
    special: 'comt',
  },

  // MAO-B Inhibitors
  {
    label: 'Selegiline (Oral)',
    value: 'selegiline-oral',
    factor: 10.0,
    unit: 'mg/day',
    category: 'MAO-B',
  },
  {
    label: 'Selegiline (Sublingual)',
    value: 'selegiline-sublingual',
    factor: 80.0,
    unit: 'mg/day',
    category: 'MAO-B',
  },
  {
    label: 'Rasagiline',
    value: 'rasagiline',
    factor: 100.0,
    unit: 'mg/day',
    category: 'MAO-B',
  },

  // Non-ergot Dopamine Agonists
  {
    label: 'Pramipexole (Salt)',
    value: 'pramipexole-salt',
    factor: 100.0,
    unit: 'mg/day',
    category: 'DA Agonist',
  },
  {
    label: 'Pramipexole (Base)',
    value: 'pramipexole-base',
    factor: 142.86,
    unit: 'mg/day',
    category: 'DA Agonist',
  },
  {
    label: 'Ropinirole',
    value: 'ropinirole',
    factor: 20.0,
    unit: 'mg/day',
    category: 'DA Agonist',
  },
  {
    label: 'Rotigotine',
    value: 'rotigotine',
    factor: 30.3,
    unit: 'mg/day',
    category: 'DA Agonist',
  },
  {
    label: 'Piribedil',
    value: 'piribedil',
    factor: 1.0,
    unit: 'mg/day',
    category: 'DA Agonist',
  },
  {
    label: 'Apomorphine (SC)',
    value: 'apomorphine-sc',
    factor: 10.0,
    unit: 'mg/day',
    category: 'DA Agonist',
  },
  {
    label: 'Apomorphine (Sublingual)',
    value: 'apomorphine-sublingual',
    factor: 1.5,
    unit: 'mg/day',
    category: 'DA Agonist',
  },

  // Ergot Dopamine Agonists
  {
    label: 'Lisuride',
    value: 'lisuride',
    factor: 100.0,
    unit: 'mg/day',
    category: 'Ergot DA',
  },
  {
    label: 'Bromocriptine',
    value: 'bromocriptine',
    factor: 10.0,
    unit: 'mg/day',
    category: 'Ergot DA',
  },
  {
    label: 'Pergolide',
    value: 'pergolide',
    factor: 100.0,
    unit: 'mg/day',
    category: 'Ergot DA',
  },
  {
    label: 'Cabergoline',
    value: 'cabergoline',
    factor: 66.67,
    unit: 'mg/day',
    category: 'Ergot DA',
  },
  {
    label: 'Dihydroergocryptine',
    value: 'dihydroergocryptine',
    factor: 5.0,
    unit: 'mg/day',
    category: 'Ergot DA',
  },

  // Others
  {
    label: 'Amantadine IR',
    value: 'amantadine-ir',
    factor: 1.0,
    unit: 'mg/day',
    category: 'Other',
  },
  {
    label: 'Amantadine ER (ADS-5102)',
    value: 'amantadine-er',
    factor: 1.25,
    unit: 'mg/day',
    category: 'Other',
  },
  {
    label: 'Amantadine IR/ER (OS320)',
    value: 'amantadine-os320',
    factor: 1.0,
    unit: 'mg/day',
    category: 'Other',
  },

  // Fixed LED values
  {
    label: 'Safinamide (50-100mg)',
    value: 'safinamide',
    factor: 0,
    fixedLED: 150,
    unit: 'mg/day',
    category: 'Fixed LED',
    special: 'fixed',
  },
  {
    label: 'Zonisamide (25-50mg)',
    value: 'zonisamide',
    factor: 0,
    fixedLED: 100,
    unit: 'mg/day',
    category: 'Fixed LED',
    special: 'fixed',
  },
  {
    label: 'Trihexyphenidyl',
    value: 'trihexyphenidyl',
    factor: 0,
    fixedLED: 100,
    unit: 'mg/day',
    category: 'Fixed LED',
    special: 'fixed',
  },

  // Special multiplier
  {
    label: 'Istradefylline',
    value: 'istradefylline',
    factor: 0.2,
    unit: 'mg/day',
    category: 'Special',
    special: 'multiplier',
  },
]

// Filtered drug options for searchable select
const filteredDrugOptions = ref(drugOptions)

const referenceMedications = [
  // Levodopa-containing drugs
  {
    category: 'Levodopa-containing Drugs',
    items: [
      { name: 'Levodopa (Standard)', factor: '1.0', formula: 'DD × 1' },
      { name: 'Dual-release Levodopa', factor: '0.85', formula: 'DD × 0.85' },
      { name: 'Controlled-release Levodopa', factor: '0.75', formula: 'DD × 0.75' },
      { name: 'Extended-release (IPX066)', factor: '0.5', formula: 'DD × 0.5' },
      { name: 'Inhaled Levodopa', factor: '0.69', formula: 'DD × 0.69' },
      { name: 'LCIG (Intrajejunal L/C)', factor: '1.11', formula: 'DD × 1.11' },
      { name: 'LECIG Morning', factor: '1.11', formula: 'DD × 1.11' },
      { name: 'LECIG Maintenance/Extra', factor: '1.46', formula: 'DD × 1.46' },
      { name: 'Foslevodopa/Foscarbidopa', factor: '0.75', formula: 'DD × 0.75' },
    ],
  },
  // COMT Inhibitors
  {
    category: 'COMT Inhibitors',
    special: 'Multiply levodopa subtotal by factor',
    items: [
      { name: 'Entacapone', factor: '0.33', formula: 'L-DOPA × 0.33' },
      { name: 'Tolcapone', factor: '0.5', formula: 'L-DOPA × 0.5' },
      { name: 'Opicapone', factor: '0.5', formula: 'L-DOPA × 0.5' },
    ],
  },
  // MAO-B Inhibitors
  {
    category: 'MAO-B Inhibitors',
    items: [
      { name: 'Selegiline (Oral)', factor: '10', formula: 'DD × 10' },
      { name: 'Selegiline (Sublingual)', factor: '80', formula: 'DD × 80' },
      { name: 'Rasagiline', factor: '100', formula: 'DD × 100' },
    ],
  },
  // Non-ergot Dopamine Agonists
  {
    category: 'Non-ergot Dopamine Agonists',
    items: [
      { name: 'Pramipexole (Salt)', factor: '100', formula: 'DD × 100' },
      { name: 'Pramipexole (Base)', factor: '142.86', formula: 'DD × 142.86' },
      { name: 'Ropinirole', factor: '20', formula: 'DD × 20' },
      { name: 'Rotigotine', factor: '30.3', formula: 'DD × 30.3' },
      { name: 'Piribedil', factor: '1', formula: 'DD × 1' },
      { name: 'Apomorphine (SC)', factor: '10', formula: 'DD × 10' },
      { name: 'Apomorphine (Sublingual)', factor: '1.5', formula: 'DD × 1.5' },
    ],
  },
  // Ergot Dopamine Agonists
  {
    category: 'Ergot Dopamine Agonists',
    items: [
      { name: 'Lisuride', factor: '100', formula: 'DD × 100' },
      { name: 'Bromocriptine', factor: '10', formula: 'DD × 10' },
      { name: 'Pergolide', factor: '100', formula: 'DD × 100' },
      { name: 'Cabergoline', factor: '66.67', formula: 'DD × 66.67' },
      { name: 'Dihydroergocryptine', factor: '5', formula: 'DD × 5' },
    ],
  },
  // Others
  {
    category: 'Other Medications',
    items: [
      { name: 'Amantadine IR', factor: '1', formula: 'DD × 1' },
      { name: 'Amantadine ER (ADS-5102)', factor: '1.25', formula: 'DD × 1.25' },
      { name: 'Amantadine IR/ER (OS320)', factor: '1', formula: 'DD × 1' },
    ],
  },
  // Fixed LED values
  {
    category: 'Fixed LED Values',
    special: 'Constant LED regardless of dose',
    items: [
      { name: 'Safinamide (50-100mg)', factor: '150 mg', formula: 'LED = 150 mg' },
      { name: 'Zonisamide (25-50mg)', factor: '100 mg', formula: 'LED = 100 mg' },
      { name: 'Trihexyphenidyl', factor: '100 mg', formula: 'LED = 100 mg' },
    ],
  },
  // Special multipliers
  {
    category: 'Special Multipliers',
    special: 'Multiply levodopa subtotal by factor',
    items: [{ name: 'Istradefylline', factor: '0.2', formula: 'L-DOPA × 0.2' }],
  },
]

// Helper function to calculate LED for individual medication
const calculateIndividualLED = (medication) => {
  const dose = parseFloat(medication.dose) || 0
  const drugInfo = drugOptions.find((drug) => drug.value === medication.drugType)

  if (!drugInfo) return 0

  // Handle special cases
  if (drugInfo.special === 'fixed') {
    // Fixed LED values (Safinamide, Zonisamide, Trihexyphenidyl)
    return dose > 0 ? drugInfo.fixedLED : 0
  }

  if (drugInfo.special === 'comt') {
    // COMT inhibitors: multiply levodopa subtotal by factor
    const levodopaSubtotal = getLevodopaSubtotal()
    return levodopaSubtotal * drugInfo.factor
  }

  if (drugInfo.special === 'multiplier') {
    // Istradefylline: multiply levodopa subtotal by factor
    const levodopaSubtotal = getLevodopaSubtotal()
    return levodopaSubtotal * drugInfo.factor
  }

  // Standard calculation: dose × factor
  return dose * drugInfo.factor
}

// Helper function to get levodopa subtotal (for COMT inhibitors and Istradefylline)
const getLevodopaSubtotal = () => {
  return medications.value
    .filter((med) => {
      const drugInfo = drugOptions.find((drug) => drug.value === med.drugType)
      return drugInfo && drugInfo.category === 'Levodopa'
    })
    .reduce((sum, med) => {
      const dose = parseFloat(med.dose) || 0
      const drugInfo = drugOptions.find((drug) => drug.value === med.drugType)
      return sum + dose * (drugInfo?.factor || 1.0)
    }, 0)
}

// Computed property that adds LED equivalent to each medication
const medicationsWithLED = computed(() => {
  return medications.value.map((medication) => {
    const ledEquivalent = calculateIndividualLED(medication).toFixed(1)
    return {
      ...medication,
      ledEquivalent,
    }
  })
})

// Computed property for total LED
const totalLED = computed(() => {
  return medications.value.reduce((sum, med) => {
    return sum + calculateIndividualLED(med)
  }, 0)
})

const updateMedicationType = (medicationFromComputed, newDrugType) => {
  // Find the original medication in the medications array
  const originalMed = medications.value.find((med) => med.id === medicationFromComputed.id)
  if (!originalMed) {
    return
  }

  const selectedDrug = drugOptions.find((drug) => drug.value === newDrugType)
  if (selectedDrug) {
    // Update the original medication
    originalMed.drugType = newDrugType
    originalMed.name = selectedDrug.label
    originalMed.factor = selectedDrug.factor
    originalMed.unit = selectedDrug.unit
  }
}

const updateDose = (medicationFromComputed, newDose) => {
  // Find the original medication in the medications array
  const originalMed = medications.value.find((med) => med.id === medicationFromComputed.id)
  if (originalMed) {
    originalMed.dose = parseFloat(newDose) || 0
  }
}

const addMedication = () => {
  const newMedication = {
    id: `med-${Date.now()}`,
    drugType: 'levodopa',
    name: 'Levodopa (Standard)',
    dose: 0,
    unit: 'mg/day',
    factor: 1.0,
  }
  medications.value.push(newMedication)
}

const removeMedication = (index) => {
  if (medications.value.length > 1) {
    medications.value.splice(index, 1)
  }
}

const resetAll = () => {
  medications.value.forEach((med) => {
    med.dose = 0
  })
}

const getLEDInterpretation = () => {
  const led = totalLED.value
  if (led === 0) return 'No medications entered'
  if (led < 400) return 'Low dose range'
  if (led < 800) return 'Moderate dose range'
  if (led < 1200) return 'High dose range'
  return 'Very high dose range - consider specialist review'
}

const getSpecialCalculationNote = (medication) => {
  const drugInfo = drugOptions.find((drug) => drug.value === medication.drugType)
  if (!drugInfo) return null

  if (drugInfo.special === 'fixed') {
    return `Fixed LED (${drugInfo.fixedLED} mg)`
  }

  if (drugInfo.special === 'comt') {
    const levodopaSubtotal = getLevodopaSubtotal()
    return `${levodopaSubtotal.toFixed(1)} mg (L-DOPA) × ${drugInfo.factor}`
  }

  if (drugInfo.special === 'multiplier') {
    const levodopaSubtotal = getLevodopaSubtotal()
    return `${levodopaSubtotal.toFixed(1)} mg (L-DOPA) × ${drugInfo.factor}`
  }

  return null
}

const getFactorColor = (factor) => {
  const numFactor = parseFloat(factor)

  // Fixed LED values
  if (factor.includes('mg')) return 'purple'

  // Color code by factor ranges
  if (numFactor >= 100) return 'red' // High factors (100+)
  if (numFactor >= 10) return 'orange' // Medium-high factors (10-99)
  if (numFactor >= 1) return 'green' // Standard factors (1-9.9)
  if (numFactor > 0) return 'blue' // Low factors (0.1-0.99)

  return 'grey' // Default
}

const filterDrugs = (val, update) => {
  update(() => {
    if (val === '') {
      filteredDrugOptions.value = drugOptions
    } else {
      const needle = val.toLowerCase()
      filteredDrugOptions.value = drugOptions.filter((drug) => drug.label.toLowerCase().includes(needle) || drug.category.toLowerCase().includes(needle) || drug.value.toLowerCase().includes(needle))
    }
  })
}
</script>

<style lang="scss" scoped>
.levodopa-calculator {
  min-width: 700px;
  max-width: 900px;
}

.medications-table {
  margin-bottom: 16px;
}

.medication-table {
  .q-table__top {
    padding: 8px 16px;
    background: #f5f5f5;
  }

  .q-table__bottom {
    padding: 8px 16px;
    background: #f5f5f5;
  }
}

.drug-select {
  min-width: 220px;

  .q-field__input {
    font-size: 14px;
  }

  .q-item__label--caption {
    font-size: 11px;
  }
}

.led-equivalent {
  .q-field__control {
    background-color: #e8f5e8;
  }
}

.led-summary {
  .q-card {
    background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  }
}
</style>
