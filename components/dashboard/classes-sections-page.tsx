"use client";

import { Fragment, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  type ClassRoom
} from "@/services/classes";
import { useTeachers } from "@/services/teacher";

function normalizeRole(role: unknown): string | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized || null;
}

function toast(message: string) {
  if (typeof window !== "undefined" && typeof (window as any).toast === "function") {
    (window as any).toast(message);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return (error as any)?.message || fallback;
}

interface ClassFormState {
  name: string;
  capacity: string;
  academicYear: string;
  portal: "Kindervale" | "Daycare";
  homeroomTeacherId: string;
}

const emptyClassForm: ClassFormState = {
  name: "",
  capacity: "",
  academicYear: "",
  portal: "Kindervale",
  homeroomTeacherId: ""
};

export default function ClassesSectionsPage() {
  const { user } = useAuth();
  const role = normalizeRole((user as any)?.role);
  const readOnly = role === "principal";

  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: teachers = [] } = useTeachers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  const [showForm, setShowForm] = useState(false);
  const [classForm, setClassForm] = useState<ClassFormState>(emptyClassForm);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teacherName = (userId?: string | null) => {
    if (!userId) return "—";
    const match = teachers.find((teacher) => teacher.userId === userId);
    return match ? match.name : "—";
  };

  const resetForm = () => {
    setClassForm(emptyClassForm);
    setEditingClassId(null);
    setShowForm(false);
  };

  const startEdit = (classRoom: ClassRoom) => {
    setClassForm({
      name: classRoom.name || "",
      capacity: classRoom.capacity != null ? String(classRoom.capacity) : "",
      academicYear: classRoom.academicYear || "",
      portal: (classRoom.portal as "Kindervale" | "Daycare") || "Kindervale",
      homeroomTeacherId: classRoom.homeroomTeacherId || ""
    });
    setEditingClassId(classRoom.id);
    setShowForm(true);
  };

  const submitClass = async () => {
    const name = classForm.name.trim();
    const capacity = Number(classForm.capacity);
    if (!name) return toast("Class name is required");
    if (!Number.isFinite(capacity) || capacity <= 0) return toast("Enter a valid capacity");

    // classesTable.teacher is a required legacy text label, unused anywhere else in the portal --
    // keep it in sync with whichever homeroom teacher is picked so it's never a blank/confusing
    // second field for the admin to fill in separately.
    const homeroomTeacherName = classForm.homeroomTeacherId
      ? teachers.find((teacher) => teacher.userId === classForm.homeroomTeacherId)?.name || name
      : name;

    const payload = {
      name,
      teacher: homeroomTeacherName,
      capacity,
      academicYear: classForm.academicYear.trim() || undefined,
      portal: classForm.portal,
      homeroomTeacherId: classForm.homeroomTeacherId || undefined
    };

    setBusy(true);
    try {
      if (editingClassId) {
        await updateClass.mutateAsync({ id: editingClassId, payload });
        toast("Class updated successfully!");
      } else {
        await createClass.mutateAsync(payload);
        toast("Class created successfully!");
      }
      resetForm();
    } catch (error) {
      toast(errorMessage(error, "Failed to save class"));
    } finally {
      setBusy(false);
    }
  };

  const removeClass = async (classRoom: ClassRoom) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete class "${classRoom.name}"? This cannot be undone.`)) return;
    try {
      await deleteClass.mutateAsync(classRoom.id);
      toast("Class deleted successfully!");
      if (expandedClassId === classRoom.id) setExpandedClassId(null);
    } catch (error) {
      toast(errorMessage(error, "Failed to delete class"));
    }
  };

  return (
    <div className="panel">
      <h3>Classes &amp; Sections {readOnly ? <span className="role-badge">View Only</span> : null}</h3>

      {!readOnly && (
        <div style={{ marginBottom: 16 }}>
          {!showForm ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              + Add Class
            </button>
          ) : (
            <div className="panel" style={{ background: "#f8fafc" }}>
              <h4>{editingClassId ? "Edit Class" : "Add Class"}</h4>
              <div className="field">
                <label>Class Name</label>
                <input value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} placeholder="e.g. Prep-A" />
              </div>
              <div className="field">
                <label>Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={classForm.capacity}
                  onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Academic Year</label>
                <input
                  value={classForm.academicYear}
                  onChange={(e) => setClassForm({ ...classForm, academicYear: e.target.value })}
                  placeholder="e.g. 2025-2026"
                />
              </div>
              <div className="field">
                <label>Portal</label>
                <select value={classForm.portal} onChange={(e) => setClassForm({ ...classForm, portal: e.target.value as "Kindervale" | "Daycare" })}>
                  <option value="Kindervale">Kindervale</option>
                  <option value="Daycare">Daycare</option>
                </select>
              </div>
              <div className="field">
                <label>Homeroom Teacher</label>
                <select value={classForm.homeroomTeacherId} onChange={(e) => setClassForm({ ...classForm, homeroomTeacherId: e.target.value })}>
                  <option value="">None</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.userId || teacher.id} value={teacher.userId || ""}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" disabled={busy} onClick={submitClass}>
                  {editingClassId ? "Save Changes" : "Create Class"}
                </button>
                <button className="btn btn-outline" disabled={busy} onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Portal</th>
            <th>Academic Year</th>
            <th>Capacity</th>
            <th>Homeroom Teacher</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {classesLoading ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                Loading…
              </td>
            </tr>
          ) : classes.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                No classes yet.
              </td>
            </tr>
          ) : (
            classes.map((classRoom) => (
              <Fragment key={classRoom.id}>
                <tr>
                  <td>
                    <b>{classRoom.name}</b>
                  </td>
                  <td>{classRoom.portal || "Kindervale"}</td>
                  <td>{classRoom.academicYear || "—"}</td>
                  <td>{classRoom.capacity ?? "—"}</td>
                  <td>{teacherName(classRoom.homeroomTeacherId)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setExpandedClassId(expandedClassId === classRoom.id ? null : classRoom.id)}
                    >
                      {expandedClassId === classRoom.id ? "Hide Sections" : "Sections"}
                    </button>
                    {!readOnly && (
                      <>
                        {" "}
                        <button className="btn btn-outline btn-sm" onClick={() => startEdit(classRoom)}>
                          Edit
                        </button>{" "}
                        <button className="btn btn-outline btn-sm" onClick={() => removeClass(classRoom)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                {expandedClassId === classRoom.id && (
                  <tr>
                    <td colSpan={6}>
                      <SectionsManager classId={classRoom.id} readOnly={readOnly} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SectionsManager({ classId, readOnly }: { classId: string; readOnly: boolean }) {
  const { data: sections = [], isLoading } = useSections(classId);
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const [form, setForm] = useState({ name: "", capacity: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setForm({ name: "", capacity: "" });
    setEditingId(null);
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) return toast("Section name is required");
    const payload: { classId: string; name: string; capacity?: number } = { classId, name };
    if (form.capacity) payload.capacity = Number(form.capacity);

    setBusy(true);
    try {
      if (editingId) {
        await updateSection.mutateAsync({ id: editingId, payload });
        toast("Section updated successfully!");
      } else {
        await createSection.mutateAsync(payload);
        toast("Section created successfully!");
      }
      reset();
    } catch (error) {
      toast(errorMessage(error, "Failed to save section"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this section?")) return;
    try {
      await deleteSection.mutateAsync(id);
      toast("Section deleted successfully!");
    } catch (error) {
      toast(errorMessage(error, "Failed to delete section"));
    }
  };

  return (
    <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12 }}>
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>Capacity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                Loading…
              </td>
            </tr>
          ) : sections.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                No sections yet.
              </td>
            </tr>
          ) : (
            sections.map((section) => (
              <tr key={section.id}>
                <td>{section.name}</td>
                <td>{section.capacity ?? "—"}</td>
                <td>
                  {!readOnly && (
                    <>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setForm({ name: section.name, capacity: section.capacity != null ? String(section.capacity) : "" });
                          setEditingId(section.id);
                        }}
                      >
                        Edit
                      </button>{" "}
                      <button className="btn btn-outline btn-sm" onClick={() => remove(section.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!readOnly && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Section Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. A" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Capacity</label>
            <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {editingId ? "Save" : "Add Section"}
          </button>
          {editingId && (
            <button className="btn btn-outline" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
