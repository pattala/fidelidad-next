import os

files = [
    "REGLAS_DESARROLLO.md",
    "GUIA_INSTALACION_RAMPET_MASTER.md",
    "MANUAL_DE_USO.md",
    "RAMPET_SOPORTE_TECNICO_MASTER.md",
    "GUIA_DE_PRUEBAS_EXHAUSTIVAS.md",
    "E2E_MASTER_TEST_GUIDE.md",
    "HOJA_DE_RUTA_PRUEBAS_E2E.md",
    "TEST_GUIDE_CAMPAIGNS.md"
]

docs_path = "_SYSTEM_DOCS"
output_file = os.path.join(docs_path, "DOCUMENTACION_MAESTRA_RAMPET.md")

with open(output_file, "w", encoding="utf-8") as outfile:
    outfile.write("# 💎 DOCUMENTACIÓN MAESTRA RAMPET (V.1.4.5)\n\n")
    outfile.write("> Este documento consolida toda la inteligencia técnica y operativa del sistema.\n\n---\n\n")
    
    for filename in files:
        filepath = os.path.join(docs_path, filename)
        if os.path.exists(filepath):
            outfile.write(f"\n\n--- SECTION: {filename} ---\n\n")
            try:
                with open(filepath, "r", encoding="utf-8") as infile:
                    outfile.write(infile.read())
            except UnicodeDecodeError:
                # Fallback to latin-1 if utf-8 fails
                with open(filepath, "r", encoding="latin-1") as infile:
                    outfile.write(infile.read())
            outfile.write("\n\n")

print("Merge complete with UTF-8 encoding.")
