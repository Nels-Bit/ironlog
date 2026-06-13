# 🏋️‍♂️ Iron Log

![Iron Log](https://via.placeholder.com/1000x500.png?text=Iron+Log+-+Workout+Tracker)

**Iron Log** is a modern, high-performance Progressive Web Application (PWA) designed for athletes to seamlessly log their workouts, track volume load, and break personal records. Built with an emphasis on speed and a dark, high-contrast aesthetic, it ensures your focus remains purely on the training.

## ✨ Features

- **Offline-Tolerant Logging:** Active workout sessions are cached locally. You'll never lose your session data if you accidentally close the app, refresh, or lose connection mid-workout.
- **Smart Set Generation (Ghost Data):** Automatically pulls in your previous workout's sets, reps, and weights for a specific exercise as placeholder "ghost data," making repeated workouts a breeze to log.
- **Progress Tracking:** Real-time volume load calculations and Personal Record (PR) tracking.
- **PWA Ready:** Fully installable on iOS and Android for a native app-like experience directly from the browser.
- **Secure Authentication:** User management and data persistence are handled robustly via Supabase Auth and PostgreSQL.

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4, Lucide React (Icons)
- **State Management:** React Context API with `localStorage` for session persistence
- **Backend & Database:** Supabase (PostgreSQL, Auth)
- **Deployment:** Vercel

## 🛠️ Local Development Setup

To run this project locally, you will need Node.js installed and a Supabase project set up.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/iron-log.git
   cd iron-log
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory based on the example provided:
   ```bash
   cp .env.example .env
   ```
   Then, update the `.env` file with your actual Supabase credentials.

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

## 🏗️ Architecture Highlights

- **`WorkoutContext.tsx`:** The core engine powering the active workout session. It manages the workout timer, handles the dynamic creation of sets/exercises, and computes the total volume load upon workout completion.
- **Service Layer (`src/services/`):** Clean, decoupled abstractions over the Supabase client (`authService.ts`, `workoutService.ts`). This ensures the UI components remain agnostic of direct database queries, improving maintainability.
- **CSS Utility Pattern:** Uses `clsx` and `tailwind-merge` for predictable, dynamic utility class construction across UI components.

## 📝 License

This project is open-source and available under the MIT License.
