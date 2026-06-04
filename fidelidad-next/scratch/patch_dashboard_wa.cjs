const fs = require('fs');
let c = fs.readFileSync('src/modules/admin/components/GlobalAlerts.tsx', 'utf8');

const targetStr = `                                                <button onClick={() => {
                                                    const phone = (c.clientPhone || '').replace(/\\D/g, '');
                                                    let p = phone;
                                                    if (p && !p.startsWith('54') && p.length === 10) p = '549' + p;
                                                    window.open(\`https://api.whatsapp.com/send?phone=\${p}&text=\${encodeURIComponent('¡Hola! Tu código para la Caja Sorpresa es: ' + chanceUrl)}\`, '_blank');
                                                }} className="bg-orange-500/20 text-orange-400 py-3 rounded-2xl text-[10px] font-black transition-all hover:scale-[1.02]">
                                                    🔄 RE-ENVIAR LINK POR WHATSAPP
                                                </button>`;

const replacementStr = `                                                <button onClick={async (e) => {
                                                    const btn = e.currentTarget;
                                                    const originalText = btn.innerText;
                                                    btn.innerText = '...';
                                                    btn.style.opacity = '0.5';
                                                    btn.style.pointerEvents = 'none';

                                                    try {
                                                        const res = await fetch(\`\${config?.apiUrl || ''}/api/regenerate-mystery-box\`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json', 'x-api-key': config?.apiKey || '' },
                                                            body: JSON.stringify({ alertId: c.id })
                                                        });
                                                        const data = await res.json();
                                                        if (!data.ok) throw new Error(data.error || 'Error desconocido');
                                                        
                                                        const pwaUrl = config?.contact?.pwaUrl || window.location.origin;
                                                        const newChanceUrl = \`\${pwaUrl}/play/\${data.newId}\`;

                                                        const phone = (c.clientPhone || '').replace(/\\D/g, '');
                                                        let p = phone;
                                                        if (p && !p.startsWith('54') && p.length === 10) p = '549' + p;
                                                        window.open(\`https://api.whatsapp.com/send?phone=\${p}&text=\${encodeURIComponent('¡Hola! Tu código para la Caja Sorpresa es: ' + newChanceUrl)}\`, '_blank');
                                                    } catch (err: any) {
                                                        alert("Error al regenerar código: " + err.message);
                                                    } finally {
                                                        btn.innerText = originalText;
                                                        btn.style.opacity = '1';
                                                        btn.style.pointerEvents = 'auto';
                                                    }
                                                }} className="bg-orange-500/20 text-orange-400 py-3 rounded-2xl text-[10px] font-black transition-all hover:scale-[1.02]">
                                                    🔄 RE-ENVIAR LINK POR WHATSAPP
                                                </button>`;

c = c.replace(targetStr, replacementStr);
fs.writeFileSync('src/modules/admin/components/GlobalAlerts.tsx', c);
console.log("Patched GlobalAlerts for Mystery Box regeneration");
