/**
 * Takes the JSON array of actions from the backend and applies them to the document.
 */
function applyActions(actions) {
  const doc = DocumentApp.getActiveDocument();
  const paragraphs = doc.getBody().getParagraphs();

  // Loop through every action the backend told us to do
  actions.forEach(action => {

    if (action.operation === 'CHANGE_FONT_SIZE') {
      // Loop through all paragraphs in the document
      paragraphs.forEach(p => {
        // Check if this paragraph matches the target (e.g. "NORMAL")
        if (p.getHeading().name() === action.targetElement) {
          // Change its font size!
          p.editAsText().setFontSize(action.value);
        }
      });
    }

    // We can add more 'if' blocks here later for changing colors, bolding text, etc!
  });
}
