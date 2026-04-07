# Christie MOC Validation Survey

A React-based web application designed to collect and aggregate observer data for Christie MOC validation. The application guides observers through a structured evaluation process, capturing their perceptual feedback on baseline and corrected image frames.

## Features

- **Observer Tracking**: Automatically generates sequential observer IDs (e.g., OBS-001) and tracks demographic data (Age, Gender).
- **Two-Phase Evaluation**: 
  - **Baseline Phase**: Evaluates initial match accuracy and chromatic bias.
  - **Corrected Phase (MOC)**: Evaluates corrected match accuracy, residual bias, and perceptual artifacts (loss of luminance/saturation).
- **Smart Logic**: Automatically disables and resets non-applicable questions (e.g., perceptual artifacts are disabled if the match accuracy is rated as "Perfect").
- **Custom UI**: Features custom-styled sliders for chromatic bias (Magenta to Green gradient) and intuitive scoring buttons.
- **Data Persistence**: Automatically saves progress to the browser's `localStorage` to prevent data loss if the page is accidentally refreshed.
- **CSV Export**: Aggregates all observer data into a clean, formatted CSV file for analysis.

## Tech Stack

- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Hooks + LocalStorage

## Local Development

To run this project locally on your machine:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Deployment

Because this is a completely client-side application (data is stored in the browser and exported directly), it can be hosted for free on any static hosting provider.

### Recommended: Vercel or Netlify
1. Push this repository to your GitHub account.
2. Log in to [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
3. Click "Add New Project" and select your GitHub repository.
4. The platform will automatically detect the Vite setup and deploy your site.

### GitHub Pages
You can also host this directly from your GitHub repository using GitHub Pages via GitHub Actions (using the Node.js / Static HTML workflow).

## Data Management Note

All survey data is stored locally in the browser running the application (`localStorage`). 
- **Do not clear your browser cache/data** while actively collecting survey responses, or you will lose the history.
- Always **Export to CSV** at the end of your testing sessions to secure your data.
