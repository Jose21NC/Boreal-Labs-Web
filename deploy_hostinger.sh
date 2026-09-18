#!/bin/bash

# Exit on error
set -e

echo "=== 1. Compilando el proyecto ==="
npm run build

echo "=== 2. Comprimiendo archivos de compilación ==="
rm -f hostinger-build.zip
cd dist
zip -r ../hostinger-build.zip .
cd ..

echo "=== 3. Subiendo build comprimido a Hostinger ==="
chmod +x upload_build.exp
./upload_build.exp

echo "=== 4. Extrayendo build en Hostinger ==="
chmod +x extract_build.exp
./extract_build.exp

echo "=== 5. Limpiando archivos temporales locales ==="
rm -f hostinger-build.zip

echo "=== ¡DESPLIEGUE COMPLETADO CON ÉXITO! ==="
