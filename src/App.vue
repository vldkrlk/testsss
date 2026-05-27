<script setup>
import { ref, computed } from 'vue'
import { testSuites } from './testSuites'

const selectedSuiteId = ref(testSuites[0]?.id ?? '')
const tests = ref([])
const error = ref('')

const normalizeTest = (item, index) => {
  const text = item.question || item.title || item.text || item.q || `Питання ${index + 1}`

  const answers = []
  const pushAnswers = (array) => {
    if (!Array.isArray(array)) return
    array.forEach((answer) => {
      if (typeof answer === 'string' || typeof answer === 'number') {
        answers.push({ text: String(answer), isCorrect: false })
      } else if (answer && typeof answer === 'object') {
        const answerText = answer.text || answer.label || answer.value || JSON.stringify(answer)
        const isCorrect =
          answer.correct === true || answer.isCorrect === true || answer.isAnswer === true
        answers.push({ text: String(answerText), isCorrect })
      }
    })
  }

  if (Array.isArray(item.answers)) pushAnswers(item.answers)
  if (Array.isArray(item.options)) pushAnswers(item.options)
  if (Array.isArray(item.choices)) pushAnswers(item.choices)
  if (Array.isArray(item.variants)) pushAnswers(item.variants)
  if (Array.isArray(item.a)) pushAnswers(item.a)

  const correctIndex = typeof item.correctIndex === 'number' ? item.correctIndex : undefined
  const correctValue = item.correctAnswer ?? item.answer ?? item.correct

  if (answers.length > 0) {
    if (typeof correctIndex === 'number' && answers[correctIndex]) {
      answers.forEach((answer, idx) => {
        answer.isCorrect = idx === correctIndex
      })
    } else if (typeof correctValue !== 'undefined') {
      const normalizedCorrect = String(correctValue).trim().toLowerCase()
      answers.forEach((answer) => {
        answer.isCorrect = String(answer.text).trim().toLowerCase() === normalizedCorrect
      })
    }
  }

  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = answers[i]
    answers[i] = answers[j]
    answers[j] = tmp
  }

  return {
    id: index,
    text,
    answers,
    selected: null,
    status: null,
  }
}

const selectedSuite = computed(() => testSuites.find((suite) => suite.id === selectedSuiteId.value))

const loadTests = (items = selectedSuite.value?.questions) => {
  error.value = ''
  try {
    if (!Array.isArray(items)) {
      throw new Error('Набір тестів має бути масивом запитань.')
    }
    tests.value = items
      .map((item, index) => normalizeTest(item, index))
      .filter((item) => item.answers.length > 0)
    if (tests.value.length === 0) {
      error.value = 'У тестах не знайдено варіантів відповіді.'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    tests.value = []
  }
}

const selectAnswer = (test, idx) => {
  if (test.selected !== null) return
  test.selected = idx
  const answer = test.answers[idx]
  if (!answer) return
  test.status = answer.isCorrect ? 'correct' : 'wrong'
}

const loaded = computed(() => tests.value.length > 0)

loadTests()
</script>

<template>
  <main class="app-shell">
    <section class="card">
      <h1>Тестовий програвач</h1>

      <div class="suite-row">
        <label class="select-label" for="test-suite">Оберіть тест</label>
        <select id="test-suite" v-model="selectedSuiteId" @change="loadTests()">
          <option v-for="suite in testSuites" :key="suite.id" :value="suite.id">
            {{ suite.title }} ({{ suite.questions.length }})
          </option>
        </select>
        <button type="button" class="load-button" @click="loadTests()">Почати знову</button>
      </div>

      <p v-if="error" class="error">Помилка: {{ error }}</p>
    </section>

    <section class="card" v-if="loaded">
      <h2>{{ selectedSuite?.title }}</h2>
      <ol class="test-list">
        <li v-for="test in tests" :key="test.id" class="test-item">
          <div class="question">
            <strong>{{ test.text }}</strong>
          </div>
          <div class="answers">
            <button
              v-for="(answer, index) in test.answers"
              :key="index"
              :class="[
                'answer-button',
                test.selected === index ? (test.status === 'correct' ? 'correct' : 'wrong') : '',
                test.selected !== null && answer.isCorrect ? 'correct' : '',
              ]"
              :disabled="test.selected !== null"
              @click="selectAnswer(test, index)"
            >
              {{ answer.text }}
            </button>
          </div>
          <p v-if="test.selected !== null" class="result">
            <span v-if="test.status === 'correct'" class="result-correct">Правильно!</span>
            <span v-else class="result-wrong">Неправильно — правильна відповідь підсвічена.</span>
          </p>
        </li>
      </ol>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  width: min(100%, 760px);
  box-sizing: border-box;
  max-width: 760px;
  margin: 32px auto;
  padding: 0 16px;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  color: #111827;
}
.card {
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  margin-bottom: 24px;
}
.card h1,
.card h2 {
  margin-top: 0;
  line-height: 1.2;
}
.card h1 {
  font-size: 32px;
}
.card h2 {
  font-size: 24px;
}
.select-label {
  display: block;
  font-weight: 600;
  white-space: nowrap;
}
.suite-row {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr) auto;
  align-items: center;
  gap: 12px;
}
select {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  font: inherit;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f8fafc;
  color: #111827;
}
.load-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 12px 18px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}
.load-button:hover {
  background: #1d4ed8;
}
.error {
  margin-top: 12px;
  color: #dc2626;
}
.test-list {
  list-style: decimal inside;
  padding: 0;
  margin: 0;
}
.test-item {
  margin-bottom: 22px;
  overflow-wrap: anywhere;
}
.question {
  margin-bottom: 12px;
  line-height: 1.45;
}
.answers {
  display: grid;
  gap: 10px;
}
.answer-button {
  width: 100%;
  min-height: 48px;
  box-sizing: border-box;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f8fafc;
  color: #111827;
  cursor: pointer;
  font: inherit;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.answer-button:hover {
  background: #e2e8f0;
}
.answer-button.correct {
  background: #d1fae5;
  border-color: #10b981;
}
.answer-button.wrong {
  background: #fee2e2;
  border-color: #ef4444;
}
.result {
  margin-top: 10px;
}
.result-correct {
  color: #047857;
  font-weight: 600;
}
.result-wrong {
  color: #b91c1c;
  font-weight: 600;
}
@media (max-width: 640px) {
  .app-shell {
    margin: 12px auto;
    padding: 0 10px;
  }
  .card {
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: none;
  }
  .card h1 {
    font-size: 24px;
  }
  .card h2 {
    font-size: 20px;
  }
  .suite-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .load-button {
    width: 100%;
  }
  .test-list {
    list-style-position: outside;
    padding-left: 22px;
  }
  .test-item {
    margin-bottom: 18px;
  }
  .answer-button {
    padding: 12px;
  }
}
@media (max-width: 380px) {
  .app-shell {
    padding: 0 8px;
  }
  .card {
    padding: 12px;
  }
  .card h1 {
    font-size: 22px;
  }
  .card h2 {
    font-size: 18px;
  }
}
</style>
