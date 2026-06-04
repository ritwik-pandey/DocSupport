function getFullStructure() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return [];

  const body = doc.getBody();
  let structure = [];

  for (let i = 0; i < body.getNumChildren(); i++) {
    const child = body.getChild(i);
    const type = child.getType().toString();

    if (type === 'PARAGRAPH') {
      const p = child.asParagraph();
      if (p.getText().trim() === '') continue; // Skip empty paragraphs
      structure.push({ 
        index: i, 
        type: 'PARAGRAPH', 
        text: p.getText(), 
        heading: p.getHeading().name() 
      });
    } 
    else if (type === 'LIST_ITEM') {
      const li = child.asListItem();
      structure.push({ 
        index: i, 
        type: 'LIST_ITEM', 
        text: li.getText(), 
        glyphType: li.getGlyphType().name(),
        nestingLevel: li.getNestingLevel()
      });
    } 
    else if (type === 'TABLE') {
      const table = child.asTable();
      structure.push({ 
        index: i, 
        type: 'TABLE', 
        rows: table.getNumRows(), 
        cols: table.getRow(0).getNumCells() 
      });
    }
  }

  return structure;
}
