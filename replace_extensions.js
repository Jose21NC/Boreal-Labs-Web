import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function replaceInDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            replaceInDir(filePath);
        } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let newContent = content.replace(/(b|e|g|h|favicon|headear|quienes|taller|ambiental_1|ambiental_2|banner_hosp|entrega_cert|header_volunt|hosp_1|hosp_2|limpieza_1|logo_voluntariado|manos|ninos_1|ninos_2|ninos_3|ninos_4|refugio_1|refugio_2|volunt_3)\.(jpg|png|jpeg)/g, '$1.webp');
            if (content !== newContent) {
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`Replaced in ${filePath}`);
            }
        }
    }
}

replaceInDir(path.join(__dirname, 'src'));
replaceInDir(path.join(__dirname, 'public'));
if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    const p = path.join(__dirname, 'index.html');
    let content = fs.readFileSync(p, 'utf8');
    let newContent = content.replace(/(b|e|g|h|favicon|headear|quienes|taller|ambiental_1|ambiental_2|banner_hosp|entrega_cert|header_volunt|hosp_1|hosp_2|limpieza_1|logo_voluntariado|manos|ninos_1|ninos_2|ninos_3|ninos_4|refugio_1|refugio_2|volunt_3)\.(jpg|png|jpeg)/g, '$1.webp');
    if (content !== newContent) {
        fs.writeFileSync(p, newContent, 'utf8');
        console.log(`Replaced in index.html`);
    }
}
