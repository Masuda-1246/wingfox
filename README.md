<p align="center">
  <img src="apps/web/public/logo.png" alt="WingFox" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Hono-🔥-E36002?logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Mistral_AI-Powered-FF7000?logo=data:image/svg+xml;base64,&logoColor=white" alt="Mistral AI" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

# WingFox - AI Matchmaking Agent

Your personal fox AI that finds your ideal partner.

## What is WingFox?

WingFox reimagines dating apps by replacing the exhausting cycle of swiping, messaging, and small talk with an AI fox agent that truly understands you. Instead of writing your own profile and chatting with strangers, your WingFox handles it all — finding compatible matches through genuine personality analysis.

## How It Works

1. **Personality Quiz** — Answer quick multiple-choice questions about your lifestyle, values, and communication style (2-3 min).
2. **Speed Dating with AI Personas** — You show who you are in conversation, not in a bio. WingFox gets that. Chat with virtual AI characters tailored to your quiz results. Your real communication style (humor, rhythm, openness) is captured as your **Interaction DNA**.
3. **Fox Insight Report** — Review what your fox learned about you and fine-tune its understanding through conversation.
4. **Fox-to-Fox Matching** — Your fox chats with other users' foxes behind the scenes, scoring compatibility across five dimensions.
5. **Results & Connection** — Browse matches ranked by compatibility, read the fox conversation logs, then gradually connect:
   - **Step 1**: Read the AI conversation between your foxes
   - **Step 2**: Chat directly with your match's fox to get a feel for their personality
   - **Step 3**: Chat with the real person

## Compatibility Scoring

Matches are evaluated on five dimensions derived from Interaction DNA:

| Dimension | What it measures |
|---|---|
| Rhythm Sync | Conversational tempo and comfort with silence |
| Humor Resonance | Shared sense of humor and worldview |
| Self-Disclosure Harmony | Mutual vulnerability and acceptance |
| Thought Jump Rate | How similarly two people free-associate between topics |
| Trust Factor | Consistency between stated preferences and actual behavior |

## Setup

### Prerequisites

- [mise](https://mise.jdx.dev/) must be installed

### Steps

1. **Install tools with mise**

   ```bash
   mise install
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start the development server**

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:3000
   - API: See each app's configuration

## CI & PR Merge Blocking

- **pre-commit**: `pnpm format` and `pnpm build` run automatically before each commit.
- **CI**: PRs targeting `main` / `develop` trigger format check, build, and lint via `.github/workflows/ci.yml`.
- To enforce merge blocking, enable required status checks in GitHub branch protection. See [.github/REQUIRE_CI_FOR_MERGE.md](.github/REQUIRE_CI_FOR_MERGE.md) for details.
