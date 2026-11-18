# KenKen Studio

An interactive KenKen puzzle platform featuring puzzle generation, solving, validation, image-based OCR extraction, and visualization.

## Overview

KenKen Studio is a web application designed to generate, play, edit, and solve KenKen puzzles. It combines an interactive puzzle interface with a constraint-based solving engine and AI-powered image recognition to make solving KenKen puzzles easier.

## Features

- **Puzzle Generator:** Generate unique KenKen puzzles with configurable grid sizes and difficulty levels.
- **Interactive Puzzle Grid:** Play puzzles through an intuitive grid interface.
- **Puzzle Solver:** Automatically solve KenKen puzzles using a constraint-based algorithm.
- **Puzzle Validation:** Validate grid entries against KenKen rules and cage constraints.
- **Cage Editor:** Create and modify puzzle cages, targets, and mathematical operators.
- **Image OCR:** Upload puzzle images and extract grid structures, cage boundaries, targets, and operators using Gemini AI.
- **Puzzle Visualization:** Visualize puzzle structures and solving information.

## Tech Stack

**Frontend**
- JavaScript (ES6+)
- React.js
- Vite
- CSS

**Backend**
- Node.js
- Express.js

**AI Integration**
- Google Gemini API

**Tools**
- Git
- GitHub
- VS Code

## Project Structure

```text
KenKen/
├── scripts/
├── src/
│   ├── components/
│   │   ├── CageEditorPanel.jsx
│   │   ├── Header.jsx
│   │   ├── ImageOcrPanel.jsx
│   │   ├── KenKenGrid.jsx
│   │   ├── PlaySolvePanel.jsx
│   │   └── VisualizerPanel.jsx
│   ├── engine/
│   │   ├── kenkenConstants.js
│   │   ├── kenkenGenerator.js
│   │   ├── kenkenSolver.js
│   │   └── kenkenValidator.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── server.js
└── vite.config.js
```

## Getting Started

### Prerequisites

- Node.js
- npm
- Google Gemini API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/anurag10092006-cyber/kenken-studio.git
```

2. Navigate to the project directory:

```bash
cd kenken-studio
```

3. Install dependencies:

```bash
npm install
```

4. Configure environment variables.

Create a `.env` file in the root directory and add:

```env
GEMINI_API_KEY=your_gemini_api_key
```

5. Start the development server:

```bash
npm run dev
```

6. Open the application at:

```text
http://localhost:3000
```

## AI-Powered Image Recognition

KenKen Studio integrates Google's Gemini API to recognize KenKen puzzles from uploaded images.

The OCR functionality extracts puzzle information, including:
- Grid dimensions
- Cage boundaries
- Target numbers
- Mathematical operators

The extracted information is presented in an editable grid for verification before solving.

## Future Improvements

- Improve OCR accuracy for complex puzzle layouts.
- Add more puzzle sizes and difficulty levels.
- Improve solving performance.
- Deploy the application for public access.
- Add additional puzzle-solving visualizations.

## Author

**Anurag**

GitHub: [@anurag10092006-cyber](https://github.com/anurag10092006-cyber)

---

If you find this project interesting, consider giving the repository a star!
