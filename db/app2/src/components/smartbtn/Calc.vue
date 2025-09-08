<template>
  <div class="calculator">
    <!-- Display -->
    <div class="display">
      <div class="previous-operand">{{ previousOperand }} {{ operation }}</div>
      <div class="current-operand">{{ currentOperand }}</div>
    </div>

    <!-- Buttons -->
    <div class="buttons">
      <!-- Row 1 -->
      <button class="btn btn-clear" @click="clear">C</button>
      <button class="btn btn-operator" @click="deleteLast">⌫</button>
      <button class="btn btn-operator" @click="chooseOperation">÷</button>
      <button class="btn btn-operator" @click="chooseOperation">×</button>

      <!-- Row 2 -->
      <button class="btn btn-number" @click="appendNumber">7</button>
      <button class="btn btn-number" @click="appendNumber">8</button>
      <button class="btn btn-number" @click="appendNumber">9</button>
      <button class="btn btn-operator" @click="chooseOperation">-</button>

      <!-- Row 3 -->
      <button class="btn btn-number" @click="appendNumber">4</button>
      <button class="btn btn-number" @click="appendNumber">5</button>
      <button class="btn btn-number" @click="appendNumber">6</button>
      <button class="btn btn-operator" @click="chooseOperation">+</button>

      <!-- Row 4 -->
      <button class="btn btn-number" @click="appendNumber">1</button>
      <button class="btn btn-number" @click="appendNumber">2</button>
      <button class="btn btn-number" @click="appendNumber">3</button>
      <button class="btn btn-equals" @click="compute" rowspan="2">=</button>

      <!-- Row 5 -->
      <button class="btn btn-number btn-zero" @click="appendNumber">0</button>
      <button class="btn btn-number" @click="appendNumber">.</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineOptions({
  name: 'CalculatorWidget'
})

const previousOperand = ref('')
const currentOperand = ref('0')
const operation = ref('')

const clear = () => {
  currentOperand.value = '0'
  previousOperand.value = ''
  operation.value = ''
}

const deleteLast = () => {
  if (currentOperand.value.length > 1) {
    currentOperand.value = currentOperand.value.slice(0, -1)
  } else {
    currentOperand.value = '0'
  }
}

const appendNumber = (event) => {
  const number = event.target.textContent
  
  if (number === '.' && currentOperand.value.includes('.')) return
  
  if (currentOperand.value === '0' && number !== '.') {
    currentOperand.value = number
  } else {
    currentOperand.value += number
  }
}

const chooseOperation = (event) => {
  if (currentOperand.value === '') return
  
  if (previousOperand.value !== '') {
    compute()
  }
  
  operation.value = event.target.textContent
  previousOperand.value = currentOperand.value
  currentOperand.value = ''
}

const compute = () => {
  const prev = parseFloat(previousOperand.value)
  const current = parseFloat(currentOperand.value)
  
  if (isNaN(prev) || isNaN(current)) return
  
  let computation
  
  switch (operation.value) {
    case '+':
      computation = prev + current
      break
    case '-':
      computation = prev - current
      break
    case '×':
      computation = prev * current
      break
    case '÷':
      computation = prev / current
      break
    default:
      return
  }
  
  currentOperand.value = computation.toString()
  operation.value = ''
  previousOperand.value = ''
}
</script>

<style lang="scss" scoped>
.calculator {
  background: #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  max-width: 300px;
  margin: 0 auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.display {
  background: #000;
  color: #fff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: right;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.previous-operand {
  font-size: 14px;
  color: #888;
  min-height: 20px;
}

.current-operand {
  font-size: 24px;
  font-weight: bold;
  min-height: 30px;
}

.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.btn {
  padding: 16px;
  font-size: 18px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: bold;
  
  &:hover {
    opacity: 0.8;
  }
  
  &:active {
    transform: scale(0.95);
  }
}

.btn-number {
  background: #fff;
  color: #333;
  border: 1px solid #ddd;
}

.btn-operator {
  background: #ff9500;
  color: #fff;
}

.btn-equals {
  background: #ff9500;
  color: #fff;
  grid-row: span 2;
}

.btn-clear {
  background: #a6a6a6;
  color: #fff;
}

.btn-zero {
  grid-column: span 2;
}
</style>
