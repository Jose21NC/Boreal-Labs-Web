with open("src/App.jsx", "r") as f:
    content = f.read()

content = content.replace("import AdminGate from '@/components/AdminGate';", "import AdminGate from '@/components/AdminGate';\nimport VolunteerAdminGate from '@/components/VolunteerAdminGate';")
content = content.replace('<Route path="/voluntariado/admin" element={<AdminGate><VolunteerAdminPanel /></AdminGate>} />', '<Route path="/voluntariado/admin" element={<VolunteerAdminGate><VolunteerAdminPanel /></VolunteerAdminGate>} />')

with open("src/App.jsx", "w") as f:
    f.write(content)
