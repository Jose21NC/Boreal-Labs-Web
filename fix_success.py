import re

with open("src/pages/VolunteerPage.jsx", "r") as f:
    content = f.read()

# 1. Add isSuccess state
# find const [isModalOpen, setIsModalOpen] = useState(false);
content = content.replace("const [isModalOpen, setIsModalOpen] = useState(false);", "const [isModalOpen, setIsModalOpen] = useState(false);\n  const [isSuccess, setIsSuccess] = useState(false);")

# 2. Modify handleFormSubmit
old_submit = """  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission
    setTimeout(() => {
      setIsModalOpen(false);
      toast({
        title: "¡Inscripción recibida!",
        description: "Gracias por querer ser parte de la Jornada Voluntaria 2026. Te contactaremos pronto.",
      });
    }, 500);
  };"""

new_submit = """  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission
    setTimeout(() => {
      setIsSuccess(true);
      toast({
        title: "¡Inscripción recibida!",
        description: "Gracias por querer ser parte de la Jornada Voluntaria 2026. Te contactaremos pronto.",
      });
    }, 500);
  };"""
content = content.replace(old_submit, new_submit)

# reset isSuccess when opening modal anywhere it occurs
content = content.replace("onClick={() => setIsModalOpen(true)}", "onClick={() => { setIsModalOpen(true); setIsSuccess(false); }}")

with open("src/pages/VolunteerPage.jsx", "w") as f:
    f.write(content)
print("Updated submit and states")
