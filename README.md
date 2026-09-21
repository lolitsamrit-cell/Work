# AI Code Reviewer & Corrector

A browser-based educational code-review application for beginners and students.

## What it does
- Accepts code input with language selection (Python, JavaScript, C, C++, Java, Generic).
- Detects syntax-adjacent and structural issues with categorized results:
  - errors
  - warnings
  - code-quality suggestions
  - learning notes
- Explains each issue in beginner-friendly language and includes a correction suggestion.
- Generates a suggested improved version of submitted code.
- Shows original-vs-suggested code side by side.
- Provides basic complexity/readability observations.
- Stores local analysis history in the browser.

## Run locally
Open `/home/runner/work/Work/Work/index.html` in any modern browser.

## Current rule examples
- Long lines, tab indentation, TODO/FIXME markers
- Debug-print detection
- Bracket mismatch/unclosed bracket checks
- Python checks (`except:` and `== None`)
- Semicolon hints for JavaScript/C/C++/Java
- Basic unsafe C function warnings (`gets`, `strcpy`)
- Deep nesting and global-variable style observations

## Important note
This tool provides assistance and learning guidance, not guaranteed full correctness or runtime bug detection.
