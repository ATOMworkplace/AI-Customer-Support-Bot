# AI Customer Support Bot

An advanced, full-stack AI chatbot designed to simulate dynamic, persona-driven customer support interactions. This project uses a sophisticated multi-step LLM logic flow, including intent classification, semantic search via vector embeddings, and contextual memory to provide intelligent, human-like responses across various business scenarios.

## Features

-   **Dynamic Persona System:** Select from multiple business scenarios (e.g., Luxury Watch Retailer, Fast-Fashion Brand) on the frontend to dynamically change the bot's persona, tone, and knowledge base.
-   **Multi-Step LLM Logic:** The bot doesn't just answer questions; it thinks.
    -   **Intent Classification:** Determines the user's goal (e.g., asking a question, making a complaint, requesting a summary).
    -   **Sentiment Analysis:** Gauges the user's emotion (positive, neutral, negative) to inform responses.
-   **Advanced Semantic Search:** Utilizes **Vector Embeddings** and cosine similarity to find the most relevant FAQ, even if the user's phrasing doesn't exactly match the question in the knowledge base. This provides a much more accurate and flexible understanding of user queries.
-   **Interactive Complaint Triage:** Instead of immediately escalating, the bot initiates a multi-step dialogue to gather key information (like an order number and issue description) when a user has a problem.
-   **On-Demand Summarization:** The bot can summarize the current conversation when requested by the user, a feature powered by a dedicated LLM prompt.
-   **Open-Domain Chitchat:** When a query doesn't match any FAQ, the bot can use the LLM's general knowledge to engage in conversational chitchat, guided by its current persona.
-   **Graceful Escalation:** For sensitive issues or direct requests, the bot summarizes the conversation and provides a clean handoff message for a human agent.
-   **Modern & Responsive Frontend:** A clean, minimalist React interface that's easy to use and optimized for desktop viewing.

## Tech Stack

| Area      | Technology                                                                         |
| :-------- | :--------------------------------------------------------------------------------- |
| **Backend** | Node.js, Express.js, SQLite, Axios, Dotenv                                         |
| **Frontend** | React (with Create React App), Axios                                               |
| **AI / LLM** | Generic LLM APIs (e.g., OpenAI) for: Chat Completions, Text Embeddings (`text-embedding-ada-002`) |
| **Libraries** | `cosine-similarity` for vector search                                              |

## Project Structure

The project is organized into two main folders: a backend server and a frontend client.

```
ai-support-bot-backend/
├── data/
│   └── scenarios.json
├── node_modules/
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── chatController.js
│   │   └── routes/
│   │       └── chatRoutes.js
│   ├── config/
│   │   └── index.js
│   ├── database/
│   │   └── database.js
│   └── services/
│       ├── chatService.js
│       └── llmService.js
├── .env
├── chat_sessions.db
├── package.json
└── ...
```

```
ai-support-bot-frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── ChatInput.js
│   │   ├── ChatWindow.js
│   │   └── Message.js
│   ├── App.css
│   ├── App.js
│   └── index.js
├── .env
├── package.json
└── ...
```

## Setup and Installation

### Prerequisites

-   Node.js (v20.19+ or v22.12+ recommended)
-   `nvm` (Node Version Manager) is recommended for managing Node.js versions.
-   An API Key from an LLM provider (e.g., OpenAI).

### 1. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd ai-support-bot-backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create the environment file:**
    Create a file named `.env` in the `ai-support-bot-backend` root directory and add the following variables. **Replace the placeholder values with your actual credentials.**
    ```env
    # The port your backend server will run on
    PORT=8000

    # Your LLM provider API Key
    LLM_API_KEY="sk-YourActualKeyGoesHere"

    # API endpoints for chat and embeddings
    LLM_API_ENDPOINT="[https://api.openai.com/v1/chat/completions](https://api.openai.com/v1/chat/completions)"
    LLM_EMBEDDING_ENDPOINT="[https://api.openai.com/v1/embeddings](https://api.openai.com/v1/embeddings)"
    ```
4.  **Start the backend server:**
    ```bash
    npm run dev
    ```
    The server should now be running on `http://localhost:8000`.

### 2. Frontend Setup

1.  **Open a new, separate terminal.**
2.  **Navigate to the frontend directory:**
    ```bash
    cd ai-support-bot-frontend
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Start the frontend development server:**
    ```bash
    npm start
    ```
    The server will likely detect that port 3000 is in use and ask to run on another port. Press `Y` to confirm. A browser window should automatically open to `http://localhost:3001`.

## How It Works: The Logic Flow

The application's intelligence comes from a sophisticated, multi-step logic flow managed by the backend.

1.  **Scenario Selection:** The user selects a business persona (e.g., "Luxury Watch Retailer") on the frontend.
2.  **Session Start (`/api/chat/start`):** The chosen `scenario` is sent to the backend. A unique session is created in the database, linking the `sessionId` with the selected `scenario`, a default `state` ('IDLE'), and an empty `context`.
3.  **Message Processing (`/api/chat/message`):** When the user sends a message, the following sequence occurs in `chatService.js`:
    1.  **State Check:** The service first checks the session's `state`. If it's not 'IDLE' (e.g., 'AWAITING_ORDER_NUMBER'), it follows a pre-defined conversational flow to gather information before proceeding.
    2.  **Intent Classification:** If the state is 'IDLE', the message is sent to `llmService` to classify its **intent** (e.g., `FAQ_QUESTION`, `COMPLAINT`, `SUMMARIZE_CONVERSATION`).
    3.  **Logic Routing:** A `switch` statement routes the request based on the classified intent.
    4.  **Semantic Search (for `FAQ_QUESTION`):** This is the core of the AI's knowledge retrieval.
        -   **Vector Embedding:** The user's query is converted into a numerical vector using an embedding model.
        -   **Similarity Search:** This vector is mathematically compared (using cosine similarity) against a pre-calculated cache of vectors for all FAQs in the current scenario.
        -   **Contextual Answering:** If a strong match is found (above a similarity threshold of 0.8), the relevant Q&A pair is used by the LLM to generate a natural, context-aware answer.
    5.  **General Knowledge:** If the semantic search finds no good match, or if the intent is `CHITCHAT`, the bot uses a different prompt to answer from the LLM's general knowledge, guided by the selected persona.
    6.  **Triage & Escalation:** For `COMPLAINT` or `REQUEST_FOR_HUMAN` intents, the bot either initiates the interactive triage workflow or immediately generates a conversation summary and prepares for a human handoff.

## API Endpoints

### `POST /api/chat/start`

Initializes a new chat session with a specific scenario.

-   **Request Body:**
    ```json
    {
      "scenario": "luxury_watches"
    }
    ```
-   **Success Response (201):**
    ```json
    {
      "sessionId": "a-unique-session-id"
    }
    ```

### `POST /api/chat/message`

Sends a message within an existing session and gets a reply.

-   **Request Body:**
    ```json
    {
      "sessionId": "the-session-id-from-start",
      "message": "What is your warranty policy?"
    }
    ```
-   **Success Response (200):**
    ```json
    {
      "reply": "Every timepiece we sell is covered by a minimum two-year international manufacturer's warranty..."
    }
    ```

## Prompt Engineering

The `llmService.js` file contains a hub of specialized prompts, each designed for a specific task:

-   `intentClassification`: A highly-structured prompt that forces the LLM to act as a classifier and return a single JSON object with the user's intent.
-   `sentimentAnalysis`: A simple prompt to classify the user's emotion.
-   `faqFinder`: (Now Replaced by Vector Embeddings) The previous version used a prompt to find relevant FAQs. This has been upgraded to a more reliable mathematical approach.
-   `contextualAnswer`: Instructs the LLM to answer a user's question naturally, using only a single, highly-relevant piece of Q&A context that was found via semantic search.
-   `generalResponse`: A more open-ended prompt that allows the LLM to be conversational and use its general knowledge, but still guided by the selected persona and equipped with safety guardrails.
-   `conversationSummary`: Asks the LLM to act as a helpful assistant and create a concise summary of the chat history for a human agent.

## How to Demo the Project

1.  Ensure both backend and frontend servers are running.
2.  Open the frontend URL in your browser.
3.  **Showcase Scenario Selection:** Choose a scenario, like "Fast-Fashion Streetwear Brand."
4.  **Test Semantic Search:**
    -   Ask an inexact question: `"what kind of stuff do you guys have?"` (Should match "What do you sell?")
    -   Ask a direct FAQ: `"what's the return policy?"`
5.  **Test General Chitchat:**
    -   Ask an out-of-scope question: `"what are the biggest streetwear trends right now?"` (The bot should answer conversationally).
6.  **Test Interactive Triage:**
    -   Initiate a complaint: `"there's a problem with my order"`
    -   Follow the bot's prompts for order number and issue description.
7.  **Test Summarization:**
    -   After a few turns, ask: `"can you summarize our conversation?"`
8.  **Switch Scenarios:** Refresh the page and select "Luxury Watch Retailer." Ask the same questions to demonstrate how the bot's knowledge and tone have completely changed.
