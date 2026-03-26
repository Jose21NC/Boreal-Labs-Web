import re

with open("src/pages/VolunteerPage.jsx", "r") as f:
    content = f.read()

# 1. Provide success view
form_start_marker = """          <DialogHeader>"""

success_view = """          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-boreal-aqua to-boreal-purple">¡Inscripción Exitosa!</h3>
              <p className="text-gray-300 text-lg max-w-md">Gracias por querer ser parte de la Jornada Voluntaria 2026. Tu solicitud ha sido recibida correctamente.</p>
              <div className="w-full h-px bg-white/10 my-4"></div>
              <p className="text-gray-200">El siguiente paso es unirte a nuestro grupo oficial de WhatsApp para recibir todas las indicaciones.</p>
              <a 
                href="https://chat.whatsapp.com/BPaGPuFIpRQ3yppo5nJVEz?mode=gi_t" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium px-6 py-3 rounded-lg transition-colors mt-2"
              >
                Únete al Grupo de Voluntariado
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.305-.885-.653-1.482-1.46-1.656-1.758-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.571-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </a>
            </div>
          ) : (
            <>
          <DialogHeader>"""

if form_start_marker in content:
    content = content.replace(form_start_marker, success_view)
    print("Success view injected.")

form_end_marker = """          </form>"""
form_end_replacement = """          </form>
            </>
          )}"""

if form_end_marker in content:
    content = content.replace(form_end_marker, form_end_replacement)
    print("Form end patched.")

# 2. Time selector
time_options = [f"{str(h).zfill(2)}:{m}" for h in range(8, 20) for m in ["00", "30"]]
time_options.append("20:00")
time_options_jsx = "\n".join([f'                         <option value="{t}">{t}</option>' for t in time_options])

input_time_start = """                       <Input 
                         type="time" 
                         value={customTimes[dia]?.start || ''}
                         onChange={(e) => handleCustomTimeChange(dia, 'start', e.target.value)}
                         className="bg-white/5 border-white/10 text-white h-9 text-sm w-32"
                       />"""

select_time_start = f"""                       <select 
                         value={{customTimes[dia]?.start || ''}}
                         onChange={{(e) => handleCustomTimeChange(dia, 'start', e.target.value)}}
                         className="bg-[#161c2d] border border-white/10 text-white h-9 text-sm w-32 px-2 rounded-md focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors appearance-none"
                       >
                         <option value="" disabled hidden>Hora</option>
{time_options_jsx}
                       </select>"""

input_time_end = """                       <Input 
                         type="time" 
                         value={customTimes[dia]?.end || ''}
                         onChange={(e) => handleCustomTimeChange(dia, 'end', e.target.value)}
                         className="bg-white/5 border-white/10 text-white h-9 text-sm w-32"
                       />"""

select_time_end = f"""                       <select 
                         value={{customTimes[dia]?.end || ''}}
                         onChange={{(e) => handleCustomTimeChange(dia, 'end', e.target.value)}}
                         className="bg-[#161c2d] border border-white/10 text-white h-9 text-sm w-32 px-2 rounded-md focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors appearance-none"
                       >
                         <option value="" disabled hidden>Hora</option>
{time_options_jsx}
                       </select>"""

if input_time_start in content:
    content = content.replace(input_time_start, select_time_start)
    print("Start time updated.")
if input_time_end in content:
    content = content.replace(input_time_end, select_time_end)
    print("End time updated.")

with open("src/pages/VolunteerPage.jsx", "w") as f:
    f.write(content)
