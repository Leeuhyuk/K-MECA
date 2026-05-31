import re

def search_file(filepath, pattern):
    with open(filepath, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if re.search(pattern, line, re.IGNORECASE):
                print(f"{i+1}: {line.strip()[:150]}")

if __name__ == "__main__":
    search_file("c:/Users/lgs79/OneDrive/claude-1/MESPro.html", r'잠금|lock|login|인사|관리자|재무|경영|문서|시스템|Firebase|auth|role|worker')
