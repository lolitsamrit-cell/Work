const reviewBtn = document.getElementById("reviewBtn");
const loadExampleBtn = document.getElementById("loadExampleBtn");
const clearBtn = document.getElementById("clearBtn");
const codeInput = document.getElementById("codeInput");
const languageSelect = document.getElementById("language");
const findingsEl = document.getElementById("findings");
const summaryEl = document.getElementById("summary");
const originalCodeEl = document.getElementById("originalCode");
const suggestedCodeEl = document.getElementById("suggestedCode");
const complexityEl = document.getElementById("complexity");
const learningNotesEl = document.getElementById("learningNotes");
const historyListEl = document.getElementById("historyList");

const HISTORY_KEY = "ai-code-review-history";

reviewBtn.addEventListener("click", runReview);
loadExampleBtn.addEventListener("click", loadExample);
clearBtn.addEventListener("click", clearEditor);

renderHistory();

function runReview() {
  const code = codeInput.value;
  const language = languageSelect.value;

  if (!code.trim()) {
    findingsEl.innerHTML = '<article class="finding">Add code before running analysis.</article>';
    summaryEl.classList.add("hidden");
    return;
  }

  const findings = runChecks(code, language);
  const suggestedCode = buildSuggestedCode(code, language, findings);
  const complexity = buildComplexityNotes(code, language);
  const score = renderSummary(findings, complexity);

  renderFindings(findings);
  renderLearningNotes(findings);
  renderComplexity(complexity);
  originalCodeEl.textContent = code;
  suggestedCodeEl.textContent = suggestedCode;
  saveHistory({ language, score, findingsCount: findings.length });
  renderHistory();
}

function runChecks(code, language) {
  const lines = code.split("\n");
  const findings = [];

  lines.forEach((line, index) => {
    const number = index + 1;
    const trimmed = line.trim();

    if (line.length > 120) {
      findings.push(
        makeFinding(
          "quality",
          "medium",
          number,
          "Long line",
          "Very long lines reduce readability for beginners.",
          "Split this line into smaller statements or move subexpressions to named variables."
        )
      );
    }

    if (/TODO|FIXME/.test(line)) {
      findings.push(
        makeFinding(
          "learning",
          "low",
          number,
          "Pending TODO/FIXME",
          "A TODO usually means unfinished logic and can hide bugs.",
          "Complete the pending task or open an issue to track it clearly."
        )
      );
    }

    if (/console\.log\(|print\(|System\.out\.print|printf\(/.test(line)) {
      findings.push(
        makeFinding(
          "warning",
          "low",
          number,
          "Debug output found",
          "Debug statements are useful while learning but should be reviewed before final submission.",
          "Remove or replace temporary logging with structured logging where needed."
        )
      );
    }

    if (/[^=!<>]==[^=]/.test(line) && language === "javascript") {
      findings.push(
        makeFinding(
          "warning",
          "medium",
          number,
          "Loose equality detected",
          "Loose equality (`==`) can coerce types unexpectedly.",
          "Use `===` for predictable comparisons."
        )
      );
    }

    if (/\t/.test(line)) {
      findings.push(
        makeFinding(
          "quality",
          "low",
          number,
          "Tab indentation",
          "Mixed indentation styles may cause confusing formatting.",
          "Use spaces consistently (for example 2 or 4 spaces)."
        )
      );
    }

    if (language === "python") {
      addPythonChecks(trimmed, number, findings);
    } else if (language === "javascript") {
      addSemicolonCheck(trimmed, line, number, findings, "javascript");
    } else if (language === "java") {
      addSemicolonCheck(trimmed, line, number, findings, "java");
    } else if (language === "c" || language === "cpp") {
      addSemicolonCheck(trimmed, line, number, findings, language);
      addCLanguageChecks(trimmed, number, findings);
    }
  });

  addBracketChecks(lines, findings);
  addStructureChecks(lines, language, findings);

  return findings;
}

function addPythonChecks(trimmed, lineNo, findings) {
  if (/^except:\s*$/.test(trimmed)) {
    findings.push(
      makeFinding(
        "error",
        "high",
        lineNo,
        "Broad exception handler",
        "Catching all exceptions hides real root causes and makes debugging difficult.",
        "Use a specific exception type, for example `except ValueError:`."
      )
    );
  }

  if (/\b==\s*None\b/.test(trimmed)) {
    findings.push(
      makeFinding(
        "quality",
        "low",
        lineNo,
        "None comparison style",
        "Python style guides recommend identity checks for `None`.",
        "Use `is None` or `is not None`."
      )
    );
  }

  if (/^(if|elif|for|while|def|class|try|except|else|finally)\b/.test(trimmed) && !trimmed.endsWith(":")) {
    findings.push(
      makeFinding(
        "error",
        "high",
        lineNo,
        "Missing colon",
        "Python blocks require a trailing colon.",
        "Add `:` at the end of this control or definition line."
      )
    );
  }
}

function addCLanguageChecks(trimmed, lineNo, findings) {
  if (/\bgets\s*\(/.test(trimmed)) {
    findings.push(
      makeFinding(
        "error",
        "high",
        lineNo,
        "Unsafe input function",
        "`gets()` is unsafe because it does not check buffer length.",
        "Use `fgets()` and validate input length."
      )
    );
  }

  if (/\bstrcpy\s*\(/.test(trimmed)) {
    findings.push(
      makeFinding(
        "warning",
        "medium",
        lineNo,
        "Potentially unsafe copy",
        "`strcpy()` may overflow destination buffers.",
        "Use bounded alternatives like `strncpy()` with explicit limits."
      )
    );
  }
}

function addSemicolonCheck(trimmed, line, lineNo, findings, language) {
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return;
  }

  const looksLikeStatement =
    /[a-zA-Z0-9_)\]"']$/.test(trimmed) &&
    !/[;{}:]$/.test(trimmed) &&
    !/^(if|for|while|switch|else|try|catch|class|def|function)\b/.test(trimmed) &&
    !/\b(if|for|while)\s*\(.+\)$/.test(trimmed);

  if (looksLikeStatement && /(return|let |const |var |int |float |double |char |String |\w+\s*=|\w+\()/.test(line)) {
    findings.push(
      makeFinding(
        "warning",
        "low",
        lineNo,
        "Possible missing semicolon",
        `${language.toUpperCase()} statements usually end with a semicolon.`,
        "Check whether this statement should end with `;`."
      )
    );
  }
}

function addBracketChecks(lines, findings) {
  const opens = { "(": ")", "{": "}", "[": "]" };
  const closes = new Set(Object.values(opens));
  const stack = [];

  lines.forEach((line, index) => {
    for (const char of line) {
      if (opens[char]) {
        stack.push({ char, line: index + 1 });
      } else if (closes.has(char)) {
        const last = stack.pop();
        if (!last || opens[last.char] !== char) {
          findings.push(
            makeFinding(
              "error",
              "high",
              index + 1,
              "Bracket mismatch",
              "Unbalanced brackets can produce syntax errors.",
              "Check paired brackets around this line."
            )
          );
          return;
        }
      }
    }
  });

  if (stack.length) {
    const open = stack[stack.length - 1];
    findings.push(
      makeFinding(
        "error",
        "high",
        open.line,
        "Unclosed bracket",
        "An opening bracket was not closed later in the file.",
        "Add the matching closing bracket."
      )
    );
  }
}

function addStructureChecks(lines, language, findings) {
  const maxIndent = findMaxIndent(lines);
  if (maxIndent >= 16) {
    findings.push(
      makeFinding(
        "quality",
        "medium",
        "-",
        "Deep nesting",
        "Deep nesting makes control flow hard to follow for new readers.",
        "Extract nested logic into helper functions or simplify branching."
      )
    );
  }

  if (language === "python" && lines.some((line) => line.trim().startsWith("global "))) {
    findings.push(
      makeFinding(
        "learning",
        "low",
        "-",
        "Global variable usage",
        "Heavy use of globals can make behavior harder to predict.",
        "Prefer function parameters and return values for data flow."
      )
    );
  }
}

function buildSuggestedCode(code, language, findings) {
  let updated = code
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n");

  if (language === "python") {
    updated = updated.replace(/\b==\s*None\b/g, "is None");
    updated = updated.replace(/^\s*except:\s*$/gm, "except Exception:");
  }

  if (language === "javascript") {
    updated = updated.replace(/([^=!<>])==([^=])/g, "$1===$2");
  }

  const semicolonLines = new Set(
    findings
      .filter((item) => item.title === "Possible missing semicolon" && Number.isInteger(item.line))
      .map((item) => item.line)
  );

  if (semicolonLines.size) {
    updated = updated
      .split("\n")
      .map((line, index) => {
        const lineNo = index + 1;
        if (semicolonLines.has(lineNo) && !/[;{}:]$/.test(line.trim())) {
          return `${line};`;
        }
        return line;
      })
      .join("\n");
  }

  return updated;
}

function buildComplexityNotes(code, language) {
  const lines = code.split("\n");
  const loopCount = (code.match(/\b(for|while)\b/g) || []).length;
  const branchCount = (code.match(/\b(if|elif|else if|switch|case)\b/g) || []).length;
  const maxIndent = findMaxIndent(lines);
  const readabilityPenalty = Math.min(45, Math.floor(maxIndent / 2) + loopCount * 3 + branchCount * 2);
  const readability = Math.max(55, 100 - readabilityPenalty);

  const complexityNote =
    loopCount === 0
      ? "No explicit loops found; runtime likely linear in simple statements."
      : loopCount === 1
      ? "Single loop detected; this often maps to O(n) time for one pass over data."
      : "Multiple loop constructs detected; nested loops may increase runtime toward O(n²).";

  return {
    language,
    loopCount,
    branchCount,
    maxIndent,
    readability,
    complexityNote,
  };
}

function makeFinding(category, severity, line, title, explanation, suggestion) {
  return { category, severity, line, title, explanation, suggestion };
}

function findMaxIndent(lines) {
  return lines.reduce((max, line) => {
    const spaces = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.max(max, spaces);
  }, 0);
}

function renderSummary(findings, complexity) {
  const weight = { high: 16, medium: 9, low: 4 };
  const penalty = findings.reduce((sum, finding) => sum + (weight[finding.severity] || 0), 0);
  const score = Math.max(0, Math.round((complexity.readability + Math.max(0, 100 - penalty)) / 2));

  const categories = {
    errors: findings.filter((item) => item.category === "error").length,
    warnings: findings.filter((item) => item.category === "warning").length,
    quality: findings.filter((item) => item.category === "quality").length,
    learning: findings.filter((item) => item.category === "learning").length,
  };

  summaryEl.classList.remove("hidden");
  summaryEl.textContent = `Score: ${score}/100 • Errors: ${categories.errors} • Warnings: ${categories.warnings} • Quality: ${categories.quality} • Learning Notes: ${categories.learning}`;
  return score;
}

function renderFindings(findings) {
  findingsEl.innerHTML = "";

  if (!findings.length) {
    findingsEl.innerHTML = '<article class="finding">No major issues found. Keep refining naming and test coverage.</article>';
    return;
  }

  findings.forEach((finding) => {
    const item = document.createElement("article");
    item.className = "finding";
    item.innerHTML = `
      <div class="severity ${finding.severity}">${finding.category} • ${finding.severity}</div>
      <div class="finding-line">Line: ${finding.line}</div>
      <div class="finding-title">${finding.title}</div>
      <div>${finding.explanation}</div>
      <div><strong>Suggestion:</strong> ${finding.suggestion}</div>
    `;
    findingsEl.appendChild(item);
  });
}

function renderLearningNotes(findings) {
  learningNotesEl.innerHTML = "";
  const notes = findings
    .filter((item) => item.category === "learning" || item.category === "error")
    .map((item) => item.explanation);

  const uniqueNotes = [...new Set(notes)];
  if (!uniqueNotes.length) {
    learningNotesEl.innerHTML = '<div class="note-item">No critical learning notes for this submission.</div>';
    return;
  }

  uniqueNotes.forEach((note) => {
    const node = document.createElement("div");
    node.className = "note-item";
    node.textContent = note;
    learningNotesEl.appendChild(node);
  });
}

function renderComplexity(complexity) {
  complexityEl.innerHTML = "";
  const notes = [
    `Language: ${complexity.language.toUpperCase()}`,
    `Loops detected: ${complexity.loopCount}`,
    `Branch statements: ${complexity.branchCount}`,
    `Max indentation: ${complexity.maxIndent} spaces`,
    `Readability estimate: ${complexity.readability}/100`,
    complexity.complexityNote,
  ];

  notes.forEach((text) => {
    const node = document.createElement("div");
    node.className = "note-item";
    node.textContent = text;
    complexityEl.appendChild(node);
  });
}

function loadExample() {
  const examples = {
    python: `def divide_numbers(a, b)\n    try:\n        result = a / b\n        print(result)\n    except:\n        print("error")\n\nif a == None:\n    print("missing value")`,
    javascript: `function compare(value){\n  if(value == 0){\n    console.log("zero")\n  }\n  return value + 1\n}`,
    c: `#include <stdio.h>\n#include <string.h>\nint main(){\n  char name[10];\n  gets(name)\n  printf("%s", name)\n  return 0\n}`,
    cpp: `#include <iostream>\nusing namespace std;\nint main(){\n  int n = 5\n  if(n > 0){\n    cout << n << endl;\n  }\n}`,
    java: `class Demo {\n  public static void main(String[] args){\n    int value = 3\n    if (value > 0) {\n      System.out.println("ok");\n    }\n  }\n}`,
    generic: `for(item in list){\n  // TODO: improve this block\n  print(item)\n}`,
  };

  const language = languageSelect.value;
  codeInput.value = examples[language] || examples.generic;
}

function clearEditor() {
  codeInput.value = "";
  findingsEl.innerHTML = "";
  learningNotesEl.innerHTML = "";
  complexityEl.innerHTML = "";
  originalCodeEl.textContent = "";
  suggestedCodeEl.textContent = "";
  summaryEl.classList.add("hidden");
}

function saveHistory(entry) {
  const history = readHistory();
  history.unshift({
    ...entry,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function renderHistory() {
  const history = readHistory();
  historyListEl.innerHTML = "";

  if (!history.length) {
    historyListEl.innerHTML = "<li>No previous analyses yet.</li>";
    return;
  }

  history.forEach((item) => {
    const node = document.createElement("li");
    const date = new Date(item.createdAt).toLocaleString();
    node.textContent = `${date} • ${item.language.toUpperCase()} • Score ${item.score} • ${item.findingsCount} findings`;
    historyListEl.appendChild(node);
  });
}
