import re

with open("src/pages/VolunteerPage.jsx", "r") as f:
    content = f.read()

# I want to restore it to normal first.
content = content.replace('id="talla" required placeholder="Ej. UNI, UNAN, UCA..."', 'id="procedencia" required placeholder="Ej. UNI, UNAN, UCA..."')
content = content.replace('htmlFor="talla" className="text-gray-200">Procedencia (Universidad', 'htmlFor="procedencia" className="text-gray-200">Procedencia (Universidad')

content = content.replace('id="procedencia" \n                  defaultValue=""', 'id="talla" \n                  defaultValue=""')
content = content.replace('htmlFor="procedencia" className="text-gray-200">Talla', 'htmlFor="talla" className="text-gray-200">Talla')
content = content.replace('Selecciona tu procedencia</option>', 'Selecciona tu talla</option>')

with open("src/pages/VolunteerPage.jsx", "w") as f:
    f.write(content)
