import { describe, it, expect } from 'vitest'
import { scoreAnswers } from './scoring.js'

// ── Simple sum scoring ──────────────────────────────────────────────────────
describe('scoreAnswers — simple (default)', () => {
  const questions = [
    { id: 'q1', options: [{ id: 'a', value: 1 }, { id: 'b', value: 3 }] },
    { id: 'q2', options: [{ id: 'a', value: 2 }, { id: 'b', value: 5 }] },
  ]
  const rules = {
    ranges: [
      { min: 0, max: 4, result: 'low' },
      { min: 5, max: 10, result: 'high' },
    ],
  }

  it('sums selected option values and picks matching bucket', () => {
    const r = scoreAnswers(questions, rules, { q1: 'b', q2: 'b' }) // 3 + 5 = 8
    expect(r.scoreData).toEqual({ value: 8 })
    expect(r.summary).toBe('high')
  })

  it('ignores unanswered questions', () => {
    const r = scoreAnswers(questions, rules, { q1: 'a' }) // 1
    expect(r.scoreData.value).toBe(1)
    expect(r.summary).toBe('low')
  })

  it('returns null summary when total falls outside all ranges', () => {
    const r = scoreAnswers(questions, { ranges: [{ min: 100, max: 200, result: 'x' }] }, { q1: 'a' })
    expect(r.summary).toBeNull()
  })

  it('handles missing ranges gracefully', () => {
    const r = scoreAnswers(questions, {}, { q1: 'b' })
    expect(r.scoreData.value).toBe(3)
    expect(r.summary).toBeNull()
  })

  it('ignores an answer pointing at a non-existent option', () => {
    const r = scoreAnswers(questions, rules, { q1: 'zzz' })
    expect(r.scoreData.value).toBe(0)
  })
})

// ── Big Five scoring ────────────────────────────────────────────────────────
describe('scoreAnswers — big_five', () => {
  const questions = [
    { id: 'q1', options: [{ id: 'a', value: 5 }, { id: 'b', value: 1 }] },
    { id: 'q2', options: [{ id: 'a', value: 4 }, { id: 'b', value: 2 }] },
  ]
  const rules = {
    type: 'big_five',
    traits: {
      O: {
        base: 18,
        items: [
          { id: 'q1', operation: 'add' },
          { id: 'q2', operation: 'subtract' },
        ],
      },
    },
    resultSummaryTemplate: { highO: 'Open minded.', lowO: 'Conventional.' },
  }

  it('applies base + add/subtract operations per trait', () => {
    const r = scoreAnswers(questions, rules, { q1: 'a', q2: 'b' }) // 18 + 5 - 2 = 21
    expect(r.scoreData).toEqual({ O: 21 })
    expect(r.summary).toBe('Open minded.') // >= 20 -> high
  })

  it('picks the low template when score under 20', () => {
    const r = scoreAnswers(questions, rules, { q1: 'b', q2: 'a' }) // 18 + 1 - 4 = 15
    expect(r.scoreData.O).toBe(15)
    expect(r.summary).toBe('Conventional.')
  })

  it('skips items with no answer (keeps base contribution)', () => {
    const r = scoreAnswers(questions, rules, {}) // base only = 18
    expect(r.scoreData.O).toBe(18)
  })
})

// ── Category count scoring ──────────────────────────────────────────────────
describe('scoreAnswers — category_count', () => {
  const questions = [
    { id: 'q1', options: [{ id: 'a', value: 0 }, { id: 'b', value: 1 }] },
    { id: 'q2', options: [{ id: 'a', value: 0 }, { id: 'b', value: 1 }] },
    { id: 'q3', options: [{ id: 'a', value: 0 }, { id: 'b', value: 1 }] },
  ]
  const rules = {
    type: 'category_count',
    categoryOrder: ['cat0', 'cat1'],
    optionValueToCategory: { 0: 'cat0', 1: 'cat1' },
    categories: {
      cat0: { title: 'Zero', subtitle: 'all zeros' },
      cat1: { title: 'One', subtitle: 'all ones' },
    },
  }

  it('counts categories and reports the winner', () => {
    const r = scoreAnswers(questions, rules, { q1: 'b', q2: 'b', q3: 'a' }) // cat1=2, cat0=1
    expect(r.scoreData).toEqual({ cat0: 1, cat1: 2 })
    expect(r.summary).toBe('One — all ones')
  })

  it('breaks ties by categoryOrder (first wins)', () => {
    const r = scoreAnswers(questions, rules, { q1: 'a', q2: 'b' }) // cat0=1, cat1=1
    expect(r.summary).toBe('Zero — all zeros')
  })

  it('initializes all categories to zero even when unanswered', () => {
    const r = scoreAnswers(questions, rules, {})
    expect(r.scoreData).toEqual({ cat0: 0, cat1: 0 })
  })
})
