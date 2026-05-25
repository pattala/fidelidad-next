const fs = require('fs');

const originalHtml = fs.readFileSync('scratch/mockup.html', 'utf8');

// 1. Fix CSS closing tag in head
let html = originalHtml.replace('</script>\r\n</head>', '</style>\r\n</head>');
html = html.replace('</script>\n</head>', '</style>\n</head>');
// Also look for </script> after email-body
html = html.replace('email-body { padding: 20px; background-color: #ffffff; color: #374151; font-size: 15px; line-height: 1.6; }\r\n    </script>', 'email-body { padding: 20px; background-color: #ffffff; color: #374151; font-size: 15px; line-height: 1.6; }\r\n    </style>');
html = html.replace('email-body { padding: 20px; background-color: #ffffff; color: #374151; font-size: 15px; line-height: 1.6; }\n    </script>', 'email-body { padding: 20px; background-color: #ffffff; color: #374151; font-size: 15px; line-height: 1.6; }\n    </style>');

// 2. Fix WhatsApp formatting inside the script tag at the bottom
// Replace alert preview with actual preview modals logic from mockup2
const originalScript = `    <script>
        function previewMail(titleId, bodyId) {
            const title = document.getElementById(titleId).value;
            const body = document.getElementById(bodyId).value;
            alert('VISTA PREVIA DE EMAIL:\\n\\nAsunto: ' + title + '\\n\\nCuerpo:\\n' + body + '\\n\\n(El sistema lo envuelve en HTML con tu logo)');
        }
        function previewWhatsApp(bodyId) {
            const body = document.getElementById(bodyId).value;
            alert('VISTA PREVIA WHATSAPP:\\n\\n' + body);
        }
    </script>`;

const realPreviewScriptHtml = `
    <!-- Modals -->
    <div id='mailModal' class='modal'>
        <div class='modal-content'>
            <div class='flex justify-between items-center mb-4'>
                <h2 class='text-xl font-bold text-gray-800'>Vista Previa Email</h2>
                <button onclick='document.getElementById(\"mailModal\").style.display=\"none\"' class='text-gray-500 hover:text-red-500 font-bold text-xl'>&times;</button>
            </div>
            <div class='email-container shadow-sm'>
                <div class='email-header'>
                    <div class='text-xs text-gray-500 mb-1'>Asunto:</div>
                    <div id='mailSubject' class='font-bold text-gray-800'></div>
                </div>
                <div class='p-4 bg-gray-50 flex justify-center'>
                    <div class='w-20 h-8 bg-gray-300 rounded animate-pulse'></div>
                </div>
                <div class='email-body' id='mailBody'>
                </div>
                <div class='p-4 bg-gray-100 text-xs text-center text-gray-500'>
                    Footer de tu empresa
                </div>
            </div>
        </div>
    </div>

    <div id='waModal' class='modal'>
        <div class='modal-content bg-[#efeae2] relative'>
            <!-- Fake Header -->
            <div class='absolute top-0 left-0 w-full bg-[#075e54] text-white p-3 rounded-t-xl flex items-center gap-3'>
                <div class='w-8 h-8 bg-white rounded-full'></div>
                <div class='font-bold'>Tu Negocio</div>
            </div>
            
            <div class='pt-16 pb-4 px-2 flex flex-col'>
                <!-- Fake Customer Message -->
                <div class='bg-white p-2 rounded-lg rounded-tr-none self-end max-w-[80%] text-sm mb-4'>
                    Hola, quiero saber mis puntos.
                </div>
                <!-- Our Template Message -->
                <div class='wa-bubble' id='waBody'>
                </div>
            </div>
            
            <button onclick='document.getElementById(\"waModal\").style.display=\"none\"' class='mt-4 w-full bg-gray-800 text-white py-2 rounded-lg font-bold'>Cerrar Simulación</button>
        </div>
    </div>

    <script>
        // Formateador simple de asteriscos a negritas
        function formatWhatsApp(text) {
            let formatted = text.replace(/\\*([^\\*]+)\\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/\\n/g, '<br>');
            return formatted;
        }

        function formatMail(text) {
            return text.replace(/\\n/g, '<br>');
        }

        function previewMail(titleId, bodyId) {
            const title = document.getElementById(titleId).value;
            const body = document.getElementById(bodyId).value;
            
            document.getElementById('mailSubject').innerText = title;
            document.getElementById('mailBody').innerHTML = formatMail(body);
            
            document.getElementById('mailModal').style.display = 'block';
        }

        function previewWhatsApp(bodyId) {
            const body = document.getElementById(bodyId).value;
            document.getElementById('waBody').innerHTML = formatWhatsApp(body);
            document.getElementById('waModal').style.display = 'block';
        }

        // Simular interactividad básica de toggles en los controles maestros
        document.querySelectorAll('button[type=\"button\"]').forEach(btn => {
            btn.onclick = function() {
                const isSelected = btn.classList.contains('bg-green-500') || btn.classList.contains('bg-blue-500') || btn.classList.contains('bg-purple-500') || btn.classList.contains('bg-purple-600');
                if (isSelected) {
                    btn.className = 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-gray-300';
                    btn.innerHTML = '<span class=\"inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1\"></span>';
                } else {
                    let activeBg = 'bg-green-500';
                    if (btn.closest('.bg-blue-50')) activeBg = 'bg-blue-500';
                    else if (btn.closest('.bg-purple-50') || btn.closest('.bg-white') || btn.closest('.bg-purple-600') || btn.closest('.space-y-4')) activeBg = 'bg-purple-600';
                    
                    btn.className = 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + activeBg;
                    btn.innerHTML = '<span class=\"inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6\"></span>';
                }
            }
        });

        // Close modals when clicking outside
        window.onclick = function(event) {
            if (event.target == document.getElementById('mailModal')) {
                document.getElementById('mailModal').style.display = \"none\";
            }
            if (event.target == document.getElementById('waModal')) {
                document.getElementById('waModal').style.display = \"none\";
            }
        }
    </script>
`;

html = html.replace(originalScript, realPreviewScriptHtml);
html = html.replace(originalScript.replace(/\r\n/g, '\n'), realPreviewScriptHtml);

// 3. Inject global controls at the top of the body
const globalControlsHtml = `
        <!-- ========================================== -->
        <!-- IMAGEN 1: CONTROLES MAESTROS (NO SE TOCAN) -->
        <!-- ========================================== -->
        
        <!-- 1. MASTER SWITCHES (Global Control) -->
        <div class='bg-white p-6 rounded-2xl shadow-sm border border-gray-200'>
            <h3 class='text-lg font-bold text-gray-800 mb-4 flex items-center gap-2'>
                ⚙️ Control Maestro de Canales
            </h3>
            <div class='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <!-- WhatsApp Switch -->
                <div class='p-4 rounded-xl border flex flex-col items-center gap-3 bg-green-50 border-green-200'>
                    <div class='flex items-center gap-2 font-bold text-gray-700'>
                        <span class='text-green-500 text-xl'>💬</span> WhatsApp
                    </div>
                    <button type='button' class='relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-green-500'>
                        <span class='inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6'></span>
                    </button>
                </div>

                <!-- Email Switch -->
                <div class='p-4 rounded-xl border flex flex-col items-center gap-3 bg-blue-50 border-blue-200'>
                    <div class='flex items-center gap-2 font-bold text-gray-700'>
                        <span class='text-blue-500 text-xl'>✉️</span> Email
                    </div>
                    <button type='button' class='relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-blue-500'>
                        <span class='inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6'></span>
                    </button>
                </div>

                <!-- Push Switch -->
                <div class='p-4 rounded-xl border flex flex-col items-center gap-3 bg-purple-50 border-purple-200'>
                    <div class='flex items-center gap-2 font-bold text-gray-700'>
                        <span class='text-purple-500 text-xl'>🔔</span> Push
                    </div>
                    <button type='button' class='relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-purple-500'>
                        <span class='inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6'></span>
                    </button>
                </div>
            </div>
            <p class='text-xs text-gray-400 mt-3 text-center'>Estos interruptores son globales. Si apagas uno aquí, ningún mensaje saldrá por ese canal, sin importar las reglas de abajo.</p>
        </div>

        <!-- 2. Permisos y Refuerzo Contextual (PWA) -->
        <div class='bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6'>
            <h3 class='text-lg font-bold text-gray-800 flex items-center gap-2'>
                🔔 Permisos y Refuerzo Contextual (PWA)
            </h3>
            
            <div class='space-y-4'>
                <div class='bg-white p-4 rounded-xl border border-purple-100 flex items-center justify-between shadow-sm'>
                    <div class='flex items-center gap-3'>
                        <div class='w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500'>
                            <span class='text-lg'>🔔</span>
                        </div>
                        <div>
                            <h4 class='font-black text-gray-800 uppercase tracking-tighter text-sm'>RE-INTENTO DE PERMISOS PWA</h4>
                            <p class='text-xs text-gray-500'>Volver a mostrar carteles si el cliente eligió "Quizás Luego".</p>
                        </div>
                    </div>
                    <button type='button' class='relative inline-flex h-6 w-12 items-center rounded-full transition-colors bg-purple-600'>
                        <span class='absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform translate-x-5'></span>
                    </button>
                </div>

                <div class='bg-white p-4 rounded-xl border border-purple-100 flex items-center gap-6 shadow-sm'>
                    <div class='w-24 h-16 bg-purple-50/50 rounded-lg border border-purple-100 flex items-center justify-center'>
                        <span class='font-black text-2xl text-purple-600'>3</span>
                    </div>
                    <div>
                        <span class='font-bold text-gray-800 block text-sm'>Días para volver a preguntar.</span>
                        <p class='text-[10px] text-gray-400 leading-tight'>Días de silencio antes de volver a molestar con el cartel de Notificaciones o Beneficios Locales.</p>
                    </div>
                </div>
            </div>

            <!-- Configuración de Carteles PWA -->
            <div class='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4'>
                <div class='flex items-center gap-3 mb-2'>
                    <div class='w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500'>
                        <span class='text-lg'>🔔</span>
                    </div>
                    <div>
                        <h4 class='font-black text-gray-800 uppercase tracking-tighter text-sm'>CONFIGURACIÓN DE CARTELES PWA</h4>
                        <p class='text-xs text-gray-500'>Límites y tiempos para mostrar los avisos a los clientes.</p>
                    </div>
                </div>

                <div class='p-4 bg-blue-50/50 rounded-xl border border-dashed border-blue-200 space-y-4'>
                    <div class='grid grid-cols-2 gap-4'>
                        <div class='bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center'>
                            <label class='block text-[10px] font-bold text-gray-400 uppercase mb-1'>MÁX. INTENTOS PC</label>
                            <span class='font-bold text-lg text-gray-800'>2</span>
                        </div>
                        <div class='bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center'>
                            <label class='block text-[10px] font-bold text-gray-400 uppercase mb-1'>MÁX. INTENTOS CELULAR</label>
                            <span class='font-bold text-lg text-gray-800'>2</span>
                        </div>
                    </div>
                    
                    <div class='bg-white p-3 rounded-lg border border-blue-100 shadow-sm'>
                        <span class='text-[10px] font-bold text-blue-700 block mb-2'>⏳ Cooldown para Celulares (Programado)</span>
                        <div class='grid grid-cols-3 gap-2 text-center'>
                            <div class='bg-gray-50 p-2 rounded border border-gray-100'>
                                <span class='block text-[9px] font-bold text-gray-400 uppercase'>HORAS</span>
                                <span class='font-bold text-sm text-gray-700'>0</span>
                            </div>
                            <div class='bg-gray-50 p-2 rounded border border-gray-100'>
                                <span class='block text-[9px] font-bold text-gray-400 uppercase'>MINUTOS</span>
                                <span class='font-bold text-sm text-gray-700'>2</span>
                            </div>
                            <div class='bg-gray-50 p-2 rounded border border-gray-100'>
                                <span class='block text-[9px] font-bold text-gray-400 uppercase'>SEGUNDOS</span>
                                <span class='font-bold text-sm text-gray-700'>0</span>
                            </div>
                        </div>
                        <p class='text-[9px] text-gray-400 mt-2 leading-tight italic'>Si el cliente elige "Quizás luego", esta configuración determina cuánto tiempo debe pasar para volver a preguntar. Total decimal: 0.0333 hs.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 3. Configuración de WhatsApp -->
        <div class='bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4'>
            <h3 class='text-lg font-bold text-gray-800 flex items-center gap-2'>
                ⚙️ Configuración de WhatsApp
            </h3>
            <div>
                <label class='block text-xs font-bold text-gray-500 mb-2'>Tu Número (Business)</label>
                <input type='text' value='+5491169616261' disabled class='w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 font-medium outline-none'>
                <p class='text-[10px] text-gray-400 mt-1 italic'>Formato: 54911xxxxxxxx (Sin 0 ni 15)</p>
            </div>
        </div>

        <hr class='border-gray-200 my-8'>
`;

const alertBoxEnd = "Podés probar los botones de Vista Previa para ver cómo se diferencian el Mail y el WhatsApp.</p>\n        </div>";
const alertBoxEndR = "Podés probar los botones de Vista Previa para ver cómo se diferencian el Mail y el WhatsApp.</p>\r\n        </div>";

if (html.includes(alertBoxEnd)) {
    html = html.replace(alertBoxEnd, alertBoxEnd + '\n' + globalControlsHtml);
} else if (html.includes(alertBoxEndR)) {
    html = html.replace(alertBoxEndR, alertBoxEndR + '\r\n' + globalControlsHtml);
} else {
    html = html.replace('<body class=\'p-8 text-gray-800\'>\r\n    <div class=\'max-w-5xl mx-auto space-y-8\'>', '<body class=\'p-8 text-gray-800\'>\r\n    <div class=\'max-w-3xl mx-auto space-y-8\'>\r\n' + globalControlsHtml);
}

html = html.replace("max-w-5xl mx-auto", "max-w-3xl mx-auto");

// 4. Inject ChannelSelector inside each template card
const channelSelectorHtml = `
                <!-- CANALES DE ENVÍO -->
                <div class='mt-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100'>
                    <span class='text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2'>Canales de Envío</span>
                    <div class='flex gap-4'>
                        <label class='flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer hover:bg-white px-2 py-1 rounded border border-transparent hover:border-gray-200 transition'>
                            <input type='checkbox' checked class='rounded text-green-600 focus:ring-green-500 border-gray-300'> WhatsApp
                        </label>
                        <label class='flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer hover:bg-white px-2 py-1 rounded border border-transparent hover:border-gray-200 transition'>
                            <input type='checkbox' checked class='rounded text-blue-600 focus:ring-blue-500 border-gray-300'> Email
                        </label>
                        <label class='flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer hover:bg-white px-2 py-1 rounded border border-transparent hover:border-gray-200 transition'>
                            <input type='checkbox' checked class='rounded text-purple-600 focus:ring-purple-500 border-gray-300'> Push
                        </label>
                    </div>
                </div>
`;

const cardSeparator = "<div class='bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6'>";
const parts = html.split(cardSeparator);
console.log('Split into ' + parts.length + ' parts');

for (let i = 1; i < parts.length; i++) {
    let part = parts[i];
    
    const target1 = "                </div>\\r\\n            </div>";
    const target2 = "                </div>\\n            </div>";
    
    let lastIdx = part.lastIndexOf("                </div>\r\n            </div>");
    let targetLen = 27; 
    if (lastIdx === -1) {
        lastIdx = part.lastIndexOf("                </div>\n            </div>");
        targetLen = 25; 
    }
    
    if (lastIdx !== -1) {
        const insertPos = lastIdx + (targetLen - 19); 
        parts[i] = part.slice(0, insertPos) + '\r\n' + channelSelectorHtml + part.slice(insertPos);
        console.log('Successfully injected channel selector for card ' + i + '!');
    } else {
        console.warn('Could not find card closing tag in part ' + i + '!');
    }
}

html = parts.join(cardSeparator);

html = html.replace("<script src='https://cdn.tailwindcss.com'></script>\r\n<script src='https://cdn.tailwindcss.com'></script>", "<script src='https://cdn.tailwindcss.com'></script>");
html = html.replace("<script src='https://cdn.tailwindcss.com'></script>\n<script src='https://cdn.tailwindcss.com'></script>", "<script src='https://cdn.tailwindcss.com'></script>");

fs.writeFileSync('scratch/mockup2.html', html, 'utf8');
console.log('Complete mockup2.html written successfully!');
