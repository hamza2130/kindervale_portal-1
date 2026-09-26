"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/services/query-keys";
import { useCreateResource, useDeleteResource, useResourceList, useUpdateResource } from "@/services/resource-hooks";
import { apiRequest } from "@/services/api";
import type { Teacher } from "@/types";

export type TeacherPayload = Partial<Omit<Teacher, "id" | "email" | "attendance">> & {
  userId?: string;
  attendance?: "PRESENT" | "LATE" | "ABSENT";
};

const STORAGE_KEY = "kindervale-teacher-attendance-overrides";

function attendanceLabel(status: string | undefined): Teacher["attendance"] {
  if (status === "LATE" || status === "Late") return "Late";
  if (status === "ABSENT" || status === "Absent") return "Absent";
  return "Present";
}

function readTeacherAttendanceOverrides(): Record<string, Teacher["attendance"]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Teacher["attendance"]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTeacherAttendanceOverrides(overrides: Record<string, Teacher["attendance"]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // keep the UI working if storage is unavailable
  }
}

/**
 * Maps a raw teacher row (joined with the users table on the backend)
 * to the frontend Teacher shape. The backend now returns name + email
 * via a LEFT JOIN with usersTable.
 */
export function mapTeacher(row: Record<string, unknown>): Teacher {
  return {
    id: String(row.id),
    userId: row.userId ? String(row.userId) : undefined,
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    subject: String(row.subject ?? ""),
    className: String(row.className ?? ""),
    attendance: attendanceLabel(String(row.attendance ?? "PRESENT"))
  };
}

export function useTeachers() {
  const query = useResourceList<Record<string, unknown>, Teacher[]>(queryKeys.teachers, "/teachers", {
    params: { page: 1, limit: 10 },
    select: (items) => items?.map(mapTeacher) ?? []
  });

  const overrides = readTeacherAttendanceOverrides();
  const data = (query.data ?? []).map((teacher) => {
    const override = overrides[String(teacher.id)];
    return override ? { ...teacher, attendance: override } : teacher;
  });

  return { ...query, data };
}

export const useCreateTeacher = () => useCreateResource<Teacher, TeacherPayload>(queryKeys.teachers, "/teachers");

export const useUpdateTeacher = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TeacherPayload }) => apiRequest<Teacher>(`/teachers/${id}`, { method: "PATCH", data: payload }),
    onSuccess: (updatedTeacher, variables) => {
      const overrides = readTeacherAttendanceOverrides();
      const normalizedAttendance = variables.payload.attendance ? attendanceLabel(variables.payload.attendance) : updatedTeacher.attendance ?? "Present";
      const nextOverrides = { ...overrides, [String(variables.id)]: normalizedAttendance };
      writeTeacherAttendanceOverrides(nextOverrides);

      queryClient.setQueryData<Teacher[] | undefined>(queryKeys.teachers, (current) => {
        if (!current) return current;
        return current.map((teacher) => String(teacher.id) === String(variables.id)
          ? { ...teacher, ...updatedTeacher, attendance: normalizedAttendance }
          : teacher);
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.teachers });
    }
  });
};

export const useDeleteTeacher = () => useDeleteResource(queryKeys.teachers, "/teachers");

