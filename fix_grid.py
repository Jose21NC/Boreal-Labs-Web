import re

with open("src/pages/VolunteerPage.jsx", "r") as f:
    content = f.read()

procedencia_block = """              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="procedencia" className="text-gray-200">Procedencia (Universidad / Centro Educativo) *</Label>
                <Input id="procedencia" required placeholder="Ej. UNI, UNAN, UCA..." className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>"""

talla_block = """              <div className="space-y-2">
                <Label htmlFor="talla" className="text-gray-200">Talla de Camisa *</Label>
                <select 
                  id="talla" 
                  defaultValue=""
                  required
                  className="w-full px-3 py-2 rounded-md border border-white/10 bg-[#161c2d] text-white focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors appearance-none"
                >
                  <option value="" disabled hidden>Selecciona tu talla</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </div>"""

if procedencia_block in content and talla_block in content:
    content = content.replace(procedencia_block + "\n\n" + talla_block, talla_block + "\n\n" + procedencia_block)
    # also change md:col-span-2 on procedencia to make it consistent if needed, but it already has it.
    
    with open("src/pages/VolunteerPage.jsx", "w") as f:
        f.write(content)
    print("Success")
else:
    print("Blocks not found")
