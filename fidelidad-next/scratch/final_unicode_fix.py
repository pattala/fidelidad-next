import os
import re

file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Comprehensive mapping of broken patterns to JS Unicode escapes
# This covers UI components and WhatsApp message templates
patterns = [
    ('&#128227;', '\\u{1F4E3}'), # Megaphone
    ('&#11088;', '\\u2B50'),     # Star
    ('&#127874;', '\\u{1F382}'), # Birthday
    ('&#8987;', '\\u23F3'),      # Timer
    ('&#128062;', '\\u{1F43E}'), # Paw
    ('&#128640;', '\\u{1F680}'), # Rocket
    ('&#9989;', '\\u2705'),      # Check
    ('&#10060;', '\\u274C'),     # X
    ('&#9888;', '\\u26A0\\uFE0F'), # Warning
    ('&#10024;', '\\u2728'),     # Shine
    ('&#127873;', '\\u{1F381}'), # Gift
    ('&#128241;', '\\u{1F4F1}'), # Phone
    
    # Broken pattern versions seen in templates
    ('┬í', '\\u00A1'),           # ¡
    ('┬┐', '\\u00BF'),           # ¿
    ('­ƒÄé', '\\u{1F382}'),       # 🎂
    ('­ƒÄë', '\\u{1F38A}'),       # 🎊
    ('Ô£¿', '\\u2728'),           # ✨
    ('­ƒôó', '\\u{1F4E3}'),       # 📢
    ('­ƒöÑ', '\\u{1F525}'),       # 🔥
    ('ÔÇó', '\\u2022'),           # •
    ('ÔÅ│', '\\u23F3'),           # ⏳
    ('ƒôó', '\\u{1F4E3}'),        # 📢 (alt)
    ('ƒÄé', '\\u{1F382}'),       # 🎂 (alt)
    ('&#8987;', '\\u23F3'),       # ⏳ (alt)
]

for old, new in patterns:
    text = text.replace(old, new)

# Fix common corrupted Spanish characters specifically
text = text.replace('├í', 'á').replace('├│', 'ó').replace('├▒', 'ñ')
text = text.replace('├⌐', 'é').replace('├║', 'ú').replace('├í', 'í') # Note: overlapping í/á fix
text = text.replace('pr├│ximamente', 'próximamente')
text = text.replace('Gesti├│n', 'Gestión')
text = text.replace('Reposici├│n', 'Reposición')
text = text.replace('conexi├│n', 'conexión')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Final JS Unicode Escape fix applied to code and templates.")
