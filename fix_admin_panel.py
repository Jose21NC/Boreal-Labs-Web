with open("src/pages/VolunteerAdminPanel.jsx", "r") as f:
    content = f.read()

# Remove 'Panel General' button
btn_target = """                        <Button 
                            onClick={() => window.open('/admin', '_blank')}
                            className="bg-boreal-purple hover:bg-purple-600 text-white transition-all shadow-lg"
                        >
                            Panel General
                        </Button>"""

if btn_target in content:
    content = content.replace(btn_target, "")
    print("Panel button removed")

with open("src/pages/VolunteerAdminPanel.jsx", "w") as f:
    f.write(content)
