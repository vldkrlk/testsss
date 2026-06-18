<script setup>
import { ref, computed, watchEffect } from 'vue'

const STORAGE_KEY = 'uploaded-test-suites'
const ACCESSIBILITY_KEY = 'colorblind-mode'
const SHUFFLE_QUESTIONS_KEY = 'shuffle-questions'
const DISPLAY_MODE_KEY = 'display-mode'
const FAVORITE_QUESTIONS_KEY = 'favorite-questions'
const FAVORITE_QUESTIONS_SUITE_ID = '__favorite_questions__'
const JSON_FORMAT_EXAMPLE = `{
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
}`

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

const readFavoriteQuestionKeys = () => {
  try {
    const data = JSON.parse(localStorage.getItem(FAVORITE_QUESTIONS_KEY) || '[]')
    return Array.isArray(data) ? data.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

const savedSuites = ref(readStoredSuites())
const selectedSuiteId = ref(savedSuites.value[0]?.id ?? '')
const favoriteQuestionKeys = ref(readFavoriteQuestionKeys())
const tests = ref([])
const error = ref('')
const colorblindMode = ref(localStorage.getItem(ACCESSIBILITY_KEY) === 'true')
const shuffleQuestions = ref(localStorage.getItem(SHUFFLE_QUESTIONS_KEY) === 'true')
const displayMode = ref(localStorage.getItem(DISPLAY_MODE_KEY) === 'cards' ? 'cards' : 'list')
const currentCardIndex = ref(0)
const mistakeReviewMode = ref(false)
const mistakeReviewBaseTitle = ref('')
const mainSessionSnapshot = ref(null)
const celebrationPieces = ref([])
let celebrationTimeoutId = null
let celebrationRunId = 0

const saveSuites = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSuites.value))
}

const saveFavoriteQuestionKeys = () => {
  localStorage.setItem(FAVORITE_QUESTIONS_KEY, JSON.stringify(favoriteQuestionKeys.value))
}

const toggleColorblindMode = () => {
  colorblindMode.value = !colorblindMode.value
  localStorage.setItem(ACCESSIBILITY_KEY, String(colorblindMode.value))
}

const toggleShuffleQuestions = () => {
  shuffleQuestions.value = !shuffleQuestions.value
  localStorage.setItem(SHUFFLE_QUESTIONS_KEY, String(shuffleQuestions.value))
  loadTests()
}

const setDisplayMode = (mode) => {
  displayMode.value = mode
  localStorage.setItem(DISPLAY_MODE_KEY, mode)
  currentCardIndex.value = Math.min(currentCardIndex.value, Math.max(tests.value.length - 1, 0))
}

const copyJsonFormat = async () => {
  error.value = ''
  try {
    await navigator.clipboard.writeText(JSON_FORMAT_EXAMPLE)
  } catch {
    error.value = 'Не вдалося скопіювати формат JSON.'
  }
}

const shuffleArray = (items) => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = tmp
  }
  return shuffled
}

const triggerCelebration = () => {
  const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7']
  celebrationRunId += 1
  celebrationPieces.value = Array.from({ length: 58 }, (_, index) => ({
    id: `${celebrationRunId}-${index}`,
    x: Math.round(Math.random() * 100),
    drift: Math.round((Math.random() - 0.5) * 260),
    rotation: Math.round(Math.random() * 720),
    size: Math.round(7 + Math.random() * 8),
    delay: Math.round(Math.random() * 260),
    duration: Math.round(1200 + Math.random() * 850),
    color: colors[index % colors.length],
    rounded: Math.random() > 0.55,
  }))

  if (celebrationTimeoutId) clearTimeout(celebrationTimeoutId)
  celebrationTimeoutId = setTimeout(() => {
    celebrationPieces.value = []
  }, 2400)
}

const normalizeTest = (entry, index) => {
  const item = entry?.item ?? entry
  const favoriteKey = entry?.favoriteKey ?? ''
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
    source: item,
    favoriteKey,
    text,
    answers,
    isMultiple: answers.filter((answer) => answer.isCorrect).length > 1,
    selected: [],
    status: null,
  }
}

const favoriteQuestionKeySet = computed(() => new Set(favoriteQuestionKeys.value))
const getFavoriteQuestionKey = (suiteId, questionIndex) => `${suiteId}:${questionIndex}`
const favoriteQuestionEntries = computed(() =>
  savedSuites.value.flatMap((suite) =>
    suite.questions
      .map((item, index) => ({
        item,
        favoriteKey: getFavoriteQuestionKey(suite.id, index),
      }))
      .filter((entry) => favoriteQuestionKeySet.value.has(entry.favoriteKey)),
  ),
)

const selectedSuite = computed(() => {
  if (selectedSuiteId.value === FAVORITE_QUESTIONS_SUITE_ID) {
    return {
      id: FAVORITE_QUESTIONS_SUITE_ID,
      title: 'Обрані питання',
      questions: favoriteQuestionEntries.value,
    }
  }

  return savedSuites.value.find((suite) => suite.id === selectedSuiteId.value)
})

const isQuestionFavorite = (test) =>
  Boolean(test?.favoriteKey && favoriteQuestionKeySet.value.has(test.favoriteKey))

const toggleFavoriteQuestion = (test) => {
  if (!test?.favoriteKey) return

  favoriteQuestionKeys.value = isQuestionFavorite(test)
    ? favoriteQuestionKeys.value.filter((key) => key !== test.favoriteKey)
    : [...favoriteQuestionKeys.value, test.favoriteKey]
  saveFavoriteQuestionKeys()
}

watchEffect(() => {
  document.title = selectedSuite.value?.title || 'ООІОІОІОІОІ'
})

const getQuestionsFromJson = (data) => {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.questions)) return data.questions
    if (Array.isArray(data.tests)) return data.tests
    if (Array.isArray(data.items)) return data.items
  }
  throw new Error('JSON має містити масив питань або поле questions/tests/items.')
}

const loadTests = (items = selectedSuite.value?.questions, options = {}) => {
  error.value = ''
  mistakeReviewMode.value = options.reviewMode === true
  mistakeReviewBaseTitle.value = options.baseTitle ?? ''
  if (!mistakeReviewMode.value) {
    mainSessionSnapshot.value = null
  }
  try {
    if (!selectedSuite.value && typeof items === 'undefined') {
      tests.value = []
      return
    }
    if (!Array.isArray(items)) {
      throw new Error('Набір тестів має бути масивом запитань.')
    }
    const keyedItems = items.map((item, index) =>
      item?.favoriteKey
        ? item
        : {
            item,
            favoriteKey: getFavoriteQuestionKey(selectedSuiteId.value, index),
          },
    )
    const preparedItems = shuffleQuestions.value ? shuffleArray(keyedItems) : keyedItems
    tests.value = preparedItems
      .map((item, index) => normalizeTest(item, index))
      .filter((item) => item.answers.length > 0)
    currentCardIndex.value = 0
    if (tests.value.length === 0) {
      error.value = 'У тестах не знайдено варіантів відповіді.'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    tests.value = []
  }
}

const startMistakeReview = () => {
  const missedQuestions = tests.value
    .filter((test) => test.status === 'wrong')
    .map((test) => ({
      item: test.source,
      favoriteKey: test.favoriteKey,
    }))

  if (missedQuestions.length === 0) return
  if (!mistakeReviewMode.value) {
    mainSessionSnapshot.value = {
      tests: tests.value,
      currentCardIndex: currentCardIndex.value,
    }
  }
  loadTests(missedQuestions, {
    reviewMode: true,
    baseTitle: selectedSuite.value?.title ?? '',
  })
}

const returnToMainSession = () => {
  if (!mainSessionSnapshot.value) return
  tests.value = mainSessionSnapshot.value.tests
  currentCardIndex.value = Math.min(
    mainSessionSnapshot.value.currentCardIndex,
    Math.max(tests.value.length - 1, 0),
  )
  mistakeReviewMode.value = false
  mistakeReviewBaseTitle.value = ''
  mainSessionSnapshot.value = null
  error.value = ''
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
  if (!selectedSuite.value || selectedSuiteId.value === FAVORITE_QUESTIONS_SUITE_ID) return
  const suiteId = selectedSuiteId.value
  savedSuites.value = savedSuites.value.filter((suite) => suite.id !== selectedSuiteId.value)
  favoriteQuestionKeys.value = favoriteQuestionKeys.value.filter(
    (key) => !key.startsWith(`${suiteId}:`),
  )
  saveSuites()
  saveFavoriteQuestionKeys()
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
  if (test.status === 'correct') triggerCelebration()
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
  if (test.status === 'correct') triggerCelebration()
}

const loaded = computed(() => tests.value.length > 0)
const hasSavedSuites = computed(() => savedSuites.value.length > 0)
const selectedSuiteCanBeDeleted = computed(
  () => selectedSuite.value && selectedSuiteId.value !== FAVORITE_QUESTIONS_SUITE_ID,
)
const activeTestTitle = computed(() => {
  if (!mistakeReviewMode.value) return selectedSuite.value?.title
  return `Робота над помилками${mistakeReviewBaseTitle.value ? `: ${mistakeReviewBaseTitle.value}` : ''}`
})
const currentCardTest = computed(() => tests.value[currentCardIndex.value])
const cardProgressPercent = computed(() =>
  tests.value.length > 0
    ? Math.round(((currentCardIndex.value + 1) / tests.value.length) * 100)
    : 0,
)
const goToPreviousCard = () => {
  currentCardIndex.value = Math.max(currentCardIndex.value - 1, 0)
}
const goToNextCard = () => {
  currentCardIndex.value = Math.min(currentCardIndex.value + 1, tests.value.length - 1)
}
const getAnswerMarker = (test, answer, index) => {
  if (!colorblindMode.value || test.status === null) return ''
  if (answer.isCorrect) return 'Правильна'
  if (isAnswerSelected(test, index)) return 'Зайва'
  return ''
}
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
const canStartMistakeReview = computed(() => resultSummary.value.wrong > 0)
const canReturnToMainSession = computed(() => mistakeReviewMode.value && mainSessionSnapshot.value)

loadTests()
</script>

<template>
  <main
    :class="[
      'app-shell',
      colorblindMode ? 'colorblind-mode' : '',
      displayMode === 'cards' ? 'cards-mode' : '',
    ]"
  >
    <div class="ambient-background" aria-hidden="true">
      <div class="ambient-blob blob-one"></div>
      <div class="ambient-blob blob-two"></div>
      <div class="ambient-blob blob-three"></div>
    </div>
    <div v-if="celebrationPieces.length" class="celebration" aria-hidden="true">
      <span
        v-for="piece in celebrationPieces"
        :key="piece.id"
        :class="['confetti-piece', piece.rounded ? 'rounded' : '']"
        :style="{
          '--x': `${piece.x}vw`,
          '--drift': `${piece.drift}px`,
          '--rotation': `${piece.rotation}deg`,
          '--size': `${piece.size}px`,
          '--delay': `${piece.delay}ms`,
          '--duration': `${piece.duration}ms`,
          '--color': piece.color,
        }"
      ></span>
    </div>

    <section class="card">
      <div class="header-row">
        <h1>Тестовий програвач</h1>
        <button
          type="button"
          :class="['mode-toggle', colorblindMode ? 'active' : '']"
          aria-label="Режим для дальтоніків"
          :aria-pressed="colorblindMode"
          title="Режим для дальтоніків"
          @click="toggleColorblindMode"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9" />
            <path d="M12 3v18" />
            <path d="M5.6 5.6 18.4 18.4" />
          </svg>
          <span class="sr-only">Режим для дальтоніків</span>
        </button>
      </div>

      <div class="suite-row">
        <label class="select-label" for="test-suite">Оберіть тест</label>
        <select
          id="test-suite"
          v-model="selectedSuiteId"
          :disabled="!hasSavedSuites"
          @change="loadTests()"
        >
          <option value="" disabled>Завантажте JSON</option>
          <option v-if="favoriteQuestionEntries.length" :value="FAVORITE_QUESTIONS_SUITE_ID">
            Обрані питання ({{ favoriteQuestionEntries.length }})
          </option>
          <optgroup label="Завантажені">
            <option v-for="suite in savedSuites" :key="suite.id" :value="suite.id">
              {{ suite.title }} ({{ suite.questions.length }})
            </option>
          </optgroup>
        </select>
        <div class="suite-actions">
          <button
            type="button"
            class="load-button"
            :disabled="!selectedSuite"
            aria-label="Почати знову"
            title="Почати знову"
            @click="loadTests()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            <span class="sr-only">Почати знову</span>
          </button>
          <button
            type="button"
            :class="['shuffle-button', shuffleQuestions ? 'active' : '']"
            aria-label="Перемішати питання"
            :aria-pressed="shuffleQuestions"
            :disabled="!selectedSuite"
            title="Перемішати питання"
            @click="toggleShuffleQuestions"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 14 4 4-4 4" />
              <path d="m18 2 4 4-4 4" />
              <path d="M2 18h1.5c3.2 0 4.7-2.1 6.2-5.1l.6-1.2C11.8 8.8 13.3 6 16.5 6H22" />
              <path d="M2 6h1.5c2.2 0 3.6 1 4.7 2.6" />
              <path d="M13.8 15.4c.8 1.5 1.7 2.6 2.7 2.6H22" />
            </svg>
            <span class="sr-only">Перемішати питання</span>
          </button>
          <button
            type="button"
            class="delete-button"
            :disabled="!selectedSuiteCanBeDeleted"
            aria-label="Видалити"
            title="Видалити"
            @click="deleteSelectedSuite"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="m19 6-1 14H6L5 6" />
              <path d="M10 11v5" />
              <path d="M14 11v5" />
            </svg>
            <span class="sr-only">Видалити</span>
          </button>
          <button
            type="button"
            class="copy-format-button"
            aria-label="Скопіювати формат JSON"
            title="Скопіювати формат JSON"
            @click="copyJsonFormat"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
            <span class="sr-only">Скопіювати формат JSON</span>
          </button>
          <label class="upload-button" aria-label="Завантажити JSON" title="Завантажити JSON">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 8 5-5 5 5" />
              <path d="M5 21h14" />
              <path d="M5 17v4" />
              <path d="M19 17v4" />
            </svg>
            <span class="sr-only">Завантажити JSON</span>
            <input type="file" accept="application/json,.json" @change="uploadJson" />
          </label>
        </div>
      </div>

      <p v-if="!hasSavedSuites && !error" class="empty-state">
        Завантажте JSON-файл, щоб додати перший тест у список.
      </p>

      <details class="json-example">
        <summary>Приклад формату JSON</summary>
        <pre><code>{{ JSON_FORMAT_EXAMPLE }}</code></pre>
      </details>

      <p v-if="error" class="error">Помилка: {{ error }}</p>
    </section>

    <section class="card test-card-shell" v-if="loaded">
      <div class="test-header">
        <div class="test-title">
          <h2>{{ activeTestTitle }}</h2>
          <span v-if="mistakeReviewMode" class="review-badge">Помилки</span>
          <button
            v-if="canReturnToMainSession"
            type="button"
            class="return-session-button"
            aria-label="Повернутися до основного тесту"
            title="Повернутися до основного тесту"
            @click="returnToMainSession"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            <span class="sr-only">Повернутися до основного тесту</span>
          </button>
        </div>
        <div class="view-switch" aria-label="Режим відображення">
          <button
            type="button"
            :class="displayMode === 'list' ? 'active' : ''"
            aria-label="Список"
            :aria-pressed="displayMode === 'list'"
            title="Список"
            @click="setDisplayMode('list')"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
            <span class="sr-only">Список</span>
          </button>
          <button
            type="button"
            :class="displayMode === 'cards' ? 'active' : ''"
            aria-label="Картки"
            :aria-pressed="displayMode === 'cards'"
            title="Картки"
            @click="setDisplayMode('cards')"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <path d="M8 9h8" />
              <path d="M8 13h5" />
            </svg>
            <span class="sr-only">Картки</span>
          </button>
        </div>
      </div>

      <template v-if="displayMode === 'list'">
        <ol class="test-list">
          <li v-for="test in tests" :key="test.id" class="test-item">
            <div class="question-header">
              <div class="question">
                <strong>{{ test.text }}</strong>
              </div>
              <button
                type="button"
                :class="['favorite-button', isQuestionFavorite(test) ? 'active' : '']"
                :aria-label="
                  isQuestionFavorite(test)
                    ? 'Прибрати питання з обраного'
                    : 'Додати питання в обране'
                "
                :aria-pressed="isQuestionFavorite(test)"
                :title="
                  isQuestionFavorite(test)
                    ? 'Прибрати питання з обраного'
                    : 'Додати питання в обране'
                "
                @click="toggleFavoriteQuestion(test)"
              >
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="m12 3 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.56l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 3Z"
                  />
                </svg>
                <span class="sr-only">
                  {{
                    isQuestionFavorite(test)
                      ? 'Прибрати питання з обраного'
                      : 'Додати питання в обране'
                  }}
                </span>
              </button>
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
                  test.status === 'correct' && isAnswerSelected(test, index) && answer.isCorrect
                    ? 'celebrate-correct'
                    : '',
                ]"
                :disabled="test.status !== null"
                @click="selectAnswer(test, index)"
              >
                <span>{{ answer.text }}</span>
                <span v-if="getAnswerMarker(test, answer, index)" class="answer-marker">
                  {{ getAnswerMarker(test, answer, index) }}
                </span>
              </button>
            </div>
            <button
              v-if="test.isMultiple"
              type="button"
              class="check-button"
              :disabled="test.status !== null || test.selected.length === 0"
              aria-label="Перевірити"
              title="Перевірити"
              @click="checkAnswer(test)"
            >
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m20 6-11 11-5-5" />
              </svg>
              <span class="sr-only">Перевірити</span>
            </button>
            <p v-if="test.status !== null" class="result">
              <span v-if="test.status === 'correct'" class="result-correct">Правильно!</span>
              <span v-else class="result-wrong">Неправильно — правильна відповідь підсвічена.</span>
            </p>
          </li>
        </ol>
      </template>

      <div v-else-if="currentCardTest" class="single-card-stage">
        <div class="card-progress-row">
          <span>Питання {{ currentCardIndex + 1 }} з {{ tests.length }}</span>
          <span>{{ cardProgressPercent }}%</span>
        </div>
        <div class="card-progress-track">
          <div class="card-progress-fill" :style="{ width: `${cardProgressPercent}%` }"></div>
        </div>

        <article class="single-test-card">
          <div class="question-header">
            <span class="question-number">{{ currentCardIndex + 1 }}</span>
            <div class="question">
              <strong>{{ currentCardTest.text }}</strong>
            </div>
            <button
              type="button"
              :class="['favorite-button', isQuestionFavorite(currentCardTest) ? 'active' : '']"
              :aria-label="
                isQuestionFavorite(currentCardTest)
                  ? 'Прибрати питання з обраного'
                  : 'Додати питання в обране'
              "
              :aria-pressed="isQuestionFavorite(currentCardTest)"
              :title="
                isQuestionFavorite(currentCardTest)
                  ? 'Прибрати питання з обраного'
                  : 'Додати питання в обране'
              "
              @click="toggleFavoriteQuestion(currentCardTest)"
            >
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="m12 3 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.56l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 3Z"
                />
              </svg>
              <span class="sr-only">
                {{
                  isQuestionFavorite(currentCardTest)
                    ? 'Прибрати питання з обраного'
                    : 'Додати питання в обране'
                }}
              </span>
            </button>
          </div>
          <div class="answers">
            <button
              v-for="(answer, index) in currentCardTest.answers"
              :key="index"
              :class="[
                'answer-button',
                isAnswerSelected(currentCardTest, index) ? 'selected' : '',
                currentCardTest.status !== null &&
                isAnswerSelected(currentCardTest, index) &&
                !answer.isCorrect
                  ? 'wrong'
                  : '',
                currentCardTest.status !== null && answer.isCorrect ? 'correct' : '',
                currentCardTest.status === 'correct' &&
                isAnswerSelected(currentCardTest, index) &&
                answer.isCorrect
                  ? 'celebrate-correct'
                  : '',
              ]"
              :disabled="currentCardTest.status !== null"
              @click="selectAnswer(currentCardTest, index)"
            >
              <span>{{ answer.text }}</span>
              <span v-if="getAnswerMarker(currentCardTest, answer, index)" class="answer-marker">
                {{ getAnswerMarker(currentCardTest, answer, index) }}
              </span>
            </button>
          </div>
          <button
            v-if="currentCardTest.isMultiple"
            type="button"
            class="check-button"
            :disabled="currentCardTest.status !== null || currentCardTest.selected.length === 0"
            aria-label="Перевірити"
            title="Перевірити"
            @click="checkAnswer(currentCardTest)"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m20 6-11 11-5-5" />
            </svg>
            <span class="sr-only">Перевірити</span>
          </button>
          <p v-if="currentCardTest.status !== null" class="result">
            <span v-if="currentCardTest.status === 'correct'" class="result-correct"
              >Правильно!</span
            >
            <span v-else class="result-wrong">Неправильно — правильна відповідь підсвічена.</span>
          </p>
        </article>

        <div class="card-navigation">
          <button
            type="button"
            :disabled="currentCardIndex === 0"
            aria-label="Назад"
            title="Назад"
            @click="goToPreviousCard"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span class="sr-only">Назад</span>
          </button>
          <button
            type="button"
            :disabled="currentCardIndex === tests.length - 1"
            aria-label="Далі"
            title="Далі"
            @click="goToNextCard"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
            <span class="sr-only">Далі</span>
          </button>
        </div>
      </div>

      <div class="summary">
        <div>
          <div class="summary-heading">
            <h3>Результат</h3>
            <button
              v-if="canStartMistakeReview"
              type="button"
              class="review-button"
              :aria-label="mistakeReviewMode ? 'Пройти помилки ще раз' : 'Відпрацювати помилки'"
              :title="mistakeReviewMode ? 'Пройти помилки ще раз' : 'Відпрацювати помилки'"
              @click="startMistakeReview"
            >
              {{ mistakeReviewMode ? 'Ще раз' : 'Помилки' }}
            </button>
          </div>
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
  position: relative;
  min-height: 100vh;
  width: min(100%, 860px);
  box-sizing: border-box;
  max-width: 860px;
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
.app-shell.cards-mode {
  height: 100vh;
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  margin: 0 auto;
  overflow: hidden;
}
.ambient-background {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #eef6ff 42%, #fff7ed 100%);
}
.ambient-background::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.82), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.15), rgba(248, 250, 252, 0.72));
}
.ambient-blob {
  position: absolute;
  width: 46vmax;
  aspect-ratio: 1;
  border-radius: 999px;
  filter: blur(62px);
  opacity: 0.42;
  mix-blend-mode: multiply;
  will-change: transform;
}
.blob-one {
  top: -18vmax;
  left: -14vmax;
  background: #93c5fd;
  animation: float-one 24s ease-in-out infinite alternate;
}
.blob-two {
  right: -18vmax;
  bottom: -16vmax;
  background: #fcd34d;
  animation: float-two 28s ease-in-out infinite alternate;
}
.blob-three {
  top: 28%;
  right: 18%;
  width: 34vmax;
  background: #5eead4;
  opacity: 0.28;
  animation: float-three 32s ease-in-out infinite alternate;
}
.celebration {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow: hidden;
  pointer-events: none;
}
.confetti-piece {
  position: fixed;
  top: -18px;
  left: var(--x);
  width: var(--size);
  height: calc(var(--size) * 1.55);
  border-radius: 3px;
  background: var(--color);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.04);
  animation: confetti-fall var(--duration) cubic-bezier(0.12, 0.78, 0.28, 1) var(--delay) forwards;
}
.confetti-piece.rounded {
  border-radius: 999px;
}
.card {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(14px);
  margin-bottom: 0;
}
.card:first-of-type {
  padding: 12px 16px;
}
.app-shell:not(.cards-mode) .card + .card {
  margin-top: 8px;
}
.cards-mode .card {
  margin-bottom: 0;
}
.cards-mode .card:first-of-type {
  align-self: start;
}
.cards-mode .test-card-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  max-width: 100%;
  overflow: hidden;
}
.card h1,
.card h2 {
  margin-top: 0;
  line-height: 1.2;
}
.card h1 {
  margin-bottom: 0;
  font-size: 22px;
}
.card h2 {
  font-size: 24px;
}
.icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}
.mode-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-height: 32px;
  padding: 6px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
.mode-toggle:hover,
.mode-toggle.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}
.select-label,
.json-example {
  display: none;
}
.suite-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto;
  align-items: start;
  gap: 8px;
}
.suite-actions {
  grid-column: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
select {
  width: 100%;
  min-height: 36px;
  box-sizing: border-box;
  font: inherit;
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f8fafc;
  color: #111827;
}
.load-button,
.upload-button,
.delete-button,
.shuffle-button,
.copy-format-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-height: 36px;
  box-sizing: border-box;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
  white-space: nowrap;
}
.empty-state,
.error {
  margin-top: 8px;
}
.test-header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.test-header h2 {
  margin-bottom: 0;
}
.test-title {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 10px;
}
.test-title h2 {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-badge {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
  font-weight: 800;
}
.return-session-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-height: 32px;
  padding: 7px;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  cursor: pointer;
}
.return-session-button:hover {
  background: #fef3c7;
}
.view-switch {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 4px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f8fafc;
}
.view-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-height: 34px;
  padding: 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
}
.view-switch button.active {
  background: #2563eb;
  color: #ffffff;
}
.load-button:hover,
.upload-button:hover,
.copy-format-button:hover {
  background: #1d4ed8;
}
.favorite-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-height: 32px;
  box-sizing: border-box;
  padding: 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}
.favorite-button:hover {
  background: transparent;
  color: #d97706;
}
.favorite-button.active {
  background: transparent;
  color: #f59e0b;
}
.favorite-button.active .icon {
  fill: currentColor;
}
.shuffle-button {
  background: #eef2ff;
  color: #3730a3;
  border: 1px solid #c7d2fe;
}
.shuffle-button:hover,
.shuffle-button.active {
  background: #4338ca;
  color: #ffffff;
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
.shuffle-button:disabled,
.copy-format-button:disabled,
.favorite-button:disabled,
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
  color: #dc2626;
}
.empty-state {
  margin-bottom: 0;
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
.single-card-stage {
  display: grid;
  min-width: 0;
  gap: 16px;
}
.cards-mode .single-card-stage {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  min-height: 0;
  gap: 10px;
}
.card-progress-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #4b5563;
  font-weight: 700;
}
.card-progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
}
.card-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
  transition: width 0.2s ease;
}
.single-test-card {
  min-width: 0;
  min-height: min(58vh, 560px);
  box-sizing: border-box;
  padding: 26px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
.cards-mode .single-test-card {
  min-height: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 22px;
}
.question-header {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: flex-start;
}
.question-number {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #111827;
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
}
.test-list .question-number {
  display: none;
}
.question {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  margin-bottom: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: normal;
}
.question strong {
  overflow-wrap: anywhere;
}
.single-test-card .question {
  font-size: 20px;
}
.answers {
  display: grid;
  min-width: 0;
  gap: 10px;
}
.answer-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
  overflow: hidden;
  overflow-wrap: anywhere;
}
.answer-button:hover {
  background: #e2e8f0;
}
.answer-button > span:first-child {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.answer-button.selected {
  background: #dbeafe;
  border-color: #2563eb;
}
.answer-button.correct {
  background: #d1fae5;
  border-color: #10b981;
}
.answer-button.celebrate-correct {
  animation: correct-pop 680ms ease-out;
  box-shadow:
    0 0 0 4px rgba(16, 185, 129, 0.14),
    0 14px 28px rgba(16, 185, 129, 0.18);
}
.answer-button.celebrate-correct::after {
  content: '';
  position: absolute;
  inset: -40%;
  background: linear-gradient(
    115deg,
    transparent 0 38%,
    rgba(255, 255, 255, 0.86) 45%,
    transparent 52% 100%
  );
  transform: translateX(-85%) rotate(8deg);
  animation: correct-shine 680ms ease-out;
}
.answer-button.wrong {
  background: #fee2e2;
  border-color: #ef4444;
}
.answer-marker {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: #ffffff;
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}
.colorblind-mode .answer-button.correct {
  background: #dbeafe;
  border-color: #1d4ed8;
  border-width: 2px;
}
.colorblind-mode .answer-button.wrong {
  background: #fef3c7;
  border-color: #b45309;
  border-width: 2px;
}
.colorblind-mode .result-correct {
  color: #1d4ed8;
}
.colorblind-mode .result-wrong {
  color: #92400e;
}
.colorblind-mode .answer-marker {
  border: 1px solid #111827;
}
.check-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-height: 40px;
  margin-top: 10px;
  padding: 10px;
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
.card-navigation {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.card-navigation button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}
.card-navigation button:hover {
  background: #1d4ed8;
}
.card-navigation button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
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
.cards-mode .summary {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
}
.cards-mode .summary h3 {
  margin-bottom: 2px;
  font-size: 16px;
}
.cards-mode .summary p {
  font-size: 13px;
}
.cards-mode .summary-stats {
  grid-template-columns: repeat(3, minmax(68px, 1fr));
  gap: 6px;
}
.cards-mode .summary-stat {
  min-width: 68px;
  padding: 6px 8px;
}
.cards-mode .summary-stat span {
  margin-bottom: 2px;
  font-size: 11px;
}
.cards-mode .summary-stat strong {
  font-size: 18px;
}
.summary h3 {
  margin: 0 0 6px;
  font-size: 20px;
  line-height: 1.2;
}
.summary-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.summary-heading h3 {
  margin: 0;
}
.review-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 7px 10px;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  background: #fef3c7;
  color: #92400e;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
}
.review-button:hover {
  background: #fde68a;
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
@keyframes float-one {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(12vmax, 8vmax, 0) scale(1.12);
  }
}
@keyframes float-two {
  from {
    transform: translate3d(0, 0, 0) scale(1.05);
  }
  to {
    transform: translate3d(-10vmax, -7vmax, 0) scale(0.95);
  }
}
@keyframes float-three {
  from {
    transform: translate3d(0, 0, 0) scale(0.95);
  }
  to {
    transform: translate3d(-8vmax, 6vmax, 0) scale(1.16);
  }
}
@keyframes confetti-fall {
  0% {
    opacity: 0;
    transform: translate3d(0, -20px, 0) rotate(0deg);
  }
  10% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--drift), 108vh, 0) rotate(var(--rotation));
  }
}
@keyframes correct-pop {
  0% {
    transform: scale(1);
  }
  34% {
    transform: scale(1.025);
  }
  68% {
    transform: scale(0.995);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes correct-shine {
  from {
    transform: translateX(-85%) rotate(8deg);
  }
  to {
    transform: translateX(85%) rotate(8deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ambient-blob,
  .confetti-piece,
  .answer-button.celebrate-correct,
  .answer-button.celebrate-correct::after {
    animation: none;
  }
  .celebration {
    display: none;
  }
}
@media (max-width: 640px) {
  .app-shell {
    margin: 12px auto;
    padding: 0 10px;
  }
  .app-shell.cards-mode {
    height: 100vh;
    margin: 0 auto;
    padding: 0 10px;
    gap: 8px;
  }
  .card {
    padding: 16px;
    margin-bottom: 0;
    box-shadow: none;
  }
  .card:first-of-type {
    padding: 10px;
  }
  .cards-mode .card {
    margin-bottom: 0;
  }
  .card h1 {
    font-size: 19px;
  }
  .card h2 {
    font-size: 20px;
  }
  .test-header {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }
  .cards-mode .test-header {
    flex-direction: row;
    align-items: center;
  }
  .view-switch {
    display: inline-flex;
    flex: 0 0 auto;
  }
  .view-switch button {
    min-height: 30px;
    padding: 5px 8px;
    font-size: 13px;
  }
  .suite-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .header-row {
    align-items: center;
    flex-direction: row;
    gap: 8px;
    margin-bottom: 8px;
  }
  .mode-toggle {
    width: auto;
  }
  .suite-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .load-button,
  .upload-button,
  .delete-button,
  .shuffle-button,
  .copy-format-button {
    width: 36px;
    flex: 0 0 auto;
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
  .cards-mode .single-test-card {
    padding: 14px;
  }
  .cards-mode .single-test-card .question {
    font-size: 17px;
  }
  .summary {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .cards-mode .summary {
    grid-template-columns: 1fr;
    gap: 6px;
    margin-top: 6px;
    padding-top: 6px;
  }
  .summary-stats {
    grid-template-columns: 1fr;
  }
  .cards-mode .summary-stats {
    grid-template-columns: repeat(3, 1fr);
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
