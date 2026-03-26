const fs = require('fs');

let code = fs.readFileSync('functions/index.js', 'utf8');

const target = `      // Soportar 'modalidad' o 'tipoParticipacion' según el layout
      const modalidadBox = L.modalidad || L.tipoParticipacion;
      let modalidadTextToDraw = '';
      
      if (isPonente) {
        modalidadTextToDraw = 'SPEAKER';
      } else if (isStaff) {
        modalidadTextToDraw = 'STAFF';
      } else if (isParticipante) {
        modalidadTextToDraw = (r.modalidad || r.tipoParticipacion || r.tipoAsistencia || '').toString();
      }
      
      if (modalidadBox?.rel && modalidadTextToDraw) {
        drawTextBox(modalidadTextToDraw, modalidadBox.rel, modalidadBox.style || {});
      }`;

const rep = `      // Soportar 'modalidad' o 'tipoParticipacion' según el layout
      const modalidadBox = L.modalidad || L.tipoParticipacion;
      const modalidadText = (r.modalidad || r.tipoParticipacion || r.tipoAsistencia || '').toString();
      // Solo dibujar modalidad para los participantes, evitamos dibujar para el Ponente ya que su diploma ya dice SPEAKER!
      if (modalidadBox?.rel && modalidadText && isParticipante) {
        drawTextBox(modalidadText, modalidadBox.rel, modalidadBox.style || {});
      }`;

if(code.indexOf(target) === -1) {
    console.log("NOT FOUND!");
} else {
    code = code.replace(target, rep);
    fs.writeFileSync('functions/index.js', code);
    console.log("PATCHED MODALIDAD");
}