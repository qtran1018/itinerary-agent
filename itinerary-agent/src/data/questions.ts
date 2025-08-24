import type { Question } from './types';
import { countries } from './country_list';

const questions: Question[] = [
  {
    id: 'q1',
    type: 'buttons',
    question: "Let's go on an adventure!",
    options: ['START'],
    next: {
      START: "q2"
    }
  },
  {
    id: 'q2',
    type: 'buttons',
    question: "Do you know where you want to travel to?",
    options: ['Yes', 'No'],
    next: {
      Yes: "q3",
      No: "q4"
    }
  },
  {
    id: 'q3',
    type: 'text',
    question: "Tell me where you want to go (be as specific as you want)",
    options: ['{text}'],
    next: {
      default: "q6"
    }
  },
  {
    id: 'q4',
    type: 'dropdown',
    question: "Where are you traveling from?",
    options: countries,
    next: {
      default: "q5"
    }
  },
  {
    id: 'q5',
    type: 'buttons',
    question: "Domestic or international travel?",
    options: ['Domestic', 'International'],
    next: {
      Domestic: "q6",
      International: "q6"
    }
  },
  {
    id: 'q6',
    type: 'buttons',
    question: "Looking for a cruise? (if possible)",
    options: ['Yes', 'No'],
    next: {
      Yes: "q7",
      No: "q7"
    }
  },
  {
    id: 'q7',
    type: 'buttons',
    question: "Looking for a resort-style getaway?",
    options: ['Yes', 'No'],
    next: {
      Yes: "q8",
      No: "q8"
    }
  },
  {
    id: 'q8',
    type: 'buttons',
    question: "How long do you want to travel for?",
    options: ['A few days', '1 week', '2 weeks', 'More than 2 weeks'],
    next: {
      'A few days': "q10",
      '1 week': "q10",
      '2 weeks': "q10",
      'More than 2 weeks': "q10"
    }
  },
  {
    id: 'q10',
    type: 'checkbox',
    question: "What type of traveler do you want to be on this trip?",
    options: [ //TODO: update
      'Urban explorer',
      'Nature Lover',
      'Cultural Enthusiast',
      'Relaxation Traveler',
      'Adventure/Thrill Seeker',
      'Mix of everything'
    ],
    next: {
      default: "q11"
    }
  },
  {
    id: 'q11',
    type: 'checkbox',
    question: "Any dietary restrictions?",
    options: ['Vegetarian', 'Vegan', 'Gluten-free', 'None'], //TODO: update
    next: {
      default: "q12"
    }
  },
  {
    id: 'q12',
    type: 'buttons',
    question: "How big is your travel piggy bank for this trip?",
    options: ['Luxury / No Budget Limit', 'Moderate / Mid-Range', 'Budget / Backpacker'],
    next: {
      default: "q13"
    }
  },
  {
    id: 'q13',
    type: 'buttons',
    question: "Do you prefer a packed itinerary or a relaxed pace?",
    options: ['Packed itinerary', 'Relaxed pace'],
    next: {
      default: "q14"
    }
  },
  {
    id: 'q14',
    type: 'buttons',
    question: "Who are you traveling with?",
    options: ['Solo', 'Partner', 'Family', 'Friends', 'Group'],
    next: {
      default: "q15"
    }
  },
  {
    id: 'q15',
    type: 'buttons',
    question: "Do you prefer to stay in busy areas or quiet places?",
    options: ['Busy areas', 'Quiet places'],
    next: {
      default: null
    }
  }
];

export default questions;
