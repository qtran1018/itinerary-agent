<script setup lang="ts">
import { ref, computed } from "vue";
import questions from "../data/questions";
import { prompts } from "../data/prompts";
import type { Question } from "../data/types";
import { marked } from "marked";
import keycloak from "../keycloak";

interface ItineraryEntry {
  name: string;
  type: string;
  location: string;
  notes: string;
}

const props = defineProps<{ isDarkMode: boolean; authenticated: boolean }>();

const currentQuestionId = ref<string>("q1");
const answers = ref<Record<string, string | string[]>>({});
const questionHistory = ref<string[]>(["q1"]);
const quizFinished = ref(false);
const results = ref<string>("");
const reply = ref<string>("");
const htmlReply = ref<string>("");
const entries = ref<ItineraryEntry[]>([]);
const loading = ref(false);
const countrySearchTerm = ref<string>("");
const tripDestination = ref<string>("");

const saveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
const exportStatus = ref<"idle" | "exporting" | "exported" | "error">("idle");

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
    sendPrompt();
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
  entries.value = [];
  tripDestination.value = "";
  countrySearchTerm.value = "";
  saveStatus.value = "idle";
  exportStatus.value = "idle";
}

// Map answers to prompts
function mapAnswersToPrompts(answers: Record<string, string | string[]>): string {
  const res: string[] = [];

  for (const [qid, answer] of Object.entries(answers)) {
    const promptEntry = prompts[qid];
    if (!promptEntry) continue;

    if (typeof promptEntry === "function") {
      if (typeof answer === "string" && answer.trim()) res.push(promptEntry(answer));
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

  // Fallback title from quiz answers until the LLM response arrives
  const rawAnswer = (answers.value["q3"] as string) || (answers.value["q4"] as string) || "My Trip";

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (keycloak.token) headers["Authorization"] = `Bearer ${keycloak.token}`;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: results.value }),
    });
    const data = await response.json();
    if (response.ok) {
      // Prefer the LLM-generated title; fall back to the raw quiz answer
      tripDestination.value = (data.title as string) || rawAnswer;
      reply.value = data.reply;
      entries.value = data.entries ?? [];
      processReply(data.reply);
    } else {
      tripDestination.value = rawAnswer;
      reply.value = `Error: ${data.error || "Something went wrong"}`;
      entries.value = [];
      processReply(reply.value);
    }
  } catch (error) {
    tripDestination.value = rawAnswer;
    reply.value = `Fetch error: ${error}`;
    entries.value = [];
    processReply(reply.value);
  } finally {
    loading.value = false;
  }
}

function processReply(raw: string) {
  htmlReply.value = marked.parse(raw) as string;
}

async function saveTrip() {
  if (!props.authenticated || saveStatus.value === "saving") return;
  saveStatus.value = "saving";
  try {
    await keycloak.updateToken(30);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keycloak.token}`,
      },
      body: JSON.stringify({
        title: tripDestination.value,
        destination: tripDestination.value,
        entries: entries.value,
      }),
    });
    saveStatus.value = res.ok ? "saved" : "error";
  } catch {
    saveStatus.value = "error";
  }
}

async function exportToTravelBin() {
  if (!props.authenticated || exportStatus.value === "exporting") return;

  // Save first if not already saved
  if (saveStatus.value !== "saved") {
    await saveTrip();
    if (saveStatus.value === "error") {
      exportStatus.value = "error";
      return;
    }
  }

  exportStatus.value = "exporting";
  try {
    await keycloak.updateToken(30);
    // Get the most recent saved trip
    const tripsRes = await fetch("/api/trips", {
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
    if (!tripsRes.ok) throw new Error("Could not fetch trips");
    const trips = await tripsRes.json();
    const latestTrip = trips[0];
    if (!latestTrip) throw new Error("No trip to export");

    const exportRes = await fetch(`/api/trips/${latestTrip.id}/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
    exportStatus.value = exportRes.ok ? "exported" : "error";
  } catch {
    exportStatus.value = "error";
  }
}
</script>

<template>
  <div class="quiz">
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
            :maxlength="getCurrentQuestion().maxLength"
          />
          <button @click="handleAnswer(answers[getCurrentQuestion().id] as string || '')">
            Next
          </button>
          <button
            v-if="getCurrentQuestion().optional"
            class="skip-button"
            @click="handleAnswer('')"
          >
            Skip
          </button>
        </div>
        <div v-if="getCurrentQuestion().maxLength" class="char-counter">
          {{ (answers[getCurrentQuestion().id] as string || '').length }} / {{ getCurrentQuestion().maxLength }}
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

      <!-- Action buttons (logged in only) -->
      <div v-if="authenticated" class="itinerary-actions">
        <button
          class="action-btn action-btn--save"
          :disabled="saveStatus === 'saving' || saveStatus === 'saved'"
          @click="saveTrip"
        >
          {{ saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save Trip' }}
        </button>
        <button
          class="action-btn action-btn--export"
          :disabled="exportStatus === 'exporting' || exportStatus === 'exported'"
          @click="exportToTravelBin"
        >
          {{ exportStatus === 'exporting' ? 'Exporting…' : exportStatus === 'exported' ? '✓ Sent to TravelBin' : 'Export to TravelBin' }}
        </button>
        <span v-if="saveStatus === 'error' || exportStatus === 'error'" class="action-error">
          Something went wrong. Please try again.
        </span>
      </div>

      <!-- Markdown itinerary -->
      <div v-html="htmlReply"></div>

      <!-- Structured entries breakdown -->
      <div v-if="entries.length > 0" class="entries-section">
        <h3>Activity Breakdown</h3>
        <div class="entries-grid">
          <div v-for="entry in entries" :key="entry.name" class="entry-card">
            <div class="entry-type-badge" :class="`entry-type--${entry.type.toLowerCase().replace(/[^a-z]/g, '-')}`">
              {{ entry.type }}
            </div>
            <div class="entry-name">{{ entry.name }}</div>
            <div class="entry-location">📍 {{ entry.location }}</div>
            <div v-if="entry.notes" class="entry-notes">{{ entry.notes }}</div>
          </div>
        </div>
      </div>

      <div class="restart-container">
        <button @click="restartQuiz" class="restart-button">Plan Another Trip</button>
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
.char-counter {
  font-size: 0.78rem;
  color: var(--text-color);
  opacity: 0.45;
  text-align: right;
  margin-top: 0.25rem;
  padding-right: 0.25rem;
}

.skip-button {
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  opacity: 0.65;
  box-shadow: none;
}

.skip-button:hover {
  opacity: 1;
  transform: none;
  box-shadow: none;
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

/* ── Itinerary action buttons ─────────────────────────────────────────── */
.itinerary-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.action-btn {
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.action-btn:disabled {
  cursor: default;
  opacity: 0.65;
}
.action-btn:not(:disabled):hover {
  opacity: 0.85;
  transform: translateY(-1px);
}
.action-btn--save {
  background: var(--primary-color);
  color: #fff;
}
.action-btn--export {
  background: #10b981;
  color: #fff;
}
.action-error {
  font-size: 0.85rem;
  color: #ef4444;
}

/* ── Entries breakdown ────────────────────────────────────────────────── */
.entries-section {
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 2px solid var(--border-color);
}
.entries-section h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-color);
}
.entries-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.875rem;
}
.entry-card {
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.entry-type-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  align-self: flex-start;
  margin-bottom: 0.15rem;
}
.entry-type--food---drink  { background: #fef3c7; color: #92400e; }
.entry-type--shopping      { background: #ede9fe; color: #5b21b6; }
.entry-type--sightseeing   { background: #dbeafe; color: #1e40af; }
.entry-type--activity      { background: #dcfce7; color: #166534; }
.entry-type--other         { background: #f3f4f6; color: #374151; }
.entry-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-color);
  line-height: 1.3;
}
.entry-location {
  font-size: 0.82rem;
  color: var(--text-color);
  opacity: 0.65;
}
.entry-notes {
  font-size: 0.82rem;
  color: var(--text-color);
  opacity: 0.8;
  font-style: italic;
  line-height: 1.4;
  margin-top: 0.1rem;
}
@media (max-width: 480px) {
  .entries-grid { grid-template-columns: 1fr; }
  .itinerary-actions { gap: 0.5rem; }
  .action-btn { width: 100%; text-align: center; }
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .quiz {
    padding-bottom: 1rem;
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
  
}
</style>
