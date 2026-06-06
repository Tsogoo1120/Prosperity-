<script setup>
import { ref, onMounted } from 'vue'
import { useTests } from '@/composables/useTests.js'
import AssessmentList from './AssessmentList.vue'
import TestRunner from './TestRunner.vue'
import TestResults from './TestResults.vue'

const { tests, myResults, loading, error, fetchTests, fetchMyResults, submitTest } = useTests()

const mode = ref('list')   // 'list' | 'test' | 'results'
const activeTest = ref(null)
const lastResult = ref(null)

onMounted(async () => {
  await Promise.all([fetchTests(), fetchMyResults()])
})

function start(test) {
  activeTest.value = test
  lastResult.value = null
  mode.value = 'test'
}

async function finish(answers) {
  const test = activeTest.value
  const result = await submitTest(test.id, test.questions, test.scoring_rules, answers)
  if (result.error) {
    alert(result.error)
    return
  }
  lastResult.value = result
  mode.value = 'results'
}

function viewResult(test) {
  const stored = myResults.value[test.id]
  if (!stored) return
  activeTest.value = test
  lastResult.value = { scoreData: stored.score, summary: stored.result_summary }
  mode.value = 'results'
}
</script>

<template>
  <TestRunner
    v-if="mode === 'test'"
    :test="activeTest"
    @exit="mode = 'list'"
    @finish="finish"
  />
  <TestResults
    v-else-if="mode === 'results'"
    :test="activeTest"
    :result="lastResult"
    @retake="mode = 'test'"
    @exit="mode = 'list'"
  />
  <AssessmentList
    v-else
    :tests="tests"
    :myResults="myResults"
    :loading="loading"
    :error="error"
    @start="start"
    @viewResult="viewResult"
  />
</template>
