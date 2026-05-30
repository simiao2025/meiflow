import re

files = [
    r"c:\Projetos\MEIFlow\apps\mobile\app\(tabs)\opportunities.tsx",
    r"c:\Projetos\MEIFlow\apps\mobile\app\(tabs)\two.tsx",
    r"c:\Projetos\MEIFlow\apps\mobile\app\(tabs)\settings.tsx"
]

color_map = {
    '#0F172A': 'Palette.black',
    '#1E293B': 'Palette.navyDeep',
    '#38BDF8': 'Colors.primary',
    '#10B981': 'Colors.primary', # Keep it simple
    "'rgba(51, 65, 85, 0.5)'": 'Palette.border',
    "'#F1F5F9'": 'Colors.text',
    "'#F8FAFC'": 'Colors.text',
    "'#94A3B8'": 'Colors.textSecondary',
    "'#64748B'": 'Colors.textMuted',
    "'rgba(56, 189, 248, 0.1)'": "Colors.primaryMuted",
    "'#334155'": "Palette.borderStrong",
    "'#0284C7'": "Palette.gold[600]", # For linear gradients
    "'#EF4444'": "'#ef4444'", # keep red
    "'#F59E0B'": "Palette.warning"
}

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Need to add import if it doesn't exist
    if "import { Colors, Palette, Typography } from '../../constants/theme';" not in content:
        # replace the first import React
        content = content.replace("import React", "import { Colors, Palette, Typography } from '../../constants/theme';\nimport React")

    # Replace literal hex codes with theme constants
    for old, new in color_map.items():
        if old.startswith("'") or old.startswith('"'):
            content = content.replace(old, new)
        else:
            content = content.replace(f"'{old}'", new)
            content = content.replace(f'"{old}"', new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Colors updated successfully in 3 files.")
