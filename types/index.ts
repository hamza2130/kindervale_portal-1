export type Role = "admin" | "daycareadmin" | "daycare_admin" | "principal" | "teacher" | "parent" | "accountant";

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: Role;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
  linkedStudentIds?: string[];
  homeroom?: string;
  designation?: string;
  // Set by the backend whenever an Admin/Accountant generated or reset this login's password --
  // gates every page behind a forced change-password screen until cleared.
  mustChangePassword?: boolean;
}

export interface Student {
  id: string;
  name: string;
  className: string;
  age: number;
  birthday: string;
  attendance: number;
  parentName: string;
  parentId?: string;
  phone: string;
  feeStatus: "Paid" | "Pending" | "Partial";
}

export interface Teacher {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  className: string;
  /** Matches backend teacherAttendanceEnum: PRESENT | LATE | ABSENT */
  attendance: "Present" | "Late" | "Absent";
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  studentIds: string[];
}

export interface ClassRoom {
  id: string;
  name: string;
  teacher: string;
  capacity: number;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  /** Matches backend studentAttendanceStatusEnum: PRESENT | LATE | ABSENT | EXCUSED */
  status: "Present" | "Absent" | "Late" | "Excused";
}

export interface Fee {
  id: string;
  invoice: string;
  studentId: string;
  amount: number;
  dueDate: string;
  status: "Paid" | "Pending" | "Partial";
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  className: string;
  date: string;
  maxMarks: number;
}

export interface Subject {
  id: string;
  name: string;
  teacherId: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  date: string;
  /** Matches backend notificationAudienceEnum: ALL | ADMIN | PRINCIPAL | TEACHER | PARENT | STUDENT */
  audience: "ALL" | "ADMIN" | "PRINCIPAL" | "TEACHER" | "PARENT" | "STUDENT";
}

export interface Settings {
  schoolName: string;
  academicYear: string;
  timezone: string;
}

export interface DashboardStats {
  students: number;
  teachers: number;
  attendanceRate: number;
  pendingFees: number;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

