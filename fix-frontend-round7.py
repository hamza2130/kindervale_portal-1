#!/usr/bin/env python3
"""
Kindervale Portal Frontend Patch — Round 7
==========================================
  A5. Staff attendance — connect to backend /staff-attendance endpoints
      - Fetch staff attendance in syncPortalData
      - Rewrite teacherAttendancePage to show per-day records with mark form
      - Add syncStaffAttendance bridge function

Apply:
  cd kindervale_portal-1
  python fix-frontend-round7.py
  git add -A && git commit -m "feat: staff attendance from backend with mark/view"
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


# ── 1. Add staff-attendance fetch to syncPortalData ───────────────────────────
print("1. Add /staff-attendance fetch to syncPortalData")

do(
    'fetchOptional("/documents"),',
    'fetchOptional("/documents"),\n      fetchOptional("/staff-attendance", { query: { fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), toDate: new Date().toISOString().slice(0,10) } }),',
    "fetch-staff-attendance"
)

# Add the variable to the destructuring
do(
    'daycareReportsResponse\n    ] = await Promise.all([',
    'daycareReportsResponse,\n      staffAttendanceResponse\n    ] = await Promise.all([',
    "destructure-staff-attendance"
)

# ── 2. Assign staffAttendanceRows to SCRIPT ───────────────────────────────────
print("\n2. Assign staffAttendanceRows to SCRIPT globals")

do(
    'teacherProfiles: mapTeacherProfilesForPortal(teacherRows)\n    });',
    'teacherProfiles: mapTeacherProfilesForPortal(teacherRows),\n      staffAttendanceRows: normalizeList(staffAttendanceResponse)\n    });',
    "assign-staff-attendance"
)


# ── 3. Add staffAttendanceRows variable in SCRIPT ────────────────────────────
print("\n3. Add staffAttendanceRows variable declaration in SCRIPT")

# Find the SCRIPT's variable declarations area
m = re.search(r'let feeRows=\[\]', d)
if m:
    insert_at = m.end()
    # Find the semicolon after it
    semi = d.find(';', insert_at)
    # After the next newline
    nl = d.find('\\r\\n', semi)
    if nl > 0:
        insertion = '\\r\\nvar staffAttendanceRows=(typeof staffAttendanceRows!=="undefined")?staffAttendanceRows:[];'
        d = d[:nl] + insertion + d[nl:]
        n += 1
        print(f"  OK    [script-var] — inserted")
    else:
        print(f"  SKIP  [script-var] — couldn't find insertion point")
else:
    print(f"  SKIP  [script-var] — feeRows declaration not found")


# ── 4. Rewrite teacherAttendancePage to use real data ─────────────────────────
print("\n4. Rewrite teacherAttendancePage with real staff attendance data")

# Find the FIRST teacherAttendancePage (admin version) using regex
m1 = re.search(r'function teacherAttendancePage\(\)\{[^}]+\}', d)
if m1:
    old_fn = m1.group()
    new_fn = (
        'function teacherAttendancePage(){'
        '\\\\r\\\\n  const today=new Date().toISOString().slice(0,10);'
        '\\\\r\\\\n  const teachers=staff.filter(s=>s.role===\\\\"Teacher\\\\");'
        '\\\\r\\\\n  const todayRecords=staffAttendanceRows.filter(r=>r.date===today);'
        '\\\\r\\\\n  const rows=teachers.map(s=>{'
        '\\\\r\\\\n    const rec=todayRecords.find(r=>r.teacherId===s.id);'
        '\\\\r\\\\n    const status=rec?rec.status:\\\\"—\\\\";'
        '\\\\r\\\\n    const statusLabel=status===\\\\"PRESENT\\\\"?\\\\"Present\\\\":status===\\\\"LATE\\\\"?\\\\"Late\\\\":status===\\\\"ABSENT\\\\"?\\\\"Absent\\\\":\\\\"Not Marked\\\\";'
        '\\\\r\\\\n    const statusPill=status===\\\\"—\\\\"?\\\\"Pending\\\\":statusLabel;'
        '\\\\r\\\\n    return `<tr><td><b>${s.name}</b></td><td>${s.dept}</td><td>${pill(statusPill)}</td>'
        '<td><select id=\\\\"sa_${s.id}\\\\" style=\\\\"padding:4px 8px;border-radius:6px;border:1px solid #ccd\\\\">'
        '<option value=\\\\"PRESENT\\\\" ${status===\\\\"PRESENT\\\\"?\\\\"selected\\\\":\\\\"\\\\"}>Present</option>'
        '<option value=\\\\"LATE\\\\" ${status===\\\\"LATE\\\\"?\\\\"selected\\\\":\\\\"\\\\"}>Late</option>'
        '<option value=\\\\"ABSENT\\\\" ${status===\\\\"ABSENT\\\\"?\\\\"selected\\\\":\\\\"\\\\"}>Absent</option>'
        '</select></td></tr>`;'
        '\\\\r\\\\n  }).join(\\\\"\\\\");'
        '\\\\r\\\\n  return `<div class=\\\\"panel\\\\"><h3>Staff Attendance — ${today}</h3>'
        '<table><thead><tr><th>Teacher</th><th>Department</th><th>Status</th><th>Mark</th></tr></thead>'
        '<tbody>${rows}</tbody></table>'
        '<div style=\\\\"margin-top:16px;text-align:right\\\\">'
        '<button class=\\\\"btn btn-primary\\\\" onclick=\\\\"saveStaffAttendance()\\\\">'
        'Save Attendance</button></div></div>`;'
        '\\\\r\\\\n}'
    )
    d = d.replace(old_fn, new_fn, 1)
    n += 1
    print(f"  OK    [rewrite-admin-attendance] — 1")
else:
    print(f"  SKIP  [rewrite-admin-attendance] — function not found")


# ── 5. Add saveStaffAttendance SCRIPT function ───────────────────────────────
print("\n5. Add saveStaffAttendance function in SCRIPT")

# Find a good place to inject — right after the teacherAttendancePage function
inject_marker = '\\\\r\\\\n}\\\\r\\\\nlet principalTTView='
if inject_marker in d:
    save_fn = (
        '\\\\r\\\\nfunction saveStaffAttendance(){'
        'if(window.__saveStaffAttendanceApi)return window.__saveStaffAttendanceApi();'
        'toast(\\\\"Action unavailable\\\\");}'
    )
    d = d.replace(inject_marker, save_fn + inject_marker, 1)
    n += 1
    print(f"  OK    [script-saveStaffAttendance] — 1")
else:
    print(f"  SKIP  [script-saveStaffAttendance] — injection point not found")


# ── 6. Add __saveStaffAttendanceApi bridge function ───────────────────────────
print("\n6. Add __saveStaffAttendanceApi bridge")

# Add after the __saveTeacherProfileApi function
bridge_marker = 'win.__submitLessonPlanApi'
if bridge_marker in d:
    bridge_fn = '''win.__saveStaffAttendanceApi = async () => {
        const teachers = (win.staff || []).filter((s: any) => s.role === "Teacher");
        const today = new Date().toISOString().slice(0, 10);
        const records = teachers.map((s: any) => {
          const el = document.getElementById("sa_" + s.id) as HTMLSelectElement | null;
          return { teacherId: s.id, status: el?.value || "PRESENT" };
        });
        try {
          await apiRequest("/staff-attendance/bulk", { method: "POST", data: { date: today, records } });
          const refreshed = await fetchOptional("/staff-attendance", { query: { fromDate: today, toDate: today } });
          const items = Array.isArray(refreshed) ? refreshed : (refreshed?.items ?? refreshed?.data?.items ?? []);
          win.staffAttendanceRows = [...(win.staffAttendanceRows || []).filter((r: any) => r.date !== today), ...items];
          if (typeof win.toast === "function") win.toast("Staff attendance saved \\u2714");
          if (typeof win.navigate === "function") win.navigate("teacherattendance");
        } catch (error) {
          if (typeof win.toast === "function") win.toast("Failed: " + (error as any)?.message);
        }
      };

      '''
    d = d.replace(bridge_marker, bridge_fn + bridge_marker, 1)
    n += 1
    print(f"  OK    [bridge-saveStaffAttendance] — 1")
else:
    print(f"  SKIP  [bridge-saveStaffAttendance] — injection point not found")


# ── Write ─────────────────────────────────────────────────────────────────────
if d == orig:
    print("\nNo changes."); sys.exit(0)
open(FILE, "w", encoding="utf-8").write(d)
print(f"\n✅ {n} replacement(s) written to {FILE}")
