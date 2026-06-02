import { createRouter, createWebHashHistory } from "vue-router";
import Quiz from "./components/Quiz.vue";
import Profile from "./components/Profile.vue";

const routes = [
  { path: "/", component: Quiz, meta: { title: "Planner" } },
  { path: "/profile", component: Profile, meta: { title: "My Trips" } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.afterEach((to) => {
  const page = to.meta?.title as string | undefined;
  document.title = page ? `${page} - Itinerary Agent` : "Itinerary Agent";
});

export default router;
