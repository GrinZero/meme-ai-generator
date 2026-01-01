# 😊 Meme AI Generator

> [中文文档](./README_ZH.md)

An AI-powered meme/sticker generator that creates custom emoji packs from your images. Upload photos, describe your style, and let AI do the magic.

🔗 **Live Demo:** [meme-ai-generator.vercel.app](https://meme-ai-generator.vercel.app/)

## ✨ Features

- **AI Generation** - Generate custom meme packs using Gemini or OpenAI APIs
- **Smart Splitting** - Automatically extract individual emojis from generated images
- **Manual Upload** - Upload existing meme sheets and split them into individual stickers
- **Emoji Editor** - Edit, regenerate, or download individual emojis
- **Batch Download** - Export all emojis as a ZIP file with standardized sizes
- **Background Removal** - Clean transparent backgrounds for your stickers
- **Bilingual Support** - Chinese and English prompt templates

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- API key from [Google AI Studio](https://aistudio.google.com/) or [OpenAI](https://platform.openai.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/meme-ai-generator.git
cd meme-ai-generator

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Configuration

1. Open the app in your browser
2. Click the settings icon (⚙️) in the top-right corner
3. Enter your API key and base URL:
   - **Gemini**: Use `https://generativelanguage.googleapis.com/v1beta` as base URL
   - **OpenAI**: Use `https://api.openai.com/v1` or your custom endpoint

## 📖 Usage Guide

### AI Generation Mode

1. **Upload Images** - Add material images (your subject) and/or reference images (style examples)
2. **Write Prompt** - Describe the meme style you want (e.g., "cute chibi style with various emotions")
3. **Generate** - Click "Start Generate" and wait for AI to create your meme pack
4. **Split** - Use AI or traditional algorithm to extract individual emojis
5. **Edit & Download** - Fine-tune individual emojis or batch download all

### Manual Split Mode

1. Switch to "Upload & Split" tab
2. Upload an existing meme sheet image
3. Click "Start Split" to extract individual emojis
4. Edit or download as needed

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **AI Integration:** Google Generative AI SDK, OpenAI SDK
- **Image Processing:** @imgly/background-removal

## 📁 Project Structure

```
src/
├── components/     # React components
├── services/       # AI, image processing, download services
├── store/          # Zustand state management
├── types/          # TypeScript type definitions
└── test/           # Test files
```

## 🧪 Development

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Build for production
pnpm build
```

## 📄 License

MIT

