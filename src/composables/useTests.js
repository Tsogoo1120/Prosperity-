import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { scoreAnswers } from '@/lib/scoring.js'

const tests = ref([])
const myResults = ref({}) // testId → latest TestResult
const loading = ref(false)
const error = ref(null)

export function useTests() {
  async function fetchTests() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('psychology_tests')
        .select('id, slug, title, description, cover_image_path, questions, scoring_rules, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
      if (err) throw err
      tests.value = data ?? []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchMyResults() {
    const { data } = await supabase
      .from('test_results')
      .select('id, test_id, result_summary, score, created_at')
      .order('created_at', { ascending: false })
    if (!data) return
    // keep only the latest result per test
    const map = {}
    for (const r of data) {
      if (!map[r.test_id]) map[r.test_id] = r
    }
    myResults.value = map
  }

  async function submitTest(testId, questions, scoringRules, answers) {
    const { scoreData, summary } = scoreAnswers(questions, scoringRules, answers)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error: err } = await supabase
      .from('test_results')
      .insert({
        user_id: user.id,
        test_id: testId,
        answers,
        result_summary: summary,
        score: scoreData,
      })
      .select('id')
      .single()

    if (err) return { error: err.message }

    // update local cache
    myResults.value = {
      ...myResults.value,
      [testId]: { id: data.id, test_id: testId, result_summary: summary, score: scoreData, created_at: new Date().toISOString() },
    }

    return { resultId: data.id, scoreData, summary }
  }

  return { tests, myResults, loading, error, fetchTests, fetchMyResults, submitTest }
}
