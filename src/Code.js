/**
 * A custom menu is created when the document is opened.
 * @param {Event} e The onOpen event.
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createMenu('DocPilot')
    .addItem('Get Document Data', 'getDocumentData')
    .addItem('Log Document Structure', 'getDocumentStructure')
    .addItem('Send to Backend', 'sendToBackend')
    .addToUi();
}


function getDocumentData() {
  const doc = DocumentApp.getActiveDocument();

  if (!doc) {
    DocumentApp.getUi().alert('No active document found.');
    return;
  }

  const body = doc.getBody();
  const text = body.getText();

  Logger.log("Extracted Text: " + text);

  // Show a popup with a snippet of the data
  const snippet = text.length > 200 ? text.substring(0, 200) + "..." : text;
  DocumentApp.getUi().alert('Document Data Successfully Extracted!\n\nSnippet:\n' + snippet);
}

/**
 * Example of fetching the structure (paragraphs, headings)
 */
function getDocumentStructure() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return;

  const body = doc.getBody();
  const paragraphs = body.getParagraphs();

  let structure = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.getText();
    if (text.trim() === '') continue; // Skip empty paragraphs

    structure.push({
      text: text,
      heading: p.getHeading().name() // e.g., 'NORMAL', 'HEADING1', etc.
    });
  }

  Logger.log(JSON.stringify(structure, null, 2));
  DocumentApp.getUi().alert('Structure logged! Check the Apps Script Executions log.');
}

/**
 * Sends the document text to your Node.js backend.
 */
function sendToBackend() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    DocumentApp.getUi().alert('No active document found.');
    return;
  }

  const ui = DocumentApp.getUi();
  const promptResponse = ui.prompt('DocPilot AI', 'What would you like me to do with this document?', ui.ButtonSet.OK_CANCEL);

  if (promptResponse.getSelectedButton() !== ui.Button.OK) {
    return; // User clicked Cancel
  }

  const userPrompt = promptResponse.getResponseText();
  if (userPrompt.trim() === '') {
    ui.alert('Command cannot be empty.');
    return;
  }

  const text = doc.getBody().getText();
  const structure = getFullStructure(); // Get detailed structure

  const backendUrl = 'https://staff-tracking-supplies-maximum.trycloudflare.com/api/process';

  const payload = {
    userPrompt: userPrompt,
    documentContent: text,
    documentStructure: structure,
    source: 'Google Docs'
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      "Bypass-Tunnel-Reminder": "true" // Required to bypass Localtunnel's warning page
    },
    muteHttpExceptions: true // Useful for seeing error messages from the backend
  };

  try {
    DocumentApp.getUi().alert('Sending data to backend...');
    const response = UrlFetchApp.fetch(backendUrl, options);

    // Check if the request was successful
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());

      if (result.actions && result.actions.length > 0) {
        // Pass the actions to our execution engine!
        applyActions(result.actions);
        DocumentApp.getUi().alert('Magic complete! I have applied the changes to your document.');
      } else {
        DocumentApp.getUi().alert('Backend returned successfully, but gave no actions to perform.');
      }
    } else {
      DocumentApp.getUi().alert('Error from backend: ' + response.getContentText());
    }
  } catch (error) {
    DocumentApp.getUi().alert('Connection failed: ' + error.toString());
  }
}

