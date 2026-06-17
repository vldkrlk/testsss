<script setup>
import { ref, computed } from 'vue'

const STORAGE_KEY = 'uploaded-test-suites'

const readStoredSuites = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(data)) return []
    return data.filter(
      (suite) =>
        suite &&
        typeof suite.id === 'string' &&
        typeof suite.title === 'string' &&
        Array.isArray(suite.questions),
    )
  } catch {
    return []
  }
}

const savedSuites = ref(readStoredSuites())
const selectedSuiteId = ref(savedSuites.value[0]?.id ?? '')
const tests = ref([])
const error = ref('')

const saveSuites = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSuites.value))
}

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
  const correctIndexes = Array.isArray(item.correctIndexes)
    ? item.correctIndexes
    : Array.isArray(item.correctIndices)
      ? item.correctIndices
      : undefined
  const correctValue = item.correctAnswer ?? item.answer ?? item.correct
  const correctValues = Array.isArray(item.correctAnswers)
    ? item.correctAnswers
    : Array.isArray(item.answersCorrect)
      ? item.answersCorrect
      : undefined

  if (answers.length > 0) {
    if (Array.isArray(correctIndexes)) {
      const correctIndexSet = new Set(correctIndexes.filter((idx) => typeof idx === 'number'))
      answers.forEach((answer, idx) => {
        answer.isCorrect = correctIndexSet.has(idx)
      })
    } else if (typeof correctIndex === 'number' && answers[correctIndex]) {
      answers.forEach((answer, idx) => {
        answer.isCorrect = idx === correctIndex
      })
    } else if (Array.isArray(correctValues)) {
      const normalizedCorrectValues = new Set(
        correctValues.map((value) => String(value).trim().toLowerCase()),
      )
      answers.forEach((answer) => {
        answer.isCorrect = normalizedCorrectValues.has(String(answer.text).trim().toLowerCase())
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
    isMultiple: answers.filter((answer) => answer.isCorrect).length > 1,
    selected: [],
    status: null,
  }
}

const selectedSuite = computed(() =>
  savedSuites.value.find((suite) => suite.id === selectedSuiteId.value),
)

const getQuestionsFromJson = (data) => {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.questions)) return data.questions
    if (Array.isArray(data.tests)) return data.tests
    if (Array.isArray(data.items)) return data.items
  }
  throw new Error('JSON має містити масив питань або поле questions/tests/items.')
}

const loadTests = (items = selectedSuite.value?.questions) => {
  error.value = ''
  try {
    if (!selectedSuite.value && typeof items === 'undefined') {
      tests.value = []
      return
    }
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

const createSuiteId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `uploaded-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const uploadJson = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  error.value = ''
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const questions = getQuestionsFromJson(data)
    const title =
      data && !Array.isArray(data) && typeof data.title === 'string'
        ? data.title
        : file.name.replace(/\.json$/i, '')

    const suite = {
      id: createSuiteId(),
      title: `Завантажено: ${title}`,
      questions,
    }
    savedSuites.value = [...savedSuites.value, suite]
    saveSuites()
    selectedSuiteId.value = suite.id
    loadTests(questions)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    tests.value = []
  } finally {
    event.target.value = ''
  }
}

const deleteSelectedSuite = () => {
  if (!selectedSuite.value) return
  savedSuites.value = savedSuites.value.filter((suite) => suite.id !== selectedSuiteId.value)
  saveSuites()
  selectedSuiteId.value = savedSuites.value[0]?.id ?? ''
  loadTests()
}

const isAnswerSelected = (test, idx) => test.selected.includes(idx)

const selectedMatchesCorrectAnswers = (test) => {
  const selectedSet = new Set(test.selected)
  return (
    test.answers.every((answer, idx) => answer.isCorrect === selectedSet.has(idx)) &&
    selectedSet.size > 0
  )
}

const checkAnswer = (test) => {
  if (test.status !== null || test.selected.length === 0) return
  test.status = selectedMatchesCorrectAnswers(test) ? 'correct' : 'wrong'
}

const selectAnswer = (test, idx) => {
  if (test.status !== null) return
  const answer = test.answers[idx]
  if (!answer) return

  if (test.isMultiple) {
    test.selected = isAnswerSelected(test, idx)
      ? test.selected.filter((selectedIdx) => selectedIdx !== idx)
      : [...test.selected, idx]
    return
  }

  test.selected = [idx]
  test.status = answer.isCorrect ? 'correct' : 'wrong'
}

const loaded = computed(() => tests.value.length > 0)
const hasSavedSuites = computed(() => savedSuites.value.length > 0)
const resultSummary = computed(() => {
  const total = tests.value.length
  const answered = tests.value.filter((test) => test.status !== null).length
  const correct = tests.value.filter((test) => test.status === 'correct').length
  const wrong = tests.value.filter((test) => test.status === 'wrong').length
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0

  return {
    total,
    answered,
    correct,
    wrong,
    percent,
    isComplete: total > 0 && answered === total,
  }
})

loadTests()
</script>

<template>
  <main class="app-shell">
    <section class="card">
      <h1>Тестовий програвач</h1>

      <div class="suite-row">
        <label class="select-label" for="test-suite">Оберіть тест</label>
        <select
          id="test-suite"
          v-model="selectedSuiteId"
          :disabled="!hasSavedSuites"
          @change="loadTests()"
        >
          <option value="" disabled>Завантажте JSON</option>
          <option v-for="suite in savedSuites" :key="suite.id" :value="suite.id">
            {{ suite.title }} ({{ suite.questions.length }})
          </option>
        </select>
        <div class="suite-actions">
          <button type="button" class="load-button" :disabled="!selectedSuite" @click="loadTests()">
            Почати знову
          </button>
          <button
            type="button"
            class="delete-button"
            :disabled="!selectedSuite"
            @click="deleteSelectedSuite"
          >
            Видалити
          </button>
          <label class="upload-button">
            Завантажити JSON
            <input type="file" accept="application/json,.json" @change="uploadJson" />
          </label>
        </div>
      </div>

      <p v-if="!hasSavedSuites && !error" class="empty-state">
        Завантажте JSON-файл, щоб додати перший тест у список.
      </p>

      <details class="json-example">
        <summary>Приклад формату JSON</summary>
        <pre><code>{
  "title": "Мій тест",
  "questions": [
    {
      "question": "Скільки буде 2 + 2?",
      "answers": ["3", "4", "5"],
      "correctIndex": 1
    },
    {
      "question": "Оберіть парні числа",
      "answers": ["1", "2", "3", "4"],
      "correctIndexes": [1, 3]
    },
    {
      "question": "Які твердження правильні?",
      "answers": [
        { "text": "Vue є JavaScript-фреймворком", "correct": true },
        { "text": "JSON дозволяє коментарі", "correct": false },
        { "text": "localStorage зберігає рядки", "correct": true }
      ]
    }
  ]
}</code></pre>
      </details>

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
                isAnswerSelected(test, index) ? 'selected' : '',
                test.status !== null && isAnswerSelected(test, index) && !answer.isCorrect
                  ? 'wrong'
                  : '',
                test.status !== null && answer.isCorrect ? 'correct' : '',
              ]"
              :disabled="test.status !== null"
              @click="selectAnswer(test, index)"
            >
              {{ answer.text }}
            </button>
          </div>
          <button
            v-if="test.isMultiple"
            type="button"
            class="check-button"
            :disabled="test.status !== null || test.selected.length === 0"
            @click="checkAnswer(test)"
          >
            Перевірити
          </button>
          <p v-if="test.status !== null" class="result">
            <span v-if="test.status === 'correct'" class="result-correct">Правильно!</span>
            <span v-else class="result-wrong">Неправильно — правильна відповідь підсвічена.</span>
          </p>
        </li>
      </ol>

      <div class="summary">
        <div>
          <h3>Результат</h3>
          <p>
            <span v-if="resultSummary.isComplete">Тест завершено.</span>
            <span v-else>Пройдено {{ resultSummary.answered }} з {{ resultSummary.total }}.</span>
          </p>
        </div>
        <div class="summary-stats">
          <div class="summary-stat">
            <span>Правильно</span>
            <strong>{{ resultSummary.correct }}</strong>
          </div>
          <div class="summary-stat">
            <span>Помилки</span>
            <strong>{{ resultSummary.wrong }}</strong>
          </div>
          <div class="summary-stat">
            <span>Відсоток</span>
            <strong>{{ resultSummary.percent }}%</strong>
          </div>
        </div>
      </div>
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
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}
.suite-actions {
  grid-column: 2;
  display: flex;
  flex-wrap: wrap;
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
.load-button,
.upload-button,
.delete-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  box-sizing: border-box;
  padding: 12px 18px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
  white-space: nowrap;
}
.load-button:hover,
.upload-button:hover {
  background: #1d4ed8;
}
.delete-button {
  background: #f3f4f6;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.delete-button:hover {
  background: #fee2e2;
}
.load-button:disabled,
.delete-button:disabled,
select:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.upload-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.json-example {
  margin-top: 14px;
  color: #374151;
}
.json-example summary {
  width: fit-content;
  cursor: pointer;
  font-weight: 600;
}
.json-example pre {
  margin: 10px 0 0;
  padding: 12px;
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #111827;
  font-size: 13px;
  line-height: 1.45;
}
.error {
  margin-top: 12px;
  color: #dc2626;
}
.empty-state {
  margin: 12px 0 0;
  color: #6b7280;
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
.answer-button.selected {
  background: #dbeafe;
  border-color: #2563eb;
}
.answer-button.correct {
  background: #d1fae5;
  border-color: #10b981;
}
.answer-button.wrong {
  background: #fee2e2;
  border-color: #ef4444;
}
.check-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  margin-top: 10px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.check-button:hover {
  background: #1d4ed8;
}
.check-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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
.summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid #e5e7eb;
}
.summary h3 {
  margin: 0 0 6px;
  font-size: 20px;
  line-height: 1.2;
}
.summary p {
  margin: 0;
  color: #4b5563;
}
.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(82px, 1fr));
  gap: 10px;
}
.summary-stat {
  min-width: 82px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}
.summary-stat span {
  display: block;
  margin-bottom: 4px;
  color: #6b7280;
  font-size: 13px;
}
.summary-stat strong {
  display: block;
  font-size: 22px;
  line-height: 1.1;
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
  .suite-actions {
    grid-column: auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .load-button,
  .upload-button,
  .delete-button {
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
  .summary {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .summary-stats {
    grid-template-columns: 1fr;
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
