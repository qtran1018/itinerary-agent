<script setup lang="ts">
import { ref } from "vue";
import questions from "../data/questions";
import { prompts } from "../data/prompts";
import type { Question } from "../data/types";
import { marked } from "marked";

const currentQuestionId = ref<string>("q1"); // start at q1
const answers = ref<Record<string, string | string[]>>({}); // stores user answers
const quizFinished = ref(false);
const results = ref<string>("");
const reply = ref<string>("");
const htmlReply = ref<string>("");
const loading = ref(false);

const getCurrentQuestion = () =>
  questions.find((q) => q.id === currentQuestionId.value) as Question;

// Handle button / dropdown / text inputs
function handleAnswer(option: string) {
  const question = getCurrentQuestion();
  answers.value[question.id] = option;

  // Figure out next question
  const nextId = question.next?.[option] ?? question.next?.["default"];
  if (nextId) {
    currentQuestionId.value = nextId;
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
    currentQuestionId.value = nextId;
  } else {
    quizFinished.value = true;
    results.value = mapAnswersToPrompts(answers.value);
  }
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
    <!-- Quiz Questions -->
    <div class="questions" v-if="!quizFinished && !loading">
      <h2>{{ getCurrentQuestion().question }}</h2>

      <!-- Buttons -->
      <div v-if="getCurrentQuestion().type === 'buttons'">
        <button
          v-for="option in getCurrentQuestion().options"
          :key="option"
          @click="handleAnswer(option)"
        >
          {{ option }}
        </button>
      </div>

      <!-- Text input -->
      <div v-else-if="getCurrentQuestion().type === 'text'">
        <input
          type="text"
          v-model="answers[getCurrentQuestion().id]"
          placeholder="Type your answer..."
        />
        <button @click="handleAnswer(answers[getCurrentQuestion().id] as string || '')">
          Next
        </button>
      </div>

      <!-- Dropdown -->
      <div v-else-if="getCurrentQuestion().type === 'dropdown'">
        <select
          v-model="answers[getCurrentQuestion().id]"
          @change="handleAnswer(answers[getCurrentQuestion().id] as string)"
        >
          <option disabled value="">Select one...</option>
          <option
            v-for="option in getCurrentQuestion().options"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
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
        <button @click="submitCheckbox">Next</button>
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
    </div>
  </div>
</template>


<style scoped>
.quiz {
  padding-bottom: 2rem;
}
button {
  margin: 0.25rem;
}
</style>
