function getFullStructure() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return [];

  const paragraphs = doc.getBody().getParagraphs();
  let structure = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.getText();

    if (text.trim() === '') continue;

    const textElement = p.editAsText();


    const fontSize = textElement.getFontSize(0);
    const isBold = textElement.isBold(0);
    const isItalic = textElement.isItalic(0);
    const fontFamily = textElement.getFontFamily(0);

    structure.push({
      text: text,
      heading: p.getHeading().name(),
      formatting: {
        fontSize: fontSize,
        isBold: isBold,
        isItalic: isItalic,
        fontFamily: fontFamily
      }
    });
  }

  return structure;
}
