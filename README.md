# IronLog AI

A smart workout logger powered by Gemini. Track your lifts, view history, and get AI-generated workout plans.

## Setup Instructions

1.  **Install Node.js**: Ensure you have Node.js installed.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure API Key**:
    - Create a file named `.env` in the root directory.
    - Add your Gemini API key:
      ```
      VITE_API_KEY=your_actual_key_here
      ```
4.  **Run Locally**:
    ```bash
    npm run dev
    ```
    Open the link shown in the terminal (usually `http://localhost:5173`).

## Building for Production

To build the app for deployment:
```bash
npm run build
```