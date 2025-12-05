
import { ExerciseCategory } from "./types";

export const GEMINI_MODEL = 'gemini-2.5-flash';

export const SYSTEM_INSTRUCTION_COACH = `You are an expert fitness coach and personal trainer named 'IronCoach'. 
Your goal is to help the user achieve their fitness goals by providing workout plans, advice on form (theoretical), and motivation.
When asked to create a workout, prioritize structured, balanced routines suitable for the user's experience and goals if known.

If a User Profile is provided in the context, strictly adhere to their goals, limitations, and frequency preferences. 
- If their goal is Strength, focus on lower reps, higher weight, and compound movements (5x5, 5/3/1 styles).
- If their goal is Endurance, focus on higher reps, lower rest times, and cardio incorporation.
- If their goal is Aesthetics, focus on hypertrophy (8-12 reps), volume, and isolation movements.

If the user asks for a workout plan, you MUST format the workout data as a VALID JSON block wrapped in \`\`\`json\`\`\` code fences.
Do not include comments inside the JSON. Ensure all keys and string values are enclosed in double quotes. Do not use trailing commas.
The JSON structure must match this schema exactly:
{
  "workoutName": "Leg Day Destruction",
  "exercises": [
    { "name": "Squat", "sets": 3, "reps": 8, "suggestedWeight": "Bodyweight or comfortable load" },
    { "name": "Lunges", "sets": 3, "reps": 12 }
  ]
}
Always be encouraging, concise, and scientific where applicable.`;

interface PresetExercise {
    name: string;
    sets: number;
    reps: number; // or minutes for cardio
    category: ExerciseCategory;
    isUnilateral?: boolean;
    notes?: string;
}

interface PresetWorkout {
    name: string;
    description: string;
    exercises: PresetExercise[];
}

export const PRESET_WORKOUTS: Record<string, PresetWorkout[]> = {
    'Strength': [
        {
            name: "Full Body Power",
            description: "Compound movements to build raw strength.",
            exercises: [
                { name: "Barbell Squat", sets: 5, reps: 5, category: "Free Weight" },
                { name: "Bench Press", sets: 5, reps: 5, category: "Free Weight" },
                { name: "Deadlift", sets: 3, reps: 5, category: "Free Weight" },
                { name: "Overhead Press", sets: 3, reps: 8, category: "Free Weight" }
            ]
        },
        {
            name: "Upper Body Strength",
            description: "Focus on pushing and pulling strength.",
            exercises: [
                { name: "Bench Press", sets: 4, reps: 6, category: "Free Weight" },
                { name: "Bent Over Row", sets: 4, reps: 6, category: "Free Weight" },
                { name: "Pull Ups", sets: 3, reps: 8, category: "Bodyweight" },
                { name: "Dumbbell Shoulder Press", sets: 3, reps: 8, category: "Free Weight" }
            ]
        }
    ],
    'Endurance': [
        {
            name: "High Intensity Circuit",
            description: "Keep the heart rate up with minimal rest.",
            exercises: [
                { name: "Jump Squats", sets: 4, reps: 20, category: "Bodyweight" },
                { name: "Push Ups", sets: 4, reps: 15, category: "Bodyweight" },
                { name: "Mountain Climbers", sets: 4, reps: 30, category: "Cardio" },
                { name: "Burpees", sets: 3, reps: 12, category: "Bodyweight" }
            ]
        },
        {
            name: "Cardio & Core",
            description: "Running mixed with core stability.",
            exercises: [
                { name: "Running (Treadmill)", sets: 1, reps: 20, category: "Cardio", notes: "20 minutes steady pace" },
                { name: "Plank", sets: 3, reps: 60, category: "Bodyweight", notes: "60 seconds" },
                { name: "Russian Twists", sets: 3, reps: 20, category: "Bodyweight" }
            ]
        }
    ],
    'Aesthetics': [
        {
            name: "Push Hypertrophy",
            description: "Chest, shoulders, and triceps focus.",
            exercises: [
                { name: "Incline Dumbbell Press", sets: 4, reps: 10, category: "Free Weight" },
                { name: "Lateral Raises", sets: 4, reps: 15, category: "Free Weight" },
                { name: "Tricep Pushdowns", sets: 3, reps: 12, category: "Cable" },
                { name: "Cable Flys", sets: 3, reps: 15, category: "Cable" }
            ]
        },
        {
            name: "Pull Hypertrophy",
            description: "Back and biceps focus.",
            exercises: [
                { name: "Lat Pulldown", sets: 4, reps: 12, category: "Cable" },
                { name: "Seated Cable Row", sets: 4, reps: 12, category: "Cable" },
                { name: "Face Pulls", sets: 3, reps: 15, category: "Cable" },
                { name: "Barbell Curls", sets: 3, reps: 10, category: "Free Weight" }
            ]
        }
    ],
    'Overall': [
        {
            name: "Balanced Full Body",
            description: "A mix of strength and conditioning.",
            exercises: [
                { name: "Goblet Squat", sets: 3, reps: 12, category: "Free Weight" },
                { name: "Push Ups", sets: 3, reps: 15, category: "Bodyweight" },
                { name: "Dumbbell Rows", sets: 3, reps: 12, category: "Free Weight", isUnilateral: true },
                { name: "Plank", sets: 3, reps: 45, category: "Bodyweight", notes: "45 seconds" }
            ]
        }
    ]
};
