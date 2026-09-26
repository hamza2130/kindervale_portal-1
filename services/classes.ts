"use client";
import { queryKeys } from "@/services/query-keys";
import { useResourceList, useCreateResource, useUpdateResource, useDeleteResource } from "@/services/resource-hooks";

const CLASS_PATH = "/classes";
const CLASS_KEY = queryKeys.classes;
const SECTION_PATH = "/sections";
const SECTION_KEY = queryKeys.sections;

export interface ClassRoom {
  id: string;
  name: string;
  teacher?: string;
  homeroomTeacherId?: string | null;
  academicYear?: string;
  portal?: "Kindervale" | "Daycare";
  capacity?: number;
}
export interface Section { id: string; name: string; classId: string; className?: string; capacity?: number; }
export type ClassPayload = Partial<Omit<ClassRoom, "id">>;
export type SectionPayload = Partial<Omit<Section, "id">>;

export function useClasses() { return useResourceList<ClassRoom>(CLASS_KEY, CLASS_PATH); }
export function useCreateClass() { return useCreateResource<ClassRoom, ClassPayload>(CLASS_KEY, CLASS_PATH); }
export function useUpdateClass() { return useUpdateResource<ClassRoom, ClassPayload>(CLASS_KEY, CLASS_PATH); }
export function useDeleteClass() { return useDeleteResource(CLASS_KEY, CLASS_PATH); }

export function useSections(classId?: string) {
  return useResourceList<Section>(SECTION_KEY, SECTION_PATH, { params: classId ? { classId } : undefined });
}
export function useCreateSection() { return useCreateResource<Section, SectionPayload>(SECTION_KEY, SECTION_PATH); }
export function useUpdateSection() { return useUpdateResource<Section, SectionPayload>(SECTION_KEY, SECTION_PATH); }
export function useDeleteSection() { return useDeleteResource(SECTION_KEY, SECTION_PATH); }
