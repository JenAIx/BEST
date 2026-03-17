/**
 * Tests for computed get/set pattern in RenderQuest child components.
 * Component logic is defined inline (mirrors the <script> exports) to avoid
 * needing a Vue SFC transform in Jest.
 */

// ─── Component definitions (mirrors script exports) ───

const radioDef = {
  computed: {
    val: {
      get() { return this.ITEM.value },
      set(v) { this.$emit('emitValue', v) }
    }
  }
}

const sliderDef = {
  computed: {
    val: {
      get() { return this.ITEM.value },
      set(v) { this.$emit('emitValue', v) }
    },
    max() { return parseInt(this.ITEM.options.top.value) },
    min() { return parseInt(this.ITEM.options.bottom.value) },
    meinWert() {
      if (this.val === null) return 'bitte einen Wert auswählen'
      else return 'Mein Wert: ' + this.val
    }
  }
}

const textDef = {
  computed: {
    val: {
      get() { return this.ITEM.value },
      set(v) {
        if (this.ITEM.type === 'number') {
          const parsed = parseFloat(v)
          v = Number.isNaN(parsed) ? null : parsed
        }
        this.$emit('emitValue', v)
      }
    }
  }
}

const multipleRadioDef = {
  computed: {
    val: {
      get() {
        if (this.ITEM.example_value) return this.ITEM.example_value
        if (this.ITEM.value && this.ITEM.value.length > 0) return this.ITEM.value
        return new Array(this.ITEM.options.questions.length).fill(null)
      },
      set(v) { this.$emit('emitValue', v) }
    },
    short_answers() {
      var out = []
      this.ITEM.options.answers.forEach(v => {
        out.push({ label: '', value: v.value })
      })
      return out
    },
    answers_only() {
      var out = []
      this.ITEM.options.answers.forEach(v => {
        out.push(v.label)
      })
      return out
    }
  },
  methods: {
    onRadioChange(index, value) {
      const updated = [...this.val]
      updated[index] = value
      this.$emit('emitValue', updated)
    }
  }
}

// ─── Helper ───

function createMockInstance(componentDef, props) {
  const emitted = []
  const instance = {
    ...props,
    $emit(event, value) {
      emitted.push({ event, value })
    },
    _emitted: emitted
  }

  if (componentDef.computed) {
    for (const [key, def] of Object.entries(componentDef.computed)) {
      if (typeof def === 'function') {
        Object.defineProperty(instance, key, {
          get: def.bind(instance),
          configurable: true
        })
      } else if (def.get && def.set) {
        Object.defineProperty(instance, key, {
          get: def.get.bind(instance),
          set: def.set.bind(instance),
          configurable: true
        })
      }
    }
  }

  if (componentDef.methods) {
    for (const [key, fn] of Object.entries(componentDef.methods)) {
      instance[key] = fn.bind(instance)
    }
  }

  return instance
}

// ─── RenderQuest_radio ───

describe('RenderQuest_radio computed val', () => {
  test('getter reads ITEM.value', () => {
    const instance = createMockInstance(radioDef, {
      ITEM: { value: 'option_a', options: [], type: 'radio', inline: false }
    })
    expect(instance.val).toBe('option_a')
  })

  test('setter emits emitValue', () => {
    const instance = createMockInstance(radioDef, {
      ITEM: { value: null, options: [], type: 'radio', inline: false }
    })
    instance.val = 'option_b'
    expect(instance._emitted).toEqual([{ event: 'emitValue', value: 'option_b' }])
  })

  test('checkbox array values work', () => {
    const instance = createMockInstance(radioDef, {
      ITEM: { value: ['a', 'c'], options: [], type: 'checkbox', inline: false }
    })
    expect(instance.val).toEqual(['a', 'c'])

    instance.val = ['a', 'b', 'c']
    expect(instance._emitted[0].value).toEqual(['a', 'b', 'c'])
  })
})

// ─── RenderQuest_slider ───

describe('RenderQuest_slider computed val', () => {
  function makeSliderInstance(value) {
    return createMockInstance(sliderDef, {
      ITEM: {
        value,
        vertical: false,
        options: {
          top: { value: '10', label: 'High' },
          bottom: { value: '0', label: 'Low' },
          steps: '1'
        }
      }
    })
  }

  test('getter reads ITEM.value (including null)', () => {
    expect(makeSliderInstance(null).val).toBeNull()
  })

  test('getter reads ITEM.value when set', () => {
    expect(makeSliderInstance(5).val).toBe(5)
  })

  test('setter emits emitValue', () => {
    const instance = makeSliderInstance(null)
    instance.val = 7
    expect(instance._emitted).toEqual([{ event: 'emitValue', value: 7 }])
  })

  test('max/min computed from ITEM.options', () => {
    const instance = makeSliderInstance(null)
    expect(instance.max).toBe(10)
    expect(instance.min).toBe(0)
  })

  test('meinWert shows placeholder when null', () => {
    expect(makeSliderInstance(null).meinWert).toBe('bitte einen Wert auswählen')
  })

  test('meinWert shows value when set', () => {
    expect(makeSliderInstance(5).meinWert).toBe('Mein Wert: 5')
  })
})

// ─── RenderQuest_text ───

describe('RenderQuest_text computed val', () => {
  test('getter reads ITEM.value', () => {
    const instance = createMockInstance(textDef, {
      ITEM: { value: 'hello', type: 'text', hint: '' }
    })
    expect(instance.val).toBe('hello')
  })

  test('setter emits number for number type', () => {
    const instance = createMockInstance(textDef, {
      ITEM: { value: null, type: 'number', hint: '' }
    })
    instance.val = '42'
    expect(instance._emitted[0].value).toBe(42)
  })

  test('setter emits null not NaN for empty number input', () => {
    const instance = createMockInstance(textDef, {
      ITEM: { value: null, type: 'number', hint: '' }
    })
    instance.val = ''
    expect(instance._emitted[0].value).toBeNull()
  })

  test('setter passes string through for text type', () => {
    const instance = createMockInstance(textDef, {
      ITEM: { value: null, type: 'text', hint: '' }
    })
    instance.val = 'some text'
    expect(instance._emitted[0].value).toBe('some text')
  })
})

// ─── RenderQuest_multipleradio ───

describe('RenderQuest_multipleradio', () => {
  function makeMultiRadioInstance(itemOverrides = {}) {
    const ITEM = {
      value: null,
      options: {
        questions: [
          { tag: 'q1', label: 'Question 1' },
          { tag: 'q2', label: 'Question 2' },
          { tag: 'q3', label: 'Question 3' }
        ],
        answers: [
          { label: 'Yes', value: 1 },
          { label: 'No', value: 0 }
        ]
      },
      verylonganswers: false,
      longanswers: false,
      rotate: false,
      ...itemOverrides
    }
    return createMockInstance(multipleRadioDef, { ITEM })
  }

  test('getter returns ITEM.value when populated', () => {
    expect(makeMultiRadioInstance({ value: [1, 0, 1] }).val).toEqual([1, 0, 1])
  })

  test('getter returns null-filled array when ITEM.value is empty', () => {
    expect(makeMultiRadioInstance({ value: [] }).val).toEqual([null, null, null])
  })

  test('getter returns null-filled array when ITEM.value is null', () => {
    expect(makeMultiRadioInstance({ value: null }).val).toEqual([null, null, null])
  })

  test('getter returns example_value when present', () => {
    expect(makeMultiRadioInstance({ example_value: [1, 1, 0] }).val).toEqual([1, 1, 0])
  })

  test('onRadioChange clones array and updates correct index', () => {
    const instance = makeMultiRadioInstance({ value: [null, null, null] })
    instance.onRadioChange(1, 'yes')
    expect(instance._emitted[0].value).toEqual([null, 'yes', null])
  })

  test('onRadioChange does not mutate original array', () => {
    const original = [1, 0, null]
    const instance = makeMultiRadioInstance({ value: original })
    instance.onRadioChange(2, 1)
    expect(original).toEqual([1, 0, null])
    expect(instance._emitted[0].value).toEqual([1, 0, 1])
  })

  test('short_answers returns label-stripped answer objects', () => {
    expect(makeMultiRadioInstance().short_answers).toEqual([
      { label: '', value: 1 },
      { label: '', value: 0 }
    ])
  })

  test('answers_only returns answer labels', () => {
    expect(makeMultiRadioInstance().answers_only).toEqual(['Yes', 'No'])
  })
})
