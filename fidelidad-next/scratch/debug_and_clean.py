import os

file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Debug: add console log to search and submit
text = text.replace(
    'const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`,',
    'console.log("🔍 [Club Fidelidad] Buscando en:", `${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`);\n            const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`,'
)

# Fix any lingering broken acentos in the "Error de conexión" string specifically
text = text.replace('conexin', 'conexión')
text = text.replace('conexin', 'conexión') # as seen in grep

# Final character check
text = text.replace('├í', 'á').replace('├│', 'ó').replace('├▒', 'ñ')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Added debug logs and fixed acentos.")
