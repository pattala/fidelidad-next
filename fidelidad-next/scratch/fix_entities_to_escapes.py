import os

file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace HTML entities with JS Escape Sequences for strings
replacements = [
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
]

for old, new in replacements:
    text = text.replace(old, new)

# And fix remaining acentos (ensuring clean text)
text = text.replace('├í', 'á').replace('├│', 'ó').replace('├▒', 'ñ').replace('├⌐', 'é').replace('├║', 'ú').replace('├í', 'í')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Entities replaced with Javascript Escape Sequences.")
