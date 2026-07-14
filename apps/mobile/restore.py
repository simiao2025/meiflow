import subprocess
import sys

try:
    result = subprocess.run(
        ["git", "checkout", "HEAD", "apps/mobile/app/(tabs)/settings.tsx"],
        cwd=r"c:\Projetos\MEIFlow",
        capture_output=True,
        text=True,
        check=True
    )
    print("Success:", result.stdout)
except subprocess.CalledProcessError as e:
    print("Error:", e.stderr)
    sys.exit(1)
