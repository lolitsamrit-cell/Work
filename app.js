const reviewBtn = document.getElementById("reviewBtn");
const codeInput = document.getElementById("codeInput");
const languageSelect = document.getElementById("language");
const findingsEl = document.getElementById("findings");
const summaryEl = document.getElementById("summary");

reviewBtn.addEventListener("click", () => {
  const code = codeInput.value;
  const language = languageSelect.value;
  const findings = runChecks(code, language);
  renderSummary(findings);
  renderFindings(findings);
});

function runChecks(code, language) {
  const lines = code.split("\n");
  const findings = [];

  lines.forEach((line, index) => {
    const number = index + 1;

    if (line.length > 120) {
      findings.push(makeFinding("medium", number, "Line exceeds 120 characters."));
    }

    if (/TODO|FIXME/.test(line)) {
      findings.push(makeFinding("low", number, "Unresolved TODO/FIXME found."));
    }

    if (/console\.log\(|print\(/.test(line)) {
      findings.push(makeFinding("low", number, "Debug logging found."));
    }

    if (/[^=!]==[^=]/.test(line)) {
      findings.push(makeFinding("medium", number, "Prefer strict equality when possible."));
    }

    if (language === "javascript" && /[a-zA-Z0-9_)\]]$/.test(line.trim()) && /(?:const|let|var|return|\w+\()/.test(line) && !/[;{}]$/.test(line.trim())) {
      findings.push(makeFinding("low", number, "Possible missing semicolon."));
    }

    if (language === "python" && /^\s*except:\s*$/.test(line)) {
      findings.push(makeFinding("high", number, "Avoid broad except without specific exception type."));
    }
  });

  if (findMaxIndent(lines) >= 16) {
    findings.push(makeFinding("medium", "-", "Deep nesting detected; consider refactoring."));
  }

  return findings;
}

function findMaxIndent(lines) {
  return lines.reduce((max, line) => {
    const spaces = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.max(max, spaces);
  }, 0);
}

function makeFinding(severity, line, message) {
  return { severity, line, message };
}

function renderSummary(findings) {
  const weight = { high: 15, medium: 8, low: 3 };
  const penalty = findings.reduce((sum, finding) => sum + (weight[finding.severity] || 0), 0);
  const score = Math.max(0, 100 - penalty);

  summaryEl.classList.remove("hidden");
  summaryEl.textContent = `Review score: ${score}/100 • Findings: ${findings.length}`;
}

function renderFindings(findings) {
  findingsEl.innerHTML = "";

  if (!findings.length) {
    findingsEl.innerHTML = '<article class="finding">No issues found. Great job.</article>';
    return;
  }

  findings.forEach((finding) => {
    const item = document.createElement("article");
    item.className = "finding";
    item.innerHTML = `
      <div class="severity ${finding.severity}">${finding.severity}</div>
      <div>Line: ${finding.line}</div>
      <div>${finding.message}</div>
    `;
    findingsEl.appendChild(item);
  });
}
