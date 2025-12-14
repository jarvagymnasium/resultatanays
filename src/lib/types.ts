// ============================================
// Database Types - Järva Gymnasium Resultatanalys
// ============================================

export interface User {
  id: string;
  email: string;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  role_id?: string;
  full_name?: string;
  created_at?: string;
}

export interface Role {
  id: string;
  name: 'admin' | 'teacher' | 'analyst';
  description?: string;
}

export type Permission = 
  | 'view_data' 
  | 'manage_classes' 
  | 'manage_courses' 
  | 'manage_students' 
  | 'manage_grades' 
  | 'manage_quarters';

export const PERMISSIONS: Record<Role['name'], Permission[]> = {
  admin: ['view_data', 'manage_classes', 'manage_courses', 'manage_students', 'manage_grades', 'manage_quarters'],
  teacher: ['view_data', 'manage_grades'],
  analyst: ['view_data']
};

export const PERMANENT_ADMINS = [
  'iman.ehsani@jarvagymnasium.se',
  'ala.nestani.rad@jarvagymnasium.se',
  'amir.sajadi@jarvagymnasium.se'
];

export interface Class {
  id: string;
  name: string;
  archived?: boolean;
  created_at?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  points?: number;
  archived?: boolean;
  created_at?: string;
}

export interface Student {
  id: string;
  name: string;  // Mapped from first_name + last_name
  first_name?: string;
  last_name?: string;
  class_id: string;
  is_active?: boolean;
  archived_at?: string;
  archived_reason?: string;
  graduated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClassCourseMapping {
  id: string;
  class_id: string;
  course_id: string;
}

export interface Grade {
  id: string;
  student_id: string;
  course_id: string;
  quarter_id: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null;
  grade_type: 'grade' | 'warning';  // 'grade' = vanligt betyg, 'warning' = F-varning
  teacher_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Quarter {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  locked?: boolean;
  created_at?: string;
}

export interface GradeHistory {
  id: string;
  student_id: string;
  course_id: string;
  quarter_id: string;
  from_grade: string | null;
  to_grade: string;
  change_type: 'improvement' | 'decline' | 'new';
  grade_type?: 'grade' | 'warning';
  teacher_id?: string;
  changed_by?: string;
  created_at?: string;
  notes?: string;
  // Snapshot data - preserves info even if student/course is deleted
  student_snapshot?: {
    first_name?: string;
    last_name?: string;
    class_id?: string;
    class_name?: string;
  } | null;
  course_snapshot?: {
    code?: string;
    name?: string;
  } | null;
  class_snapshot?: {
    id?: string;
    name?: string;
  } | null;
}

export interface Snapshot {
  id: string;
  name: string;
  quarter_id: string;
  notes?: string;
  analysis?: string | null;
  // Data mappas från DB-kolumner: student_snapshot, course_snapshot, class_snapshot
  // Betyg sparas INTE i snapshot - de hämtas via quarter_id från grades-tabellen
  data: {
    grades: Grade[];  // Alltid tom från DB, fylls via quarter_id
    students: Student[];
    courses: Course[];
    classes: Class[];
  };
  stats?: {
    totalFGrades: number;
    totalWarnings: number;
    passRate: number;
    averageGrade?: number;
  } | null;
  created_at: string;
  created_by?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
}

// UI State Types
export type TabId = 
  | 'warnings' 
  | 'progress' 
  | 'classes' 
  | 'courses' 
  | 'students' 
  | 'grades' 
  | 'quarters' 
  | 'archive' 
  | 'compare' 
  | 'snapshots';

export type GradeTypeFilter = 'grades' | 'warnings' | 'both';

export interface CourseFilters {
  search: string;
  classId: string;
  fOnly: boolean;
  onlyFavorites: boolean;
  sortBy: 'name_asc' | 'name_desc' | 'code_asc' | 'code_desc' | 'f_count_desc';
}

export interface WarningFilters {
  classIds: string[];
  courseId: string;
  gradeFilter: string;
  quarterId: string;
  sortBy: 'name' | 'class' | 'f_count';
  searchTerm: string;
}

// Chart Data Types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// Statistics Types
export interface DashboardStats {
  totalFGrades: number;
  totalWarnings: number;
  studentsWithF: number;
  worstCourse: Course | null;
  worstClass: Class | null;
  passRate: number;
  averageGrade: number;
}

export interface ProgressStats {
  totalImprovements: number;
  studentsWithImprovements: number;
  mostImprovedCourse: Course | null;
}

// Aggregated data for display
export interface StudentWithGrades extends Student {
  class?: Class;
  grades: Grade[];
  fCount: number;
  warningCount: number;
}

export interface CourseWithStats extends Course {
  fCount: number;
  warningCount: number;
  totalGrades: number;
  classes: Class[];
}

export interface ClassWithStats extends Class {
  studentCount: number;
  fCount: number;
  warningCount: number;
  courses: Course[];
}

// Grade value mappings for calculations
export const GRADE_VALUES: Record<string, number> = {
  'A': 5,
  'B': 4,
  'C': 3,
  'D': 2,
  'E': 1,
  'F': 0
};

export const GRADE_COLORS: Record<string, string> = {
  'A': '#22c55e', // green-500
  'B': '#84cc16', // lime-500
  'C': '#eab308', // yellow-500
  'D': '#f97316', // orange-500
  'E': '#ef4444', // red-500
  'F': '#991b1b', // red-800
};

