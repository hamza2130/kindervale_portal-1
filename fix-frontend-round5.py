#!/usr/bin/env python3
"""
Kindervale Portal Frontend Patch — Round 5
==========================================
  A3. Teacher profile save — visible error messages instead of generic "Action failed"
  A4. Fee challan — add Month column, filter by selected feeTermFilter

Apply:
  cd kindervale_portal-1
  python3 fix-frontend-round5.py
  git add -A && git commit -m "fix: teacher profile errors, fee challan per-month"
  git push origin main
"""
import sys, os, re

FILE = "components/dashboard/exact-portal.tsx"
if not os.path.isfile(FILE):
    print(f"ERROR: {FILE} not found", file=sys.stderr); sys.exit(1)

d = open(FILE, encoding="utf-8").read()
orig = d
n = 0

def do(old, new, label, expect=1):
    global d, n
    c = d.count(old)
    if c == 0: print(f"  SKIP  [{label}] — not found"); return False
    if c != expect: print(f"  WARN  [{label}] — expected {expect}, found {c}")
    d = d.replace(old, new); n += c
    print(f"  OK    [{label}] — {c}"); return True


# ── A3: Teacher profile — show real error ─────────────────────────────────────
print("A3: Teacher profile — visible error messages")
do(
    'await apiRequest("/teachers/me", { method: "PATCH", data: { name, phone, qualifications, bio } });\n          await syncStaff();\n          await apiRequest("/auth/profile").catch(() => null);\n          notify("Teacher profile saved");',
    'await apiRequest("/teachers/me", { method: "PATCH", data: { name, phone, qualifications, bio } });\n          await syncStaff();\n          await apiRequest("/auth/profile").catch(() => null);\n          notify("Teacher profile saved \\u2714");',
    "A3-success"
)
do(
    'notify(errorMessage(error, "Action failed"));\n        }\n      };\n\n      win.__submitLessonPlanApi',
    'notify("Profile save failed: " + errorMessage(error, "unknown error"));\n          console.error("[KV] Teacher profile save error:", error);\n        }\n      };\n\n      win.__submitLessonPlanApi',
    "A3-error"
)


# ── A4: Fee challan — per-month filtering + Month column ──────────────────────
print("\nA4: Fee challan — per-month display")

# 4a. Add "Month" header column (this is in the SCRIPT string with \\" quotes)
do(
    '<th>Invoice</th><th>Student</th><th>Amount</th><th>Status</th><th>Action</th>',
    '<th>Invoice</th><th>Student</th><th>Month</th><th>Amount</th><th>Status</th><th>Action</th>',
    "A4-header"
)

# 4b. Fix the challan row rendering — add term filter AND Month cell
# Extract the exact old string at runtime via regex
m = re.search(r"const rows=feeRows\.filter\(f=>f\.portal===", d[960000:])
if m:
    offset = 960000 + m.start()
    join_pos = d.find('.join(', offset)
    semi_pos = d.find(';', join_pos)
    old_rows = d[offset:semi_pos+1]
    
    # The old renders: filter by portal only, no month column
    # New: also filter by term, add feeCycleLabel(f) column
    new_rows = old_rows.replace(
        ".portal===",
        ".portal==="
    )
    # Find the exact portal filter end to add term filter
    # Old: feeRows.filter(f=>f.portal===\\\"Kindervale\\\")
    # New: feeRows.filter(f=>f.portal===\\\"Kindervale\\\"&&f.term===feeTermFilter)
    portal_filter_end = old_rows.find(").map(")
    if portal_filter_end > 0:
        old_filter = old_rows[:portal_filter_end+1]  # up to and including )
        new_filter = old_filter[:-1] + "&&f.term===feeTermFilter)"  # insert before closing )
        new_rows = old_rows.replace(old_filter, new_filter, 1)
        
        # Now add Month cell after student name
        new_rows = new_rows.replace(
            "<td>${f.name}</td><td>${money(",
            "<td>${f.name}</td><td>${feeCycleLabel(f)}</td><td>${money("
        )
        
        if old_rows != new_rows:
            d = d.replace(old_rows, new_rows, 1)
            n += 1
            print(f"  OK    [A4-rows] — 1")
        else:
            print(f"  SKIP  [A4-rows] — no change")
    else:
        print(f"  SKIP  [A4-rows] — couldn't find .map( boundary")
else:
    print(f"  SKIP  [A4-rows] — pattern not found in expected range")


# ── Write ─────────────────────────────────────────────────────────────────────
if d == orig:
    print("\nNo changes."); sys.exit(0)
open(FILE, "w", encoding="utf-8").write(d)
print(f"\n✅ {n} replacement(s) written to {FILE}")
