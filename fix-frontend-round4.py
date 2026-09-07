#!/usr/bin/env python3
"""
Kindervale Portal Frontend Patch — Round 4
==========================================
Fixes (after deep-dive tracing every data flow end-to-end):

  A1. Document/booklist viewing — documentFileUrl doesn't handle data: URLs
  A2. Lesson plan approval — use targeted syncLessonPlans instead of massive syncPortalData
  A6. Timetable class dropdown — derives classes from students instead of backend /classes
  A8. Daycare daily reports shown to all teachers — menu not filtered by daycare assignment

Apply:
  cd kindervale_portal-1
  python3 fix-frontend-round4.py
  git add -A && git commit -m "fix: documents, lesson plans, timetable classes, daycare menu"
  git push origin main
"""
import sys, os, re

FILE = "components/dashboard/exact-portal.tsx"
if not os.path.isfile(FILE):
    print(f"ERROR: {FILE} not found — run from repo root", file=sys.stderr)
    sys.exit(1)

d = open(FILE, encoding="utf-8").read()
original = d
n = 0

def do(old, new, label, expect=1):
    global d, n
    c = d.count(old)
    if c == 0:
        print(f"  SKIP  [{label}] — not found (already patched?)")
        return False
    if c != expect:
        print(f"  WARN  [{label}] — expected {expect}, found {c}")
    d = d.replace(old, new)
    n += c
    print(f"  OK    [{label}] — {c} replacement(s)")
    return True


# ── A1: documentFileUrl — pass through data: URLs ────────────────────────────
print("A1: documentFileUrl — data: URL passthrough")
do(
    'return /^https?:/i.test(url) ? url : `${STORAGE_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;',
    'if (/^data:/i.test(url)) return url;\n    return /^https?:/i.test(url) ? url : `${STORAGE_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;',
    "A1"
)


# ── A2: Lesson plan review — targeted sync ───────────────────────────────────
print("\nA2: Lesson plan review — syncLessonPlans instead of syncPortalData")
# approve
do(
    'await apiRequest(`/lesson-plans/${id}/review`, { method: "POST", data: { status: "APPROVED" } });\n          await syncPortalData();',
    'await apiRequest(`/lesson-plans/${id}/review`, { method: "POST", data: { status: "APPROVED" } });\n          await syncLessonPlans();',
    "A2-approve"
)
# reject
do(
    'await apiRequest(`/lesson-plans/${id}/review`, { method: "POST", data: { status: "REJECTED" } });\n          await syncPortalData();',
    'await apiRequest(`/lesson-plans/${id}/review`, { method: "POST", data: { status: "REJECTED" } });\n          await syncLessonPlans();',
    "A2-reject"
)
# returnLP
do(
    'await apiRequest(`/lesson-plans/${id}/review`, { method: "POST", data: { status: "REJECTED", reviewRemarks: "Returned for revision" } });\n          await syncPortalData();',
    'await apiRequest(`/lesson-plans/${id}/review`, { method: "POST", data: { status: "REJECTED", reviewRemarks: "Returned for revision" } });\n          await syncLessonPlans();',
    "A2-return"
)


# ── A6: Timetable class dropdown — use portalClassNames() ────────────────────
print("\nA6: Timetable class dropdown — backend classes")
# Extract the exact old string at runtime via regex (avoids escape hell)
a6 = list(re.finditer(r'const classes=\[\.\.\.new Set\(students\.filter[^;]+;', d))
if a6:
    a6_old = a6[0].group()
    do(a6_old, "const classes=portalClassNames();", "A6", expect=len(a6))
else:
    print("  SKIP  [A6] — pattern not found (already patched?)")


# ── A8: Daycare menu — hide dailyreports for non-daycare teachers ────────────
print("\nA8: Daycare daily reports — filter menu for daycare teachers only")
# Extract the exact old menuForRole filter line at runtime
a8 = list(re.finditer(
    r'return base\.filter\(entry=>entry\[0\]!==\\{0,2}"notifications\\{0,2}"\);',
    d
))
if a8:
    a8_old = a8[0].group()
    # Build new by appending the dailyreports check with same escaping
    # The old: return base.filter(entry=>entry[0]!==\\"notifications\\");
    # The \\\" pattern is the escaped quote inside the SCRIPT template literal
    # We need: &&(entry[0]!==\\"dailyreports\\"||teacherDaycareRoom(current.name))
    q = a8_old[a8_old.index('!==') + 3 : a8_old.index('notifications')]  # captures the quote escape pattern
    a8_new = a8_old.replace(
        ");",
        f"&&(entry[0]!=={q}dailyreports{q}||teacherDaycareRoom(current.name)));"
    )
    do(a8_old, a8_new, "A8")
else:
    print("  SKIP  [A8] — pattern not found (already patched?)")


# ── Write ─────────────────────────────────────────────────────────────────────
if d == original:
    print("\nNo changes — already patched?")
    sys.exit(0)

open(FILE, "w", encoding="utf-8").write(d)
print(f"\n✅ {n} replacement(s) written to {FILE}")
