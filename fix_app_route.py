import re

with open("src/App.jsx", "r") as f:
    content = f.read()

# Make sure to import volunteeradminpanel
import_admin_panel = "import AdminPanel from '@/pages/AdminPanel';"
import_volunteer_admin = "import AdminPanel from '@/pages/AdminPanel';\nimport VolunteerAdminPanel from '@/pages/VolunteerAdminPanel';"

if "import VolunteerAdminPanel" not in content:
    content = content.replace(import_admin_panel, import_volunteer_admin)


# Add route
route_admin_layout = '<Route path="/admin/layout" element={<AdminGate><LayoutEditor /></AdminGate>} />'
route_volunteer_admin = '<Route path="/admin/layout" element={<AdminGate><LayoutEditor /></AdminGate>} />\n                  <Route path="/voluntariado/admin" element={<AdminGate><VolunteerAdminPanel /></AdminGate>} />'

if "/voluntariado/admin" not in content:
    content = content.replace(route_admin_layout, route_volunteer_admin)

with open("src/App.jsx", "w") as f:
    f.write(content)
