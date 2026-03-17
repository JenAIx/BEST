import { log } from '../Logger'

// CALC RESULTS
export function calc_results(data, methods) {
  if (methods.method === undefined) return {}
  switch (methods.method) {
    case 'sum':
      return calc_simple_sum(data.items, methods)

    case 'avg':
      return calc_simple_avg(data.items, methods)

    case 'count':
      return calc_count(data.items, methods)

    case 'count_targets':
      return calc_count_targets(data.items, methods)

    case 'ids':
      return calc_ids(data.items, methods)

    default:
      log({ warn: `calc_results: method ${methods.method} not supported` })
      break
  }

  return {}
}

// CALC SUMS
export function calc_simple_sum(items, methods) {
  var sum = 0
  items.forEach(item => {
    if (typeof item.value === 'number' && item.ignore_for_result !== true) {
      sum += item.value
    }
    else if (Array.isArray(item.value) && item.ignore_for_result !== true) {
      item.value.forEach(val => {
        if (typeof val === 'number') sum += val
      })
    }
  })
  const RESULT = { 'label': 'sum', 'value': sum }
  if (methods.coding) RESULT.coding = methods.coding
  return [RESULT]
}

// CALC AVG
export function calc_simple_avg(items, methods) {
  var sum = 0
  var count = 0
  items.forEach(item => {
    if (typeof item.value === 'number' && item.ignore_for_result !== true) {
      sum += item.value
      count++
    }
  })
  const value = count === 0 ? 0 : Math.round(100 * sum / count) / 100
  const RESULT = { 'label': 'avg', 'value': value }
  if (methods.coding) RESULT.coding = methods.coding
  return [RESULT]
}

// CALC COUNT
export function calc_count(items) {
  const answers = [];
  items.forEach(item => {
    answers.push(item.value)
  })

  const unique_answers = [...new Set(answers)]
  const count = {}
  unique_answers.forEach(answ => {
    count[answ] = {
      count: 0,
      label: answ,
    }
  })

  var total = 0
  items.forEach(item => {
    count[item.value].count++
    total++
  })

  const results = []
  Object.keys(count).forEach(key => {
    results.push({
      label: count[key].label,
      value: count[key].count,
      total: total
    })
  })

  return results
}

// SCORING HELPERS (extracted from calc_ids for testability)

export function getScore(scoring, val) {
  var score = 0
  scoring.forEach(s => {
    if (s.id.includes(val.id)) {
      if (s.method !== undefined && s.method === 'count') score = Array.isArray(val.value) ? val.value.length : 0
      else if (s.method !== undefined && s.method === 'raw') score = val.value
      else if (s.method !== undefined && s.method === 'multiply') score = val.value * s.value
      else if (s.method !== undefined && s.method === 'range') score = calc_range(val.value, s.range)
      else if (Array.isArray(val.value) && Array.isArray(s.value)) {
        val.value.forEach(v => {
          let pos = s.value.indexOf(v)
          if (pos !== -1) score += s.score[pos];
        })
      }
      else if (Array.isArray(s.value)) {
        let pos = s.value.indexOf(val.value)
        if (pos !== -1) score += s.score[pos];
      }
    }
  })
  return score
}

export function calc_range(val, range) {
  var out = undefined
  if (val === undefined || range === undefined) return undefined
  range.forEach(r => {
    if (r.value[0] <= val && r.value[1] >= val) out = r.score
  })
  return out
}

export function getDomaineScore(VALUES, sub, RESULTS) {
  var score = 0
  var count_zeros = 0
  sub.id.forEach(id => {
    if (typeof id === 'number') {
      let el = VALUES.find(v => v.id === id)
      if (el !== undefined && (sub.method === 'sum' || sub.method === 'sum_range' || sub.method === 'avg' || sub.method === 'avg_multiply' || sub.method === 'sum_multiply' || sub.method === 'sum_sub_multiply')) {
        score += el.score
        count_zeros += (el.score === 0)
      }
      else if (el !== undefined && sub.method === 'multiply') {
        if (score === 0) score = el.score
        else score = score * el.score
      } else if (el !== undefined && sub.method === 'diff_range') {
        if (score === 0) score = el.score
        else score = substract(score, el.score)
      }
    } else if (typeof id === 'string') {
      let el = RESULTS.find(v => v.label === id)
      if (el !== undefined && (sub.method === 'sum' || sub.method === 'sum_range' || sub.method === 'avg' || sub.method === 'sum_multiply' || sub.method === 'sum_sub_multiply')) score += el.value;
      else if (el !== undefined && sub.method === 'multiply') {
        if (score === 0) score = el.value
        else score = score * el.value
      }
    }
  })

  if (sub.method === 'sum_multiply') {
    if (sub.value) score = score * sub.value
  }
  if (sub.method === 'avg' || sub.method === 'avg_multiply') {
    if (sub.ignore_zeros === true) {
      const divisor = sub.id.length - count_zeros
      score = divisor > 0 ? score / divisor : 0
    }
    else score = sub.id.length > 0 ? score / sub.id.length : 0
    if (sub.method === 'avg_multiply') score = score * sub.value
  }
  if (sub.method === 'sum_range' || sub.method === 'diff_range') score = calc_range(score, sub.sum_range)
  if (sub.method === 'sum_sub_multiply') score = (score - sub.value[0]) * sub.value[1]

  return score
}

export function substract(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return `${a}-${b}`
}

// CALC_IDS
function calc_ids(items, method) {
  const results = []
  const VALUES = []
  items.forEach(item => {
    VALUES.push({ id: item.id, value: item.value })
  })

  VALUES.forEach(val => {
    val.score = getScore(method.scoring, val)
  })

  method.domaine.forEach(sub => {
    let val = {
      label: sub.label,
      value: 0
    }
    val.value = Math.round(getDomaineScore(VALUES, sub, results) * 100) / 100
    if (sub.coding) val.coding = sub.coding
    results.push(val)
  })

  return results
}

// COUNT TARGETS
export function calc_count_targets(items, method) {
  const result = []
  method.targets.forEach(target => {
    let res = {
      label: target.label,
      value: 0,
      total: 0
    }
    items.forEach(item => {
      if (item.value === target.value) {
        res.value += target.score
        res.total += target.score
      }
    })

    result.push(res)
  })

  return result
}

export function evaluate(res, ev) {
  res.forEach(r => {
    if (r.label === 'sum') {
      let tmp = undefined
      ev.forEach(e => {
        if (e.range[0] <= r.value && e.range[1] >= r.value) tmp = e.label
      })

      if (tmp !== undefined) r.evaluation = tmp
    }
  })

  return res
}
