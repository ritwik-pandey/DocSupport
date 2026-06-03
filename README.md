# DocPilot prototype

This repository contains the Google Apps Script code to connect to Google Docs and read its document structure, as discussed in our previous chat.

## Prerequisites

1. **Node.js & npm** installed.
2. Enable the **Google Apps Script API**: 
   - Go to [Google Apps Script Settings](https://script.google.com/home/usersettings)
   - Toggle the "Google Apps Script API" to **ON**.

## Setup & Running

Follow these steps in your terminal to deploy this code to a new Google Doc:

### 1. Install Dependencies
This installs `@google/clasp` locally and type definitions for Apps Script autocomplete in your editor.
```bash
npm install
```

### 2. Login to Google
Authenticate Clasp with your Google account. This will open a browser window.
```bash
npm run login
```

### 3. Create a Google Doc & Apps Script Project
This command will create a new Google Doc, bind an Apps Script project to it, and link your local directory.
```bash
npm run create
```
*(When prompted, you can choose to just press Enter to accept the default settings, or follow the prompts. If it fails due to existing files, just delete the newly created `.clasp.json` and try again, but it should work fine.)*

### 4. Push Code to Google Docs
Push the local `src/Code.js` and `src/appsscript.json` files to the Google Apps Script project.
```bash
npm run push
```

### 5. Open and Run
Open the newly created Google Doc in your browser:
```bash
npm run open
```

## Updating Your Code

Whenever you make changes to the code locally in VS Code (like adding new features to `src/Code.js`), you simply need to run:
```bash
npm run push
```
This will automatically upload your latest changes to the Google Doc. You **do not** need to run `login` or `create` ever again for this project. 

*(If you ever make changes directly inside the Google browser editor and want to download them to your local files, you can run `npm run pull`)*

**Inside the Google Doc:**
1. You will see a new menu item in the top bar called **"DocPilot"**. (If you don't see it immediately, refresh the page or wait a few seconds for `onOpen` to run).
2. Click **DocPilot > Get Document Data**.
3. **Authorization:** The first time you run it, Google will ask for authorization. Follow the prompts (click "Continue", select your account, click "Advanced", and click "Go to Untitled project (unsafe)").
4. Try typing some text into the document and run the menu items again to see the extracted data!
