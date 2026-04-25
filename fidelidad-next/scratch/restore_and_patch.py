import subprocess
import os

# Get content from the branch
cmd = ["git", "show", "backup-2026-04-23-estable:fidelidad-next/extension-club-fidelidad/content.js"]
result = subprocess.run(cmd, capture_output=True)
content = result.stdout # This is bytes

# The content is UTF-8. 
try:
    text = content.decode('utf-8')
except UnicodeDecodeError:
    # If it fails, maybe it's not pure UTF-8 or git messed it up. 
    # But usually it's UTF-8.
    text = content.decode('latin-1')

# Replace the injection logic
old_injection = """    // --- ESTRATEGIA DE INFILTRACIÓN (v29) ---
    const modalSelectors = ['.modal-content', '.modal-body', '.bootbox', '.ui-dialog-content', '.sky-modal', '[role="dialog"]'];
    let injector = document.body;
    for (let sel of modalSelectors) {
        const found = document.querySelector(sel);
        if (found) {
            injector = found;
            break;
        }
    }
    injector.appendChild(panel);"""

new_injection = """    // --- SIEMPRE FLOTANTE (v36) ---
    document.body.appendChild(panel);"""

if old_injection in text:
    text = text.replace(old_injection, new_injection)
else:
    # Try a regex if exact match fails due to line endings or slight variations
    import re
    text = re.sub(r'// --- ESTRATEGIA DE INFILTRACIÓN.*?\n.*?injector\.appendChild\(panel\);', new_injection, text, flags=re.DOTALL)

# Write to the local file
file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Restored and patched successfully")
