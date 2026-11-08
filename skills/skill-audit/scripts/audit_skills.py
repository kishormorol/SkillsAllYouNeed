#!/usr/bin/env python3
"""Lint Agent Skills for spec, security, link, and trigger regressions.

Checks every SKILL.md found under the given paths (or ~/.claude/skills and ~/.agents/skills
when no path is given). Each path may be a skill folder containing SKILL.md, a parent
folder holding several skill folders, or a SKILL.md file itself. Symlinked skill folders
pointing to the same resolved SKILL.md are checked once.

Exit codes:
  0  all checked skills pass (or only warn when --fail-on error is set)
  1  at least one finding at or above --fail-on (default: error)
  2  invalid arguments or no skills found
"""
import argparse
import json
import os
import re
import stat
import sys
from pathlib import Path

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_BODY_LINES = 500
MIN_DESCRIPTION_WORDS = 8
MAX_DESCRIPTION_CHARS = 1024

# Trigger cues that tell an agent WHEN to load a skill, not only what it is.
TRIGGER_CUE_RE = re.compile(
    r"\b(?:use\s+when|use\s+for|use\s+this|trigger|when\s+the\s+user|whenever|"
    r"invoked|call\s+/|asks?\s+(?:to|for|about)|for\s+(?:creating|building|testing|writing|generating|auditing|reviewing|debugging))\b|\"[^\"]{3,}\"",
    re.IGNORECASE,
)

# Relative paths pointing at files bundled inside a skill directory (requires a filename after the slash).
BUNDLED_PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_./:-])"
    r"((?:scripts|references|assets|examples|templates|agents)/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*)"
)

# Markdown links: [label](target). Excludes external schemes and anchors.
MD_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)\s]+)\)")

# Unquoted YAML scalar traps: `: ` or ` #` in an unquoted value splits or truncates it.
UNQUOTED_COLON_RE = re.compile(r":\s")
UNQUOTED_HASH_RE = re.compile(r"\s#")

# Secrets that must never be committed inside a skill or its bundled scripts.
SECRET_PATTERNS = [
    ("url-credentials", re.compile(r"(?<=://)[^\s:/@\"'`]+:[^\s@/\"'`]+(?=@)")),
    ("api-key-sk", re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}")),
    ("gitlab-token", re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}")),
    ("slack-token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}")),
    ("hf-token", re.compile(r"\bhf_[A-Za-z0-9]{30,}")),
    ("stripe-or-resend-key", re.compile(r"\b(?:re|rk|sk|pk)_(?:live_|test_)?(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{20,}")),
    ("jwt-token", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("supabase-key", re.compile(r"\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}")),
    ("private-key-block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
]

# Dangerous execution or prompt-injection patterns in skill instructions or scripts.
DANGER_PATTERNS = [
    (
        "error",
        "pipe-to-shell",
        re.compile(r"\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b"),
        "pipes remote content directly into a shell",
    ),
    (
        "error",
        "destructive-rm-root",
        re.compile(r"\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(?:/|~|\$HOME|\$\{HOME\})(?:\s|$|/\*)"),
        "deletes root or home directory recursively",
    ),
    (
        "error",
        "prompt-injection",
        re.compile(
            r"\b(?:ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|"
            r"disregard\s+(?:all\s+)?(?:previous|prior|system)\s+instructions|"
            r"do\s+not\s+mention\s+this\s+to\s+the\s+user)\b",
            re.IGNORECASE,
        ),
        "contains prompt-injection or instruction-override phrasing",
    ),
]


def finding(severity, code, message, file="SKILL.md", line=1):
    return {
        "severity": severity,
        "code": code,
        "message": message,
        "file": file,
        "line": line,
    }


def parse_frontmatter(text):
    """Parse YAML frontmatter using standard-library rules tailored to SKILL.md.

    Returns (fields_dict, issues_list, body_start_line, body_text).
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, [finding("error", "missing-frontmatter", "SKILL.md must start with YAML frontmatter (---)", line=1)], 1, text

    end_idx = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end_idx = idx
            break

    if end_idx is None:
        return {}, [finding("error", "unclosed-frontmatter", "YAML frontmatter opening --- has no closing ---", line=1)], 1, ""

    fields = {}
    issues = []
    current_key = None
    current_lines = []
    block_style = None

    def flush_current():
        nonlocal current_key, current_lines, block_style
        if current_key is not None:
            joiner = "\n" if block_style == "|" else " "
            fields[current_key] = joiner.join(part.strip() for part in current_lines if part.strip()).strip()
        current_key = None
        current_lines = []
        block_style = None

    for idx in range(1, end_idx):
        raw = lines[idx]
        line_no = idx + 1
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            issues.append(finding("error", "frontmatter-tab-indent", "tabs are not allowed in YAML indentation", line=line_no))
            continue

        # Continuation line for multiline scalar or list item
        if raw.startswith((" ", "\t")):
            if current_key is None:
                issues.append(finding("error", "frontmatter-syntax", f"unexpected indented line in frontmatter: {stripped}", line=line_no))
            else:
                current_lines.append(stripped)
            continue

        flush_current()
        if ":" not in raw:
            issues.append(finding("error", "frontmatter-syntax", f"expected 'key: value' in frontmatter, got: {stripped}", line=line_no))
            continue

        key, rest = raw.split(":", 1)
        key = key.strip()
        val = rest.strip()
        if not key or not re.match(r"^[A-Za-z0-9_-]+$", key):
            issues.append(finding("error", "frontmatter-key", f"invalid frontmatter key: {key!r}", line=line_no))
            continue

        if val in ("|", ">", "|-", ">-"):
            current_key = key
            block_style = val[0]
            current_lines = []
            continue

        if not val:
            current_key = key
            block_style = ">"
            current_lines = []
            continue

        if val[0] in ('"', "'"):
            quote = val[0]
            if len(val) < 2 or not val.endswith(quote):
                issues.append(finding("error", "frontmatter-unclosed-quote", f"unclosed quote in frontmatter key '{key}'", line=line_no))
                fields[key] = val[1:]
            else:
                fields[key] = val[1:-1]
        else:
            if UNQUOTED_COLON_RE.search(val):
                issues.append(
                    finding(
                        "error",
                        "unquoted-colon-in-frontmatter",
                        f"unquoted ': ' in frontmatter '{key}' will break YAML parsers; wrap the value in quotes",
                        line=line_no,
                    )
                )
            if UNQUOTED_HASH_RE.search(val):
                issues.append(
                    finding(
                        "error",
                        "unquoted-hash-in-frontmatter",
                        f"unquoted ' #' in frontmatter '{key}' truncates the value as a YAML comment; wrap in quotes",
                        line=line_no,
                    )
                )
            fields[key] = val

    flush_current()
    body_start_line = end_idx + 2
    body_text = "\n".join(lines[end_idx + 1 :])
    return fields, issues, body_start_line, body_text


def clean_ref_path(raw_path):
    """Strip trailing punctuation or template placeholders from a matched relative path."""
    cleaned = raw_path.rstrip(".,;:!?)>'\"`")
    if (
        not cleaned
        or cleaned.endswith("/")
        or "<" in cleaned
        or ">" in cleaned
        or "{" in cleaned
        or "}" in cleaned
        or "*" in cleaned
        or "$" in cleaned
        or "..." in cleaned
        or cleaned.upper() in ("URL", "LINK", "PATH", "FILE", "HREF")
    ):
        return ""
    if re.search(r"(?:^|/)(?:example|sample|placeholder|my-|your-|foo|bar)", cleaned, re.IGNORECASE):
        return ""
    if re.search(r"-[NXYZ](?:/|$)", cleaned):
        return ""
    return cleaned


def scan_secrets(text, rel_file):
    results = []
    for line_no, line in enumerate(text.splitlines(), 1):
        if "[REDACTED]" in line or "re.compile" in line:
            continue
        for code, pattern in SECRET_PATTERNS:
            if pattern.search(line):
                results.append(
                    finding(
                        "error",
                        f"hardcoded-secret-{code}",
                        f"possible hardcoded credential ({code}) found in {rel_file}",
                        file=rel_file,
                        line=line_no,
                    )
                )
                break
    return results


def scan_dangers(text, rel_file):
    results = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for severity, code, pattern, msg in DANGER_PATTERNS:
            if pattern.search(line):
                results.append(
                    finding(
                        severity,
                        code,
                        f"{msg} in {rel_file}",
                        file=rel_file,
                        line=line_no,
                    )
                )
    return results


def check_skill(skill_dir: Path):
    """Inspect one skill directory and return a structured report dict."""
    skill_md = skill_dir / "SKILL.md"
    findings = []

    try:
        text = skill_md.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return {
            "skill": skill_dir.name,
            "path": str(skill_dir),
            "findings": [finding("error", "invalid-encoding", "SKILL.md is not valid UTF-8")],
        }
    except OSError as exc:
        return {
            "skill": skill_dir.name,
            "path": str(skill_dir),
            "findings": [finding("error", "unreadable-file", f"could not read SKILL.md: {exc.strerror or type(exc).__name__}")],
        }

    fields, fm_issues, body_start_line, body = parse_frontmatter(text)
    findings.extend(fm_issues)

    # 1. Name validation
    name = fields.get("name", "").strip()
    if not name:
        findings.append(finding("error", "missing-name", "frontmatter is missing required 'name' field", line=1))
    else:
        if not NAME_RE.match(name):
            findings.append(
                finding(
                    "error",
                    "invalid-name-format",
                    f"skill name '{name}' must be lowercase alphanumeric with single hyphens",
                    line=1,
                )
            )
        if name != skill_dir.name:
            findings.append(
                finding(
                    "warning",
                    "name-directory-mismatch",
                    f"frontmatter name '{name}' does not match folder name '{skill_dir.name}'",
                    line=1,
                )
            )

    # 2. Description & trigger quality validation
    desc = fields.get("description", "").strip()
    if not desc:
        findings.append(finding("error", "missing-description", "frontmatter is missing required 'description' field", line=1))
    else:
        words = desc.split()
        if len(words) < MIN_DESCRIPTION_WORDS:
            findings.append(
                finding(
                    "warning",
                    "description-too-short",
                    f"description has only {len(words)} words; include both what the skill does and when to trigger it",
                    line=1,
                )
            )
        if len(desc) > MAX_DESCRIPTION_CHARS:
            findings.append(
                finding(
                    "warning",
                    "description-too-long",
                    f"description is {len(desc)} characters (recommended max {MAX_DESCRIPTION_CHARS} for context budget)",
                    line=1,
                )
            )
        if not TRIGGER_CUE_RE.search(desc):
            findings.append(
                finding(
                    "warning",
                    "weak-trigger-description",
                    "description states what the skill is but lacks trigger cues (e.g. 'Use when...', 'Use for...', or example phrases)",
                    line=1,
                )
            )

    # 3. Body size and progressive disclosure
    body_stripped = body.strip()
    if not body_stripped:
        findings.append(finding("error", "empty-body", "SKILL.md has no markdown instructions after frontmatter", line=body_start_line))
    else:
        body_lines = body.splitlines()
        if len(body_lines) > MAX_BODY_LINES:
            findings.append(
                finding(
                    "warning",
                    "body-too-long",
                    f"SKILL.md body is {len(body_lines)} lines (recommended <= {MAX_BODY_LINES}); move detailed material into references/",
                    line=body_start_line,
                )
            )

    # 4. Bundled file and markdown link resolution
    checked_refs = set()
    in_fence = False
    for offset, line in enumerate(body.splitlines()):
        line_no = body_start_line + offset
        stripped_line = line.lstrip()
        if stripped_line.startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue

        for match in MD_LINK_RE.finditer(line):
            raw_target = match.group(1).strip()
            target_no_anchor = raw_target.split("#", 1)[0].split("?", 1)[0]
            if (
                not target_no_anchor
                or target_no_anchor.startswith(("http://", "https://", "mailto:", "conversation://", "file://", "/"))
                or "<" in target_no_anchor
                or "{" in target_no_anchor
            ):
                continue
            cleaned = clean_ref_path(target_no_anchor)
            if not cleaned or cleaned in checked_refs:
                continue
            checked_refs.add(cleaned)
            resolved = (skill_dir / cleaned).resolve()
            try:
                resolved.relative_to(skill_dir.resolve())
            except ValueError:
                findings.append(
                    finding("error", "path-traversal", f"markdown link '{cleaned}' escapes skill directory", line=line_no)
                )
                continue
            if not resolved.exists():
                findings.append(
                    finding(
                        "error",
                        "broken-markdown-link",
                        f"markdown link target '{cleaned}' does not exist",
                        line=line_no,
                    )
                )

        for match in BUNDLED_PATH_RE.finditer(line):
            rel = clean_ref_path(match.group(1))
            if not rel or rel in checked_refs:
                continue
            checked_refs.add(rel)
            target = (skill_dir / rel).resolve()
            try:
                target.relative_to(skill_dir.resolve())
            except ValueError:
                findings.append(finding("error", "path-traversal", f"referenced path '{rel}' escapes skill directory", line=line_no))
                continue
            if not target.exists():
                findings.append(
                    finding(
                        "error",
                        "missing-bundled-file",
                        f"referenced path '{rel}' does not exist in skill directory",
                        line=line_no,
                    )
                )

    # 5. Secrets & dangerous commands in SKILL.md
    findings.extend(scan_secrets(text, "SKILL.md"))
    findings.extend(scan_dangers(text, "SKILL.md"))

    # 6. Inspect bundled scripts/
    scripts_dir = skill_dir / "scripts"
    if scripts_dir.is_dir():
        for script_file in sorted(scripts_dir.rglob("*")):
            if not script_file.is_file():
                continue
            rel_name = str(script_file.relative_to(skill_dir)).replace("\\", "/")
            try:
                script_text = script_file.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            findings.extend(scan_secrets(script_text, rel_name))
            findings.extend(scan_dangers(script_text, rel_name))
            if script_file.suffix == ".sh" and sys.platform != "win32":
                try:
                    mode = script_file.stat().st_mode
                    if not (mode & stat.S_IXUSR):
                        findings.append(
                            finding(
                                "warning",
                                "script-not-executable",
                                f"shell script '{rel_name}' is not executable (chmod +x)",
                                file=rel_name,
                                line=1,
                            )
                        )
                except OSError:
                    pass

    return {
        "skill": name or skill_dir.name,
        "path": str(skill_dir),
        "lines": len(text.splitlines()),
        "findings": findings,
    }


def discover_skills(paths):
    """Find unique skill directories from user-supplied paths or default agent skill roots."""
    if not paths:
        candidates = [Path.home() / ".agents" / "skills", Path.home() / ".claude" / "skills"]
        roots = [p for p in candidates if p.exists()]
    else:
        roots = [Path(p).expanduser() for p in paths]

    found = []
    seen_real = set()

    def add_skill(skill_dir: Path):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.is_file():
            return
        real_md = os.path.normcase(os.path.realpath(skill_md))
        if real_md in seen_real:
            return
        seen_real.add(real_md)
        found.append(skill_dir.resolve())

    for root in roots:
        if not root.exists():
            continue
        if root.is_file() and root.name == "SKILL.md":
            add_skill(root.parent)
            continue
        if (root / "SKILL.md").is_file():
            add_skill(root)
            continue
        if root.is_dir():
            for child in sorted(root.iterdir()):
                if child.is_dir() and not child.name.startswith("."):
                    if (child / "SKILL.md").is_file():
                        add_skill(child)
                    elif (child / "skills").is_dir():
                        for sub in sorted((child / "skills").iterdir()):
                            if sub.is_dir() and (sub / "SKILL.md").is_file():
                                add_skill(sub)
            skills_sub = root / "skills"
            if skills_sub.is_dir():
                for child in sorted(skills_sub.iterdir()):
                    if child.is_dir() and not child.name.startswith(".") and (child / "SKILL.md").is_file():
                        add_skill(child)

    return found


def status_of(report):
    severities = {f["severity"] for f in report["findings"]}
    if "error" in severities:
        return "ERROR"
    if "warning" in severities:
        return "WARN"
    return "PASS"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("paths", nargs="*", help="skill directories, parent directories, or SKILL.md files (default: ~/.agents/skills and ~/.claude/skills)")
    ap.add_argument("--format", choices=["text", "json", "tsv"], default="text", help="output format (default: text)")
    ap.add_argument("--fail-on", choices=["error", "warning", "none"], default="error", help="exit 1 when findings reach this severity (default: error)")
    args = ap.parse_args()

    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    for raw in args.paths:
        if not Path(raw).expanduser().exists():
            ap.error(f"path does not exist: {raw}")

    skill_dirs = discover_skills(args.paths)
    if not skill_dirs:
        print("No SKILL.md files found.", file=sys.stderr)
        sys.exit(2)

    reports = [check_skill(d) for d in skill_dirs]
    errors = sum(1 for r in reports for f in r["findings"] if f["severity"] == "error")
    warnings = sum(1 for r in reports for f in r["findings"] if f["severity"] == "warning")
    passed = sum(1 for r in reports if not r["findings"])

    if args.format == "json":
        payload = {
            "summary": {
                "skills": len(reports),
                "passed": passed,
                "errors": errors,
                "warnings": warnings,
            },
            "results": reports,
        }
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    elif args.format == "tsv":
        for r in reports:
            if not r["findings"]:
                print(f"PASS\t{r['skill']}\tSKILL.md:1\tok\tno issues found")
            for f in r["findings"]:
                sev = "ERROR" if f["severity"] == "error" else "WARN"
                print(f"{sev}\t{r['skill']}\t{f['file']}:{f['line']}\t{f['code']}\t{f['message']}")
    else:
        for r in reports:
            st = status_of(r)
            print(f"{st:5}  {r['skill']} ({r['path']})")
            for f in r["findings"]:
                sev = "error" if f["severity"] == "error" else "warn "
                print(f"         [{sev}] {f['file']}:{f['line']} {f['code']}: {f['message']}")
        print(
            f"\nChecked {len(reports)} {'skill' if len(reports) == 1 else 'skills'}: "
            f"{passed} clean, {errors} {'error' if errors == 1 else 'errors'}, "
            f"{warnings} {'warning' if warnings == 1 else 'warnings'}."
        )

    if args.fail_on == "error" and errors > 0:
        sys.exit(1)
    if args.fail_on == "warning" and (errors > 0 or warnings > 0):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
