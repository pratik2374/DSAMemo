# DSA Mentor - AI-Powered Coding Assistant

DSA Mentor is a React-based application designed to help users practice and master Data Structures and Algorithms (DSA) problems. It leverages Google's Gemini AI to provide a personalized, interactive tutoring experience, complete with a progressive hint system, code workspace, and progress tracking via Google Sheets.

## 🚀 Features

- **AI-Powered Assistance**: Integrated with Google Gemini to act as a virtual mentor.
- **Progressive Hint System**: 
  - Offers 5 levels of assistance, ranging from "Ultra Subtle" hints to a "Full Solution".
  - Prevents spoilers and encourages independent problem-solving.
- **Interactive Chat & Code**: 
  - Split-screen interface with a dedicated chat area and a code editor.
  - Syntax highlighting and code formatting.
- **Problem Management**:
  - Submit any DSA problem statement to start a session.
  - AI parses and contextualizes the problem automatically.
- **Smart Takeaways**:
  - Generate concise takeaways from your practice sessions.
  - **Google Sheets Sync**: Automatically save your takeaways to a Google Sheet with visual formatting (alternating colors) for easy review.
- **Customizable UI**:
  - Resizable workspace.
  - Dark/Light mode support.
  - Collapsible sidebars and descriptions.

## 🛠️ Tech Stack

- **Frontend**: React (v19), TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **AI Integration**: Google Gemini (`@google/genai`)
- **Persistence**: Google Sheets API (via customized client-side Service Account auth)
- **Utilities**: `marked` for Markdown rendering, `dompurify` for security.

## 📋 Prerequisites

- Node.js (v18 or higher recommended)
- A Google Cloud Project with:
  - Gemini API enabled.
  - Google Sheets API enabled.
  - A Service Account with permission to edit your target Google Sheet.

## 🔧 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dsa-mentor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory with the following keys:

   ```env
   # Gemini AI Configuration
   GEMINI_API_KEY=your_gemini_api_key

   # Google Sheets Integration (Service Account)
   # Note: Sensitive keys are used client-side for this personal tool.
   GOOGLE_SERVICE_ACCOUNT_TYPE=service_account
   GOOGLE_PROJECT_ID=your_project_id
   GOOGLE_PRIVATE_KEY_ID=your_key_id
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_CLIENT_EMAIL=your_service_account_email
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
   GOOGLE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
   GOOGLE_CLIENT_CERT_URL=your_client_cert_url
   GOOGLE_SHEET_ID=your_target_google_sheet_id
   ```

   > **Security Note**: This application uses a Service Account key directly in the frontend (`googleSheetsService.ts`). This is intended for **local/personal use only**. Do not deploy this to a public URL without migrating the authentication logic to a secure backend.

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## 📂 Project Structure

```
src/
├── components/         # UI Components (Sidebar, ChatArea, CodeWorkspace, etc.)
├── geminiService.ts    # Logic for interacting with Google Gemini AI
├── googleSheetsService.ts # Logic for syncing data to Google Sheets
├── App.tsx            # Main application component
├── types.ts           # TypeScript definitions
└── ...
```

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
