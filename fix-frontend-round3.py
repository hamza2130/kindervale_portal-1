#!/usr/bin/env python3
"""
Kindervale Portal Frontend Patch — Round 3
==========================================
Fixes:
  1. VM239:2 TypeError on startTime — guard ALL unguarded .map() calls on
     timetable slot arrays (admin weekly, teacher daily/weekly, daycare daily/weekly)
  2. Bridge mapTimetablesForPortal — skip null/undefined slots and default
     missing startTime to "" so the portal never crashes on bad timetable data
  3. classPickerOptions — add fallback to current.homeroom (set by the bridge
     from authUser.homeroom) so teachers whose homeroom isn't in the static
     TEACHER_HOMEROOM map still get restricted to their class

Apply:
  cd kindervale_portal-1
  python3 fix-frontend-round3.py
  git add -A && git commit -m "fix: guard timetable maps + class picker resilience"
  git push origin main
"""

import sys, os

FILE = "components/dashboard/exact-portal.tsx"

if not os.path.isfile(FILE):
    print(f"ERROR: {FILE} not found. Run from the kindervale_portal-1 root.", file=sys.stderr)
    sys.exit(1)

d = open(FILE, encoding="utf-8").read()
original = d

replacements = 0

def replace_once(old, new, label):
    global d, replacements
    count = d.count(old)
    if count == 0:
        print(f"  SKIP [{label}] — marker not found (already patched?)")
        return
    if count > 1:
        print(f"  WARN [{label}] — marker found {count} times, replacing ALL")
    d = d.replace(old, new)
    replacements += count
    print(f"  OK   [{label}] — replaced {count} occurrence(s)")


# ============================================================================
# FIX 1: Guard unguarded .map() calls on timetable slot arrays
# ============================================================================
print("FIX 1: Guard timetable .map() calls in SCRIPT string")

# 1a. Admin weekly timetable — WEEK_TT[d].map(([t,s,c])=>  (no filter)
replace_once(
    '${WEEK_TT[d].map(([t,s,c])=>',
    '${(WEEK_TT[d]||[]).filter(function(e){return e&&e[0];}).map(([t,s,c])=>',
    "admin-weekly"
)

# 1b. Teacher daily timetable — slots.map(([t,s,c])=>
replace_once(
    'slots.length?slots.map(([t,s,c])=>',
    'slots.length?slots.filter(function(e){return e&&e[0];}).map(([t,s,c])=>',
    "teacher-daily"
)

# 1c. Teacher weekly + Daycare weekly — slots.map(([t,s])=>  (2 occurrences)
replace_once(
    'let cells=slots.map(([t,s])=>',
    'let cells=slots.filter(function(e){return e&&e[0];}).map(([t,s])=>',
    "teacher+daycare-weekly"
)

# 1d. Daycare daily — todaySlots.map(([t,s])=>
replace_once(
    'todaySlots.length?todaySlots.map(([t,s])=>',
    'todaySlots.length?todaySlots.filter(function(e){return e&&e[0];}).map(([t,s])=>',
    "daycare-daily"
)


# ============================================================================
# FIX 2: Bridge mapTimetablesForPortal — guard against bad slot data
# ============================================================================
print("\nFIX 2: Guard mapTimetablesForPortal bridge function")

replace_once(
    'timetableRows.forEach((slot: any) => {\n      const day = normalizeTimetableDay(slot.dayOfWeek || slot.day);',
    'timetableRows.forEach((slot: any) => {\n      if (!slot) return;\n      const day = normalizeTimetableDay(slot.dayOfWeek || slot.day);',
    "bridge-null-slot"
)

replace_once(
    "const time = slot.endTime && slot.endTime !== slot.startTime ? `${slot.startTime} - ${slot.endTime}` : slot.startTime;",
    'const time = slot.endTime && slot.endTime !== slot.startTime ? `${slot.startTime || ""} - ${slot.endTime}` : (slot.startTime || "");',
    "bridge-startTime-fallback"
)


# ============================================================================
# FIX 3: classPickerOptions — fallback to current.homeroom from bridge
# ============================================================================
print("\nFIX 3: Improve classPickerOptions teacher class fallback")

replace_once(
    'var mine=selected||((current&&current.role===\\"teacher\\")?teacherClass(current.name):null);',
    'var mine=selected||((current&&current.role===\\"teacher\\")?(teacherClass(current.name)||current.homeroom||null):null);',
    "classPicker-homeroom-fallback"
)


# ============================================================================
# Write result
# ============================================================================
if d == original:
    print("\nNo changes made — file may already be patched.")
    sys.exit(0)

open(FILE, "w", encoding="utf-8").write(d)
print(f"\nDone — {replacements} replacement(s) applied to {FILE}")
