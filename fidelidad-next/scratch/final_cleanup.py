import os

file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Unified cleanup for any missed broken symbols
text = text.replace('├í', 'á').replace('├│', 'ó').replace('├▒', 'ñ').replace('├⌐', 'é')
text = text.replace('┬í', '¡').replace('┬┐', '¿').replace('├ù', '×').replace('Ô£à', '✅')
text = text.replace('ÔÜá´©Å', '⚠️').replace('ÔÅ│', '⏳').replace('ÔÇö', '—')
text = text.replace('­ƒÄé', '🎂').replace('­ƒô▒', '📱').replace('­ƒÉ¥', '🐾')
text = text.replace('Ô¡É', '⭐').replace('├ó', '—') # and other common ones
text = text.replace('┬á', ' ').replace('┬', '') # Clean up broken spaces

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Final encoding verification and cleanup complete.")
