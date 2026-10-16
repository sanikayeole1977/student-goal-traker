# StudyPulse - Student Daily Goal Tracker 🎯

A fully functional, categorized daily goal tracker web application built for students using **HTML5**, **Vanilla CSS**, and **Vanilla JavaScript**, featuring **Supabase Cloud Database persistence**, **user authentication**, **Row Level Security (RLS)** for data privacy, **real streak & analytics calculation**, and **local database failover**.

---

## 🗄️ Database & Supabase Cloud Persistence

StudyPulse supports two data persistence modes:

1. **🟡 Local Database Mode (Default / Offline)**:
   - Starts immediately out of the box with zero setup.
   - Goals, subtasks, categories, and reflections are persisted securely and privately in your browser's local storage.
2. **🟢 Supabase Cloud Database Mode**:
   - Connects to your PostgreSQL Supabase project for multi-device sync, cloud backups, and secure user accounts.
   - Enforces **Row Level Security (RLS)** so that every student's goals and study notes are strictly private.

---

## 🛠️ Step-by-Step Supabase Setup Instructions

If you want to connect your own Supabase cloud database, follow these 3 simple steps:

### Step 1: Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account or log in.
2. Click **New Project**, choose a project name (e.g., `studypulse`), set a database password, and select your region.

### Step 2: Run the Database Schema
1. In your Supabase project dashboard, navigate to **SQL Editor** on the left menu.
2. Click **New Query**.
3. Copy the entire contents of [`schema.sql`](file:///c:/Users/Student/Desktop/TTR_(032)/schema.sql) from this repository and paste it into the query editor.
4. Click **Run**. This will create the `goals`, `categories`, `subtasks`, and `daily_reflections` tables with performance indexes and strict Row Level Security (RLS) policies.

### Step 3: Connect Credentials in StudyPulse
You can connect credentials in either of two ways:
- **Method A (Direct in UI)**: Click the **"Local DB Mode"** pill or the **"Configure Supabase"** banner in the top navigation, paste your **Project URL** and **Public Anon Key** (from *Project Settings → API*), and click **"Test & Connect Supabase"**.
- **Method B (Via `config.js`)**: Open [`config.js`](file:///c:/Users/Student/Desktop/TTR_(032)/config.js) in your editor and paste:
  ```javascript
  window.STUDYPULSE_CONFIG = {
    SUPABASE_URL: "https://your-project-id.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  };
  ```

---

## 🔐 Authentication & Data Privacy

- **Student Registration & Login**: Click the account button in the top navigation to create an account or sign in with email and password.
- **Data Privacy Guarantee**: With Supabase Row Level Security (RLS) enabled on all tables:
  ```sql
  CREATE POLICY "Users can only access their own goals"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
  ```
  No student can ever query, read, or modify another student's goals or study notes.

---

## 🌟 Complete Feature Breakdown

### 1. 📂 Categorized Goal Organization
- 📚 **Academics & Studies**: Coursework, exam revisions, problem sets.
- 💻 **Coding & Tech Skills**: DSA, LeetCode, full-stack projects.
- 🏃 **Health & Fitness**: Workouts, hydration, running, sleep.
- 🧘 **Personal & Mindset**: Reading, meditation, journaling.
- 🚀 **Career & Prep**: Internships, resume tailoring, networking.
- ➕ **Custom Categories**: Add, customize (emoji + color), and delete custom categories.

### 2. 📊 Dynamic Real Statistics (No Fake Numbers!)
- **Daily Completion Ring**: Exact percentage (`%`) and ratio calculated live from actual goals on the selected date.
- **Real Streak Engine (🔥)**: Algorithms track consecutive days with completed goals.
- **Real Category Breakdown**: Live progress bar per category showing completed vs total goals.
- **7-Day Activity Matrix**: Historical performance chart calculated from real entries over the past 7 days.
- **Study Time Counter**: Sum of estimated focus minutes for completed goals.

### 3. ⏱️ Integrated Pomodoro Focus Timer
- 25-minute Focus, 5-minute Short Break, and 15-minute Long Break modes.
- Launch focus directly from any goal card.
- **Ambient Focus Noise Generator** (Web Audio API): Deep Rain (Brown noise), Soft Breeze (Pink noise), and 40Hz Binaural Gamma tone.
- Audio bell notifications and celebration confetti on completion.

### 4. 📝 Subtasks & Checklists
- Break large goals into granular steps with individual checkboxes.
- Parent goals automatically complete when all subtasks are finished.

### 5. 🗂️ Views, Search & Filtering
- **Categorized List View** vs. **Kanban Board View**.
- Live search filtering by title, category, or notes.
- Status filters: All, Active / Pending, Completed, Priority: High (🔥).

### 6. 💾 Export & Import
- Export backup snapshots to JSON format.
- Import data from backup files.
- Option to load realistic student sample goals or clear current day goals.

---

## ⌨️ Keyboard Shortcuts
- `N`: Open New Goal modal
- `P`: Open Pomodoro Focus Timer
- `Esc`: Close any open modal or drawer

---

## 🚀 How to Run
Simply open [`index.html`](file:///c:/Users/Student/Desktop/TTR_(032)/index.html) in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari).
