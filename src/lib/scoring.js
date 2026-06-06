/**
 * Client-side scoring for psychology tests.
 * answers: Record<questionId, optionId>
 * Returns { scoreData, summary }
 */

export function scoreAnswers(questions, scoringRules, answers) {
  if (scoringRules.type === 'big_five') return scoreBigFive(questions, scoringRules, answers)
  if (scoringRules.type === 'category_count') return scoreCategoryCount(questions, scoringRules, answers)
  return scoreSimple(questions, scoringRules, answers)
}

function scoreSimple(questions, rules, answers) {
  let total = 0
  for (const q of questions) {
    const optionId = answers[q.id]
    if (!optionId) continue
    const opt = q.options.find((o) => o.id === optionId)
    if (opt) total += opt.value
  }
  const bucket = (rules.ranges ?? []).find((r) => total >= r.min && total <= r.max)
  return { scoreData: { value: total }, summary: bucket?.result ?? null }
}

function scoreBigFive(questions, rules, answers) {
  const questionMap = new Map(questions.map((q) => [q.id, q]))
  const traitScores = {}

  for (const [traitKey, traitDef] of Object.entries(rules.traits)) {
    let score = traitDef.base
    for (const item of traitDef.items) {
      const q = questionMap.get(item.id)
      if (!q) continue
      const optionId = answers[item.id]
      if (!optionId) continue
      const opt = q.options.find((o) => o.id === optionId)
      if (!opt) continue
      if (item.operation === 'add') score += opt.value
      else score -= opt.value
    }
    traitScores[traitKey] = score
  }

  const summaryParts = []
  for (const traitKey of Object.keys(rules.traits)) {
    const s = traitScores[traitKey] ?? 0
    const key = s >= 20 ? `high${traitKey}` : `low${traitKey}`
    const text = rules.resultSummaryTemplate?.[key]
    if (text) summaryParts.push(text)
  }

  return {
    scoreData: traitScores,
    summary: summaryParts.length > 0 ? summaryParts.join(' ') : null,
  }
}

function scoreCategoryCount(questions, rules, answers) {
  const counts = {}
  for (const key of rules.categoryOrder) counts[key] = 0

  const questionMap = new Map(questions.map((q) => [q.id, q]))
  for (const [qid, optionId] of Object.entries(answers)) {
    const q = questionMap.get(qid)
    if (!q) continue
    const opt = q.options.find((o) => o.id === optionId)
    if (!opt) continue
    const category = rules.optionValueToCategory?.[String(opt.value)]
    if (!category) continue
    counts[category] = (counts[category] ?? 0) + 1
  }

  let winner = null
  let max = -1
  for (const key of rules.categoryOrder) {
    if ((counts[key] ?? 0) > max) {
      max = counts[key] ?? 0
      winner = key
    }
  }

  const winnerInfo = winner ? rules.categories?.[winner] : null
  const summary = winnerInfo ? `${winnerInfo.title} — ${winnerInfo.subtitle}` : null
  return { scoreData: counts, summary }
}
