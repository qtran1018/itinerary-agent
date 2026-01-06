<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import questions from "../data/questions";
import { prompts } from "../data/prompts";
import type { Question } from "../data/types";
import { marked } from "marked";

const currentQuestionId = ref<string>("q1"); // start at q1
const answers = ref<Record<string, string | string[]>>({}); // stores user answers
const questionHistory = ref<string[]>(["q1"]); // track question navigation history
const quizFinished = ref(false);
const results = ref<string>("");
const reply = ref<string>("");
const htmlReply = ref<string>("");
const loading = ref(false);
const countrySearchTerm = ref<string>(""); // for country search functionality
const isDarkMode = ref<boolean>(true); // default to dark mode

// Toggle theme
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light');
}

// Initialize theme on mount
onMounted(() => {
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light');
});

const getCurrentQuestion = () =>
  questions.find((q) => q.id === currentQuestionId.value) as Question;

// Filter countries based on search term
const filteredCountries = computed(() => {
  const question = getCurrentQuestion();
  if (question.type !== 'dropdown' || question.id !== 'q4') {
    return question.options || [];
  }
  if (!countrySearchTerm.value) {
    return question.options || [];
  }
  const searchLower = countrySearchTerm.value.toLowerCase();
  return (question.options || []).filter(country =>
    country.toLowerCase().includes(searchLower)
  );
});

// Handle button / dropdown / text inputs
function handleAnswer(option: string) {
  const question = getCurrentQuestion();
  answers.value[question.id] = option;

  // Figure out next question
  const nextId = question.next?.[option] ?? question.next?.["default"];
  if (nextId) {
    // If we're going forward after going back, truncate history to current position
    // and rebuild from there
    const currentIndex = questionHistory.value.indexOf(currentQuestionId.value);
    if (currentIndex !== -1 && currentIndex < questionHistory.value.length - 1) {
      // We're on a question that's not at the end of history (went back then forward)
      questionHistory.value = questionHistory.value.slice(0, currentIndex + 1);
    } else if (currentIndex === -1) {
      // Current question not in history, add it
      questionHistory.value.push(currentQuestionId.value);
    }
    // Add next question
    questionHistory.value.push(nextId);
    currentQuestionId.value = nextId;
    // Clear search term when moving to next question
    countrySearchTerm.value = "";
  } else {
    quizFinished.value = true;
    results.value = mapAnswersToPrompts(answers.value);
    sendPrompt();
  }
}

// Handle checkbox selections (multiple)
function handleCheckboxChange(option: string, checked: boolean) {
  const question = getCurrentQuestion();
  const prev = (answers.value[question.id] as string[]) || [];
  answers.value[question.id] = checked
    ? [...prev, option]
    : prev.filter((o) => o !== option);
}

// Go to next after checkbox question
function submitCheckbox() {
  const question = getCurrentQuestion();
  const nextId = question.next?.["default"];
  if (nextId) {
    // If we're going forward after going back, truncate history to current position
    // and rebuild from there
    const currentIndex = questionHistory.value.indexOf(currentQuestionId.value);
    if (currentIndex !== -1 && currentIndex < questionHistory.value.length - 1) {
      // We're on a question that's not at the end of history (went back then forward)
      questionHistory.value = questionHistory.value.slice(0, currentIndex + 1);
    } else if (currentIndex === -1) {
      // Current question not in history, add it
      questionHistory.value.push(currentQuestionId.value);
    }
    // Add next question
    questionHistory.value.push(nextId);
    currentQuestionId.value = nextId;
  } else {
    quizFinished.value = true;
    results.value = mapAnswersToPrompts(answers.value);
  }
}

// Navigate backward through question history
function goBack() {
  if (questionHistory.value.length <= 1) return; // Can't go back from first question
  
  // Get the previous question index before modifying history
  const previousIndex = questionHistory.value.length - 2; // -2 because we want the one before current
  
  // Clear answers for all questions that come after the one we're going back to
  // This ensures consistency when user changes their answer
  const questionsToClear = questionHistory.value.slice(previousIndex + 1);
  
  questionsToClear.forEach(qid => {
    delete answers.value[qid];
  });
  
  // Remove current question from history and navigate to previous
  questionHistory.value.pop();
  const previousQuestionId = questionHistory.value[questionHistory.value.length - 1];
  
  currentQuestionId.value = previousQuestionId;
  quizFinished.value = false; // In case we were at the end
  // Clear search term when going back
  countrySearchTerm.value = "";
}

// Restart quiz from the beginning
function restartQuiz() {
  currentQuestionId.value = "q1";
  answers.value = {};
  questionHistory.value = ["q1"];
  quizFinished.value = false;
  results.value = "";
  reply.value = "";
  htmlReply.value = "";
  countrySearchTerm.value = "";
}

// Map answers to prompts
function mapAnswersToPrompts(answers: Record<string, string | string[]>): string {
  const res: string[] = [];

  for (const [qid, answer] of Object.entries(answers)) {
    const promptEntry = prompts[qid];
    if (!promptEntry) continue;

    if (typeof promptEntry === "function") {
      if (typeof answer === "string") res.push(promptEntry(answer));
    } else {
      if (Array.isArray(answer)) {
        answer.forEach((ans) => {
          res.push(promptEntry[ans] || promptEntry["default"] || "");
        });
      } else {
        res.push(promptEntry[answer] || promptEntry["default"] || "");
      }
    }
  }

  // join all prompts into one string, separated by spaces
  return res.filter(Boolean).join(" ");
}

async function sendPrompt() {
  if (!results.value) return;

  loading.value = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({message: results.value}),
    });
    const data = await response.json();
    if (response.ok) {
      reply.value = data.reply;
      processReply(data.reply)
    } else {
      reply.value = `Error: ${data.error || "Something went wrong"}`;
      processReply(reply.value)
    }
  }
  catch (error) {
    reply.value = `Fetch error: ${error}`;
  }
  finally {
    loading.value = false;
  }
}

function processReply(raw: string) {
  htmlReply.value = marked.parse(raw) as string;
}
</script>

<template>
  <div class="quiz">
    <!-- Theme Toggle -->
    <div class="theme-toggle-container">
      <button @click="toggleTheme" class="theme-toggle-button">
        {{ isDarkMode ? '☀️' : '🌙' }}
      </button>
    </div>

    <!-- Quiz Questions -->
    <div class="questions" v-if="!quizFinished && !loading">
      <div class="question-header">
        <h2>{{ getCurrentQuestion().question }}</h2>
      </div>

      <!-- Buttons -->
      <div v-if="getCurrentQuestion().type === 'buttons'">
        <div class="options-container">
          <button
            v-for="option in getCurrentQuestion().options"
            :key="option"
            @click="handleAnswer(option)"
          >
            {{ option }}
          </button>
        </div>
        <div v-if="questionHistory.length > 1" class="back-button-container">
          <button 
            @click="goBack" 
            class="back-button"
          >
            ← Back
          </button>
        </div>
      </div>

      <!-- Text input -->
      <div v-else-if="getCurrentQuestion().type === 'text'">
        <div class="options-container">
          <input
            type="text"
            v-model="answers[getCurrentQuestion().id]"
            placeholder="Type your answer..."
          />
          <button @click="handleAnswer(answers[getCurrentQuestion().id] as string || '')">
            Next
          </button>
        </div>
        <div v-if="questionHistory.length > 1" class="back-button-container">
          <button 
            @click="goBack" 
            class="back-button"
          >
            ← Back
          </button>
        </div>
      </div>

      <!-- Dropdown with search (for country selection) -->
      <div v-else-if="getCurrentQuestion().type === 'dropdown'" class="dropdown-container">
        <!-- Search input for country dropdown -->
        <div v-if="getCurrentQuestion().id === 'q4'" class="country-search-container">
          <input
            type="text"
            v-model="countrySearchTerm"
            placeholder="Search countries..."
            class="country-search-input"
          />
        </div>
        <!-- Visible list for country selection (q4) -->
        <div v-if="getCurrentQuestion().id === 'q4'" class="country-list-container">
          <div class="country-list">
            <button
              v-for="option in filteredCountries"
              :key="option"
              @click="handleAnswer(option)"
              :class="['country-button', { 'selected': answers[getCurrentQuestion().id] === option }]"
            >
              {{ option }}
            </button>
          </div>
        </div>
        <!-- Regular dropdown for other questions -->
        <select
          v-else
          v-model="answers[getCurrentQuestion().id]"
          @change="handleAnswer(answers[getCurrentQuestion().id] as string)"
        >
          <option disabled value="">Choose your country</option>
          <option
            v-for="option in filteredCountries"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
        <div v-if="questionHistory.length > 1" class="back-button-container">
          <button 
            @click="goBack" 
            class="back-button"
          >
            ← Back
          </button>
        </div>
      </div>

      <!-- Checkbox -->
      <div class="checkbox-group" v-else-if="getCurrentQuestion().type === 'checkbox'">
        <div v-for="option in getCurrentQuestion().options" :key="option">
          <input
            class="questions-checkbox"
            type="checkbox"
            :id="option"
            :value="option"
            :checked="(answers[getCurrentQuestion().id] as string[] || []).includes(option)"
            @change="handleCheckboxChange(option, ($event.target as HTMLInputElement).checked)"
          />
          <label :for="option">{{ option }}</label>
        </div>
        <div class="options-container">
          <button @click="submitCheckbox">Next</button>
        </div>
        <div v-if="questionHistory.length > 1" class="back-button-container">
          <button 
            @click="goBack" 
            class="back-button"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>

    <!-- Loading screen -->
    <div v-else-if="loading" class="loading-screen">
      <div class="spinner"></div>
      <p>Planning your itinerary...</p>
    </div>

    <!-- Results -->
    <div v-else class="results">
      <h2>Your Travel Itinerary</h2>
      <div v-html="htmlReply"></div>
      <div class="restart-container">
        <button @click="restartQuiz" class="restart-button">
          Restart Quiz
        </button>
      </div>
    </div>
  </div>
</template>


<style scoped>
.quiz {
  padding-bottom: 2rem;
  position: relative;
}
button {
  margin: 0.25rem;
}
.theme-toggle-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
}
.theme-toggle-button {
  padding: 0.5rem 0.75rem;
  font-size: 1.5rem;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.theme-toggle-button:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
.question-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  position: sticky;
  top: 0;
  background-color: var(--bg-color);
  z-index: 10;
  padding: 1rem 0;
}
.question-header h2 {
  margin: 0;
  flex: 1;
  color: var(--text-color);
}
.options-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}
.back-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}
.back-button {
  padding: 0.5rem 1rem;
  background-color: var(--back-button-bg);
  color: var(--back-button-text);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}
.back-button:hover {
  background-color: var(--back-button-hover);
  transform: translateY(-2px);
}
.dropdown-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.dropdown-container .back-button-container {
  margin-top: 2rem;
}
.country-search-container {
  margin-bottom: 0.5rem;
}
.country-search-input {
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  box-sizing: border-box;
  background-color: var(--input-bg);
  color: var(--text-color);
}
.country-search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 6px rgba(234, 77, 45, 0.6);
}
.country-list-container {
  margin-top: 0.5rem;
  height: 300px; /* Fixed height to prevent layout shift */
}
.country-list {
  height: 100%;
  overflow-y: auto;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background-color: var(--list-bg);
}
.country-button {
  padding: 0.75rem;
  text-align: left;
  background-color: var(--country-button-bg);
  color: var(--country-button-text);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
}
.country-button:hover {
  background-color: var(--country-button-hover);
  transform: translateY(-1px);
}
.country-button.selected {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}
.restart-container {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  padding-top: 2rem;
  border-top: 2px solid var(--border-color);
}
.restart-button {
  padding: 0.75rem 2rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s ease;
}
.restart-button:hover {
  opacity: 0.9;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .quiz {
    padding-bottom: 1rem;
  }
  
  .theme-toggle-container {
    top: 0.5rem;
    right: 0.5rem;
  }
  
  .theme-toggle-button {
    padding: 0.4rem 0.6rem;
    font-size: 1.25rem;
  }
  
  .question-header {
    padding: 0.5rem 0;
    margin-bottom: 0.75rem;
  }
  
  .question-header h2 {
    font-size: 1.25rem;
    line-height: 1.4;
  }
  
  .options-container {
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding: 0 0.5rem;
    width: 100%;
  }
  
  .options-container input[type="text"] {
    width: 100%;
    margin: 0;
  }
  
  .options-container button {
    min-height: 44px; /* Touch-friendly size */
    min-width: 44px;
    padding: 0.875rem 1.25rem;
    font-size: 1rem;
    width: 100%;
    max-width: 100%;
  }
  
  .back-button-container {
    margin-top: 1.5rem;
    padding-top: 1rem;
    padding: 0 0.5rem;
  }
  
  .back-button {
    min-height: 44px;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    width: 100%;
    max-width: 200px;
  }
  
  .country-search-input {
    padding: 0.875rem;
    font-size: 16px; /* Prevents zoom on iOS */
    min-height: 44px;
    appearance: none;
    -webkit-appearance: none;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
  }
  
  .country-list-container {
    height: 250px; /* Slightly smaller on mobile */
    margin-top: 0.75rem;
  }
  
  .country-list {
    padding: 0.5rem;
    gap: 0.5rem;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  
  .country-button {
    padding: 1rem;
    min-height: 48px; /* Larger touch target */
    font-size: 1rem;
    width: 100%;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
    touch-action: manipulation;
  }
  
  .dropdown-container .back-button-container {
    margin-top: 1.5rem;
    padding: 0 0.5rem;
  }
  
  .checkbox-group {
    width: 100%;
    padding: 0 0.5rem;
  }
  
  .checkbox-group > div {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    min-height: 44px;
  }
  
  .checkbox-group label {
    font-size: 1rem;
    line-height: 1.5;
    flex: 1;
    margin: 0;
    cursor: pointer;
  }
  
  input[type="checkbox"] {
    width: 22px;
    height: 22px;
    min-width: 22px;
    min-height: 22px;
    flex-shrink: 0;
  }
  
  .restart-container {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    padding: 0 0.5rem;
  }
  
  .restart-button {
    width: 100%;
    max-width: 100%;
    min-height: 48px;
    padding: 1rem 2rem;
    font-size: 1.1rem;
  }
}

@media (max-width: 480px) {
  .question-header h2 {
    font-size: 1.1rem;
  }
  
  .country-list-container {
    height: 200px;
  }
  
  .options-container button {
    padding: 1rem 1.25rem;
    font-size: 0.95rem;
  }
  
  .theme-toggle-button {
    padding: 0.35rem 0.5rem;
    font-size: 1.1rem;
  }
}
</style>
