# LexiHub - Legal AI Core (法律垂直领域 AI 智能体)

**LexiHub** is a next-generation vertical AI platform designed for the legal industry. It has evolved from a simple information aggregator into a powerful **AI Agent** capable of intent recognition, grounded search, structured lead generation, and professional RAG-based legal assistance.

Now featuring **Cloud Sync** powered by **Supabase**, allowing seamless transition between Guest Mode (Local) and User Mode (Cloud).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/react-19.0-61dafb.svg)
![Supabase](https://img.shields.io/badge/Supabase-Auth_&_DB-3ecf8e.svg)
![Gemini](https://img.shields.io/badge/AI-Gemini_3.0-8e75b2.svg)

---

## 🌟 Core Features (核心功能)

### 1. 🕵️‍♂️ Intelligent Lead Discovery Agent (智能线索挖掘)
A fully autonomous workflow to find legal service providers or case opportunities.
*   **Intent Recognition**: Parses queries (e.g., "Divorce lawyer in Shanghai") to extract key fields.
*   **Grounded Search**: Uses **Gemini Search Tool** for real-time, grounded web searches.
*   **Structured Extraction**: Converts unstructured search results into a clean table (Firm, Contact, Phone, Address).
*   **Export**: One-click `.csv` export.

### 2. 📂 Personal Workspace & RAG (个人工作台)
Your private knowledge base for legal analysis.
*   **Guest vs. Cloud Mode**:
    *   **Guest**: Data stored in browser `localStorage`.
    *   **User**: Log in via Google/GitHub to sync documents to **Supabase**.
*   **Document Import**: Support for PDF, Word, Excel, and Text files.
*   **AI Strategic Audit**: Deep analysis generating Risk Scores (0-100), Executive Summaries, and Actionable Insights.
*   **RAG Chat**: The AI Assistant retrieves context specifically from your uploaded workspace documents.

### 3. 💬 AI Legal Assistant (法律 AI 助手)
*   **Context Switching**: Toggle between "Public Knowledge" (General Laws) and "My Workspace" (Private RAG).
*   **Citation Support**: Provides source references for every claim.

### 4. 📖 User Manual (用户手册)
*   A built-in, bilingual (English/Chinese) interactive guide to help users master the platform.

### 5. 📊 Executive Dashboard (数据看板)
*   Real-time tracking of leads generated and queries.
*   Persistent statistics for logged-in users.

---

## 🛠 Tech Stack

*   **Frontend**: React 19, Vite, TypeScript, Tailwind CSS
*   **Backend / BaaS**: **Supabase** (Auth, PostgreSQL, Row Level Security)
*   **AI Models**: Google Gemini 2.0 Flash (Default), DeepSeek V3 (Optional)
*   **Deployment**: Vercel

---

## 🚀 Getting Started

### Prerequisites
1.  Node.js 18+
2.  **Google Gemini API Key** (Required for Search Agent)
3.  **Supabase Project** (Free Tier is sufficient)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/jay870423/LexiHub-Legal-AI.git
    cd lexihub
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    # AI Keys
    API_KEY=your_google_gemini_api_key_here

    # Supabase Configuration
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Database Setup (Supabase)**
    Go to your Supabase SQL Editor and run the following script to create tables and security policies:

    ```sql
    -- 1. Documents Table
    create table documents (
      id uuid default gen_random_uuid() primary key,
      user_id uuid references auth.users(id) not null,
      title text not null,
      content text,
      category text,
      tags text[],
      ai_analysis jsonb,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null,
      updated_at timestamp with time zone default timezone('utc'::text, now()) not null
    );

    -- 2. User Stats Table
    create table user_stats (
      user_id uuid references auth.users(id) primary key,
      leads_generated integer default 0,
      queries_count integer default 0,
      last_active_at timestamp with time zone default timezone('utc'::text, now())
    );

    -- 3. Enable RLS (Security)
    alter table documents enable row level security;
    alter table user_stats enable row level security;

    -- 4. Policies (Simple Isolation)
    create policy "Users manage own docs" on documents for all using (auth.uid() = user_id);
    create policy "Users manage own stats" on user_stats for all using (auth.uid() = user_id);

    -- 5. Auto-create Stats Trigger
    create or replace function public.handle_new_user() returns trigger as $$
    begin
      insert into public.user_stats (user_id) values (new.id);
      return new;
    end;
    $$ language plpgsql;

    create trigger on_auth_user_created after insert on auth.users
      for each row execute procedure public.handle_new_user();
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```

---

## ⚙️ Configuration

### AI Providers
Switch providers dynamically in the **Settings** tab.
*   **Gemini**: Requires `API_KEY`. Supports Search Grounding.
*   **DeepSeek**: Requires custom API Key. Use "Vercel Proxy" setting if you encounter CORS issues.

### Auth Providers
To enable Google/GitHub login:
1.  Go to Supabase Dashboard -> Authentication -> Providers.
2.  Enable Google/GitHub and paste your Client IDs and Secrets.
3.  Add `https://<your-project>.supabase.co/auth/v1/callback` to your OAuth Provider's authorized redirect URIs.

---

## 👨‍💻 Author

**Developed by Liang Yajie**
*   **X (Twitter)**: [@LiangYajie70258](https://x.com/LiangYajie70258)
*   **WeChat**: `yajie870423`

*This project is for educational and demonstration purposes in the legal tech domain.*
