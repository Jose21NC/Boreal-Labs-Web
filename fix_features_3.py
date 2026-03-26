import re

with open("src/pages/VolunteerPage.jsx", "r") as f:
    content = f.read()

# 1. Update toggleShift logic to exclude morning/afternoon when custom is selected
old_toggle = """  const toggleShift = (shift) => {
    setSelectedShifts(prev => 
      prev.includes(shift) ? prev.filter(s => s !== shift) : [...prev, shift]
    );
  };"""

new_toggle = """  const toggleShift = (shift) => {
    setSelectedShifts(prev => {
      if (prev.includes(shift)) {
        return prev.filter(s => s !== shift);
      } else {
        let newShifts = [...prev, shift];
        const [dia, tipo] = shift.split('-');
        if (tipo === 'Personalizado') {
          newShifts = newShifts.filter(s => s !== `${dia}-Mañana` && s !== `${dia}-Tarde`);
        } else {
          newShifts = newShifts.filter(s => s !== `${dia}-Personalizado`);
        }
        return newShifts;
      }
    });
  };"""

if old_toggle in content:
    content = content.replace(old_toggle, new_toggle)
    print("toggle updated")

# Play sound on success
old_submit = """  const handleFormSubmit = (e) => {
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

new_submit = """  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // A6
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) {
      console.log('Audio no soportado', e);
    }
  };

  const handleFormSubmit = (e) => {
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

if old_submit in content:
    content = content.replace(old_submit, new_submit)
    print("submit updated")

# Update whatsapp placeholder
content = content.replace('placeholder="+505 0000 0000"', 'placeholder="80123456"')

# Fix AM/PM format
def convert_to_ampm(time_str):
    h, m = time_str.split(':')
    h = int(h)
    am_pm = "AM" if h < 12 else "PM"
    h_12 = h if h <= 12 else h - 12
    if h_12 == 0: h_12 = 12
    return f"{str(h_12).zfill(2)}:{m} {am_pm}"

time_options = [f"{str(h).zfill(2)}:{m}" for h in range(8, 20) for m in ["00", "30"]]
time_options.append("20:00")

old_options_str = "\n".join([f'                         <option value="{t}">{t}</option>' for t in time_options])
new_options_str = "\n".join([f'                         <option value="{t}">{convert_to_ampm(t)}</option>' for t in time_options])

if old_options_str in content:
    content = content.replace(old_options_str, new_options_str)
    print("AM/PM updated")

with open("src/pages/VolunteerPage.jsx", "w") as f:
    f.write(content)
print("done")
