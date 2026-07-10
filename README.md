# Multi-Tenant AI-Powered Support CRM with Real-Time Client Dossiers

A highly polished, high-performance, full-stack customer relationship management (CRM) and real-time support platform built with **React 18**, **Vite**, **Express**, and **WebSocket** communication. It features organization-isolated channels, instant RAG-driven AI Copilot response drafts, interactive customer dossier management, and an on-demand visitor simulator.

---

## 🚀 Key Features

### 1. 👥 Interactive Customer CRM Dossier Drawer
*   **Instant Profile Access**: Business owners and support agents can click on any customer's name, profile photo, or chat avatar to open the **Client Dossier Profile Drawer** instantly on the right sidebar.
*   **Editable Profile Cards**: Effortlessly edit customer names, company affiliations, email addresses, phone numbers, physical locations, and custom CRM relationship notes.
*   **Avatar Preset Picker**: Swiftly switch customer avatars using pre-curated high-contrast face presets.
*   **Interaction Dashboard**: Displays high-level stats, including total customer tickets opened, account creation timestamps, and live browser user-agent details.
*   **Archived Ticket History**: A scrollable history showing the status, creation times, and CSAT ratings of past tickets submitted by the active customer.

### 2. ⚡ Live Isolated WebSocket Messaging
*   **Sub-Second Message Dispatch**: Highly responsive real-time chat utilizing a native server-authoritative WebSocket channel.
*   **Strict Multi-Tenancy Isolation**: Support agents are bound strictly to their organization's tenant channel via secure JWT tokens. Customers only receive messages belonging to their specific conversations.
*   **Interactive Typing Indicators**: Live, animated `"Client is typing"` visual bounce feedback lets agents know when the customer is drafting a message.

### 3. 🤖 Intelligent AI Copilot & Suggested Drafts
*   **Live RAG Retrieval**: When a customer sends a query, the backend server initiates a RAG (Retrieval-Augmented Generation) search across indexed Knowledge Base articles.
*   **Draft Suggestions**: Proposes structured draft replies inside the Copilot tab, complete with a loading state indicating when the AI is processing knowledge vectors.
*   **Direct Editor integration**: Agents can review, live-edit, and instantly send the AI-drafted reply with a single click.
*   **Agent Feedback Log**: Integrated helpfulness rating (Thumbs Up/Down) feeds performance telemetry to the analytics database.

### 4. 🗂️ Knowledge Base (KB) Management
*   **Article Management**: Add, update, search, and categorize articles, indexing them with specific search tags and keywords for the AI Copilot to reference.
*   **Instant RAG Feeding**: Edits to KB articles instantly update the response database without server restarts.

### 5. ⏳ Live SLA & Queue Metrics
*   **SLA Countdown Warnings**: Real-time SLA monitoring alerts agents with countdown timers showing when a ticket will breach, changing colors dynamically based on urgency.
*   **Ticket Assignment**: Unassigned ticket triage, allowing quick handoffs to specific organization agents.
*   **State Filtering**: Seamlessly filter queues between Open, Pending, and Closed channels.

### 6. 🧪 Public Customer Widget Simulator (On-Demand)
*   **Self-Managed Simulator**: At startup, the CRM begins on a clean, empty canvas with no mock support tickets or simulated users. You have complete control to manage visitors on demand from the simulation panel.
*   **Custom Persona Customizer**: Customize your simulated visitor's full name, workplace organization, and email address, and select from five beautiful high-contrast avatar presets.
*   **Outage & Fallback Simulation**: Click the connection badge in the bottom-left corner to access the **Connection Console**. You can simulate a WebSocket outage to test the automatic, seamless fallback to the secure database REST polling endpoints.

### 7. 🗺️ Interactive Onboarding Tour
*   **Guided Walkthrough**: Click the help icon `(?)` on the sidebar at any time to trigger an interactive guide that explains each workspace view, the support queue, and how to operate the client simulator.

---

## 🛠️ Architecture & Tech Stack

*   **Frontend**: React 18 (TypeScript), Vite, Tailwind CSS, Lucide Icons, and Motion for sleek interface animations.
*   **Backend**: Express Server with native Node WebSocket (`ws`) layer.
*   **Database & Storage**: Fully compatible with PostgreSQL (via Cloud SQL/Drizzle) and has a JSON-based local database fallback (`/data/db.json`) for persistent local state tracking.
*   **Security**: JSON Web Token (JWT) stateless authorization, password-hashing encryption, and organization ID tenant gating on all REST and WebSocket endpoints.

---

## 📂 Project Structure

```text
├── server.ts                    # Full-stack Express & WebSocket server entrypoint
├── src/
│   ├── main.tsx                 # Client entry point
│   ├── App.tsx                  # Primary React App layout and CRM Dashboard state
│   ├── types.ts                 # Shared TypeScript interfaces & models
│   ├── components/
│   │   ├── ChatWindow.tsx       # Live chat stream, Copilot drafts, and CRM Client Dossier Drawer
│   │   ├── CustomerWidgetSimulator.tsx # Self-managed client-facing web widget sandbox with profile builder
│   │   ├── OnboardingTour.tsx   # Interactive step-by-step workspace onboarding guide
│   │   ├── AnalyticsView.tsx    # SLA charts, CSAT analysis, and volume trends
│   │   ├── KBManager.tsx        # Searchable Knowledge Base article editor
│   │   ├── SettingsView.tsx     # Custom agent settings and credentials
│   │   └── AuthScreen.tsx       # Multi-tenant Agent login and registration
│   └── server/
│       ├── auth.ts              # JWT signing, validation, and password hashing helpers
│       ├── db.ts                # File-system storage controller and mock database seeders
│       └── postgres.ts          # PostgreSQL connection & schema handlers
```

---

## ⚙️ Running Locally

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start Development Server**:
    ```bash
    npm run dev
    ```
3.  **Build Production Bundle**:
    ```bash
    npm run build
    ```
4.  **Launch Production Server**:
    ```bash
    npm run start
    ```
