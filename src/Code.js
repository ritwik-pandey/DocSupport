/**
 * A custom menu is created when the document is opened.
 * @param {Event} e The onOpen event.
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createMenu('DocPilot')
    .addItem('Open DocPilot Copilot', 'showSidebar')
    .addItem('Get Document Data', 'getDocumentData')
    .addItem('Log Document Structure', 'getDocumentStructure')
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