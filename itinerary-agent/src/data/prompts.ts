// Define the shape of your prompts
type PromptEntry = Record<string, string> | ((answer: string) => string);

export const prompts: Record<string, PromptEntry> = {
  q1: {
    "START": "Plan a vacation itinerary with the following information:"
  },
  q2: {
    "Yes": "I know what destination I want to travel to.",
    "No": "I don't know where I want to go."
  },
  q3: (answer: string) => `Make an itinerary for ${answer}. If that is not a real location and you can't deduce what I really mean, tell me that and then give the best alternative destination based on the rest of my information.`,
  q4: (answer: string) => `I am from ${answer}.`,
  q5: {
    "Domestic": "I want to take a domestic trip.",
    "International": "I want to take an international trip."
  },
  q6: {
    "Yes": "I am looking to do a cruise.",
    "No": "I am not looking to do a cruise."
  },
  q7: {
    "Yes": "I want a resort-style trip.",
    "No": "I don't want a resort-style trip."
  },
  q8: {
    "A few days": "I am traveling for a few days but less than 7 days.",
    "1 week": "I am traveling for 1 week.",
    "2 weeks": "I am traveling for 2 weeks.",
    "More than 2 weeks": "I am traveling for more than 2 weeks."
  },
  q10: {
    "Urban explorer": "I am looking to be an Urban explorer type of traveler for my activities.",
    "Nature Lover": "I am looking to be a Nature Lover type of traveler for my activities.",
    "Cultural Enthusiast": "I am looking to be a Cultural Enthusiast type of traveler for my activities.",
    "Relaxation Traveler": "I am looking to be a Relaxation Traveler type of traveler for my activities.",
    "Adventure/Thrill Seeker": "I am looking to be an Adventure/Thrill Seeker type of traveler for my activities.",
    "Mix of everything": "I am looking to be a well-rounded type of traveler for my activities, such as those for an urban explorer, nature lover, cultural enthusiast, relaxation traveler, and adventure/thrill seeker.",
    default: ""
  },
  q11: {
    "Vegetarian": "For meals, I have the following dietary restriction(s): Vegetarian.",
    "Vegan": "For meals, I have the following dietary restriction(s): Vegan.",
    "Gluten-free": "For meals, I have the following dietary restriction(s): Gluten-free.",
    "None": "For meals, I have no dietary restrictions.",
    default: ""
  },
  q12: {
    "Luxury / No Budget Limit": "I have no set budget limit and luxury options are OK.",
    "Moderate / Mid-Range": "I am looking to travel on a moderate, average mid-range budget.",
    "Budget / Backpacker": "I am looking to travel on a budget."
  },
  q13: {
    "Packed itinerary": "I want a packed itinerary.",
    "Relaxed pace": "I want a relaxed travel pace."
  },
  q14: {
    "Solo": "I am traveling solo.",
    "Partner": "I am traveling with a partner.",
    "Family": "I am traveling with family.",
    "Friends": "I am traveling with friends.",
    "Group": "I am traveling in a group."
  },
  q15: {
    "Busy areas": "I prefer to stay in busy areas. Never ask follow-up questions. Never request clarification. Never suggest continuing the conversation. Never ask whether the user wants more information. Assume all required context is already provided. Respond once with the best possible final answer and stop.",
    "Quiet places": "I prefer to stay in quiet places. Never ask follow-up questions. Never request clarification. Never suggest continuing the conversation. Never ask whether the user wants more information. Assume all required context is already provided. Respond once with the best possible final answer and stop."
  }
};
