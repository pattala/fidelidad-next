import os

file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'

with open(file_path, 'rb') as f:
    content = f.read()

# Replacement map for broken UTF-8 interpreted as CP1252
replacements = [
    (b'\xc3\xa1', 'á'.encode('utf-8')),
    (b'\xc3\xb3', 'ó'.encode('utf-8')),
    (b'\xc3\xb1', 'ñ'.encode('utf-8')),
    (b'\xc3\xa9', 'é'.encode('utf-8')),
    (b'\xc3\x97', '×'.encode('utf-8')),
    (b'\xc3\xba', 'ú'.encode('utf-8')),
    (b'\xc3\xad', 'í'.encode('utf-8')),
    (b'\xc2\xbf', '¿'.encode('utf-8')),
    (b'\xc2\xa1', '¡'.encode('utf-8')),
    (b'\xc3\x93', 'Ó'.encode('utf-8')),
    (b'\xc3\x8d', 'Í'.encode('utf-8')),
    (b'\xe2\x9c\x85', '✅'.encode('utf-8')),
    (b'\xe2\x9a\x99\xef\xb8\x8f', '⚙️'.encode('utf-8')),
    (b'\xe2\x9d\x8c', '❌'.encode('utf-8')),
    (b'\xe2\x8c\xb3', '⏳'.encode('utf-8')),
    (b'\xe2\x80\x93', '–'.encode('utf-8')),
    (b'\xf0\x9f\x9a\x80', '🚀'.encode('utf-8')),
    (b'\xf0\x9f\x8e\x82', '🎂'.encode('utf-8')),
    (b'\xf0\x9f\x94\x8d', '🔍'.encode('utf-8')),
    (b'\xf0\x9f\x93\x8a', '📊'.encode('utf-8')),
    (b'\xf0\x9f\x93\xa2', '📢'.encode('utf-8')),
    (b'\xf0\x9f\x8e\x81', '🎁'.encode('utf-8')),
    (b'\xf0\x9f\x90\xa5', '🐾'.encode('utf-8')),
    (b'\xe2\x9c\xa8', '✨'.encode('utf-8')),
    (b'\xe2\x8c\xb0', '⌛'.encode('utf-8')),
    (b'\xe2\x9a\xa1', '⚡'.encode('utf-8')),
    (b'\xf0\x9f\x93\x99', '📖'.encode('utf-8')),
]

for old, new in replacements:
    content = content.replace(old, new)

text = content.decode('utf-8')

# Fix Floating logic
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

# We need to account for possible broken injection logic in the file due to encoding earlier
# But since I already decoded 'text' from the 'fixed' content, it should match the original string literals if they were correctly encoded in the source.
# Let's use a more flexible replacement for the injection block.

if "ESTRATEGIA DE INFILTRACIÓN" in text:
    import re
    text = re.sub(r'// --- ESTRATEGIA DE INFILTRACIÓN.*?\n.*?injector\.appendChild\(panel\);', new_injection, text, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("File fixed successfully")
