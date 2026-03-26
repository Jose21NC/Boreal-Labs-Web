import re

with open("src/pages/VolunteerPage.jsx", "r") as f:
    content = f.read()

if "import { db }" not in content:
    content = content.replace("import React,", "import { db } from '../firebase';\nimport { collection, addDoc, serverTimestamp } from 'firebase/firestore';\nimport React,")

old_submit = """  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission
    setTimeout(() => {
      setIsSuccess(true);
      playSuccessSound();
      toast({
        title: "¡Inscripción recibida!",
        description: "Gracias por querer ser parte de la Jornada Voluntaria 2026. Te contactaremos pronto.",
      });
    }, 500);
  };"""

new_submit = """  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (selectedShifts.length === 0) {
      toast({ title: "Atención", description: "Por favor selecciona al menos un turno.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const data = {
        fullName: document.getElementById('fullName').value,
        edad: document.getElementById('edad').value,
        email: document.getElementById('email').value,
        whatsapp: document.getElementById('whatsapp').value,
        ciudad: document.getElementById('ciudad').value,
        talla: document.getElementById('talla').value,
        procedencia: document.getElementById('procedencia').value,
        turnos: selectedShifts,
        horariosPersonalizados: customTimes,
        fechaRegistro: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'voluntarios2026'), data);
      
      setIsSuccess(true);
      playSuccessSound();
      toast({
        title: "¡Inscripción recibida!",
        description: "Gracias por querer ser parte de la Jornada Voluntaria 2026.",
      });
    } catch (error) {
      console.error("Error guardando voluntario:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al enviar tu inscripción. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };"""

if old_submit in content:
    content = content.replace(old_submit, new_submit)

content = content.replace('<Button type="submit"', '<Button type="submit" disabled={isSubmitting}')
content = content.replace('      Completar Inscripción\n            </Button>', '      {isSubmitting ? "Enviando..." : "Completar Inscripción"}\n            </Button>')

with open("src/pages/VolunteerPage.jsx", "w") as f:
    f.write(content)
