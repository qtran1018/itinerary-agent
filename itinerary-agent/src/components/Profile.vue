<script setup lang="ts">
import { ref, onMounted } from "vue";
import keycloak from "../keycloak";

interface TripEntry {
  id: string;
  name: string;
  type: string;
  location: string;
  notes: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  createdAt: string;
  entries: TripEntry[];
}

const props = defineProps<{ authenticated: boolean }>();

const trips = ref<Trip[]>([]);
const loading = ref(true);
const expandedTrip = ref<string | null>(null);
const exportStatus = ref<Record<string, "idle" | "exporting" | "exported" | "error">>({});
const deleteStatus = ref<Record<string, boolean>>({});

async function loadTrips() {
  if (!props.authenticated) { loading.value = false; return; }
  try {
    await keycloak.updateToken(30);
    const res = await fetch("/api/trips", {
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
    if (res.ok) trips.value = await res.json();
  } catch (e) {
    console.error("Failed to load trips", e);
  } finally {
    loading.value = false;
  }
}

async function deleteTrip(id: string) {
  if (!confirm("Delete this saved trip?")) return;
  deleteStatus.value[id] = true;
  try {
    await keycloak.updateToken(30);
    const res = await fetch(`/api/trips/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
    if (res.ok) trips.value = trips.value.filter((t) => t.id !== id);
  } finally {
    deleteStatus.value[id] = false;
  }
}

async function exportToTravelBin(trip: Trip) {
  exportStatus.value[trip.id] = "exporting";
  try {
    await keycloak.updateToken(30);
    const res = await fetch(`/api/trips/${trip.id}/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
    exportStatus.value[trip.id] = res.ok ? "exported" : "error";
  } catch {
    exportStatus.value[trip.id] = "error";
  }
}

function toggleExpand(id: string) {
  expandedTrip.value = expandedTrip.value === id ? null : id;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

onMounted(loadTrips);
</script>

<template>
  <div class="profile-page">
    <h2 class="profile-title">My Saved Trips</h2>

    <div v-if="!authenticated" class="profile-empty">
      <p>Log in to save and view your trips.</p>
    </div>

    <div v-else-if="loading" class="profile-empty">
      <p>Loading your trips…</p>
    </div>

    <div v-else-if="trips.length === 0" class="profile-empty">
      <p>No saved trips yet. Complete the planner and save your itinerary!</p>
    </div>

    <div v-else class="trips-list">
      <div v-for="trip in trips" :key="trip.id" class="trip-card">
        <!-- Header row -->
        <div class="trip-header" @click="toggleExpand(trip.id)">
          <div class="trip-header-left">
            <span class="trip-emoji">✈️</span>
            <div>
              <div class="trip-title">{{ trip.title }}</div>
              <div class="trip-meta">{{ formatDate(trip.createdAt) }} · {{ trip.entries.length }} activities</div>
            </div>
          </div>
          <span class="trip-chevron" :class="{ 'trip-chevron--open': expandedTrip === trip.id }">▾</span>
        </div>

        <!-- Expanded entries -->
        <div v-if="expandedTrip === trip.id" class="trip-entries">
          <div v-for="entry in trip.entries" :key="entry.id" class="entry-row">
            <span class="entry-badge" :class="`entry-type--${entry.type.toLowerCase().replace(/[^a-z]/g, '-')}`">
              {{ entry.type }}
            </span>
            <div class="entry-info">
              <div class="entry-name">{{ entry.name }}</div>
              <div class="entry-loc">📍 {{ entry.location }}</div>
              <div v-if="entry.notes" class="entry-note">{{ entry.notes }}</div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="trip-actions">
          <button
            class="trip-btn trip-btn--export"
            :disabled="exportStatus[trip.id] === 'exporting' || exportStatus[trip.id] === 'exported'"
            @click.stop="exportToTravelBin(trip)"
          >
            {{
              exportStatus[trip.id] === 'exporting' ? 'Exporting…'
              : exportStatus[trip.id] === 'exported' ? '✓ Sent to TravelBin'
              : exportStatus[trip.id] === 'error' ? 'Retry Export'
              : 'Export to TravelBin'
            }}
          </button>
          <button
            class="trip-btn trip-btn--delete"
            :disabled="deleteStatus[trip.id]"
            @click.stop="deleteTrip(trip.id)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}
.profile-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: var(--text-color);
}
.profile-empty {
  color: var(--text-color);
  opacity: 0.6;
  padding: 2rem 0;
}

/* Trip card */
.trips-list { display: flex; flex-direction: column; gap: 1rem; }
.trip-card {
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}
.trip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}
.trip-header:hover { background: var(--country-button-hover); }
.trip-header-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.trip-emoji { font-size: 1.5rem; line-height: 1; }
.trip-title { font-weight: 600; font-size: 1rem; color: var(--text-color); }
.trip-meta { font-size: 0.8rem; color: var(--text-color); opacity: 0.55; margin-top: 0.1rem; }
.trip-chevron { font-size: 1.1rem; color: var(--text-color); opacity: 0.5; transition: transform 0.2s ease; }
.trip-chevron--open { transform: rotate(180deg); }

/* Entries */
.trip-entries {
  border-top: 1px solid var(--border-color);
  padding: 0.75rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 380px;
  overflow-y: auto;
}
.entry-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}
.entry-row:last-child { border-bottom: none; }
.entry-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
  margin-top: 0.1rem;
  flex-shrink: 0;
}
.entry-type--food---drink  { background: #fef3c7; color: #92400e; }
.entry-type--shopping      { background: #ede9fe; color: #5b21b6; }
.entry-type--sightseeing   { background: #dbeafe; color: #1e40af; }
.entry-type--activity      { background: #dcfce7; color: #166534; }
.entry-type--other         { background: #f3f4f6; color: #374151; }
.entry-info { flex: 1; }
.entry-name { font-weight: 600; font-size: 0.9rem; color: var(--text-color); }
.entry-loc { font-size: 0.78rem; color: var(--text-color); opacity: 0.6; margin-top: 0.1rem; }
.entry-note { font-size: 0.78rem; color: var(--text-color); opacity: 0.75; font-style: italic; margin-top: 0.15rem; line-height: 1.4; }

/* Actions */
.trip-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
}
.trip-btn {
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.trip-btn:disabled { opacity: 0.55; cursor: default; }
.trip-btn:not(:disabled):hover { opacity: 0.8; transform: translateY(-1px); }
.trip-btn--export { background: #10b981; color: #fff; }
.trip-btn--delete { background: #ef4444; color: #fff; }
</style>
