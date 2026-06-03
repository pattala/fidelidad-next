const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../extension-club-fidelidad/content.js');
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ --- SECCIÓN PET FOOD: Mostrar solo si el módulo está activo y el cliente tiene mascotas ---[\s\S]*?\/\/ --- TAB CANJES: Renderizar Premios ---/;

const replacement = `// --- SECCIÓN PET FOOD: Mostrar solo si el módulo está activo y el cliente tiene mascotas ---
                const petFoodSection = document.getElementById('cf-pet-food-section');
                const petListDiv = document.getElementById('cf-pet-list');
                const clientPets = selectedClient.pets || [];

                if (petFoodSection) {
                    if (enablePetModule && clientPets.length > 0) {
                        petFoodSection.style.display = 'block';
                        
                        function getPetDateHtml(pet, dateField, freqField, defaultFreq) {
                            const rawLastDate = pet[dateField];
                            const cycle = Number(pet[freqField]) || defaultFreq;
                            if (!rawLastDate) return "";
                            
                            let parsedDate = null;
                            if (typeof rawLastDate === 'object' && rawLastDate._seconds) {
                                parsedDate = new Date(rawLastDate._seconds * 1000);
                            } else {
                                parsedDate = new Date(rawLastDate + 'T12:00:00');
                            }
                            parsedDate.setDate(parsedDate.getDate() + cycle);
                            
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const diffTime = today.getTime() - parsedDate.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            
                            const formatted = parsedDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                            
                            if (diffDays > 0) {
                                return \` <span style="color:#dc2626; font-weight:900;">(venció el \${formatted} - hace \${diffDays} días)</span>\`;
                            } else {
                                return \` <span style="opacity:0.8;">(vence \${formatted})</span>\`;
                            }
                        }

                        let html = '';
                        clientPets.forEach(pet => {
                            const foodText = getPetDateHtml(pet, 'lastPurchaseDate', 'frequencyDays', 30);
                            html += \`<label style="display:flex; align-items:center; gap:4px; background:#fff7ed; border:1px solid #fed7aa; padding:4px 8px; border-radius:8px; cursor:pointer; font-size:11px; font-weight:700; color:#9a3412; margin-bottom:4px;">
                                <input type="checkbox" class="cf-pet-check" value="\${pet.id}"> \u{1F43E} Alimento \${pet.name || ''}\${foodText}
                            </label>\`;
                            
                            if ((pet.type || '').toLowerCase().trim() === 'gato') {
                                const litterText = getPetDateHtml(pet, 'lastLitterPurchaseDate', 'litterFrequencyDays', 15);
                                html += \`<label style="display:flex; align-items:center; gap:4px; background:#f3f4f6; border:1px solid #d1d5db; padding:4px 8px; border-radius:8px; cursor:pointer; font-size:11px; font-weight:700; color:#374151; margin-bottom:4px;">
                                    <input type="checkbox" class="cf-litter-check" value="\${pet.id}"> \u{1F4A8} Piedras \${pet.name || ''}\${litterText}
                                </label>\`;
                            }
                        });
                        
                        petFoodSection.innerHTML = html;
                        // Ocultamos el contenedor original porque lo sobreescribimos
                        if (petListDiv) petListDiv.style.display = 'none';

                    } else {
                        petFoodSection.style.display = 'none';
                    }
                }

                // --- TAB CANJES: Renderizar Premios ---`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully patched content.js section!');
} else {
    console.error('Regex did not match!');
}
