'use client';

import { create } from 'zustand';
import { supabase } from './supabase';
import type { 
  User, 
  Class, 
  Course, 
  Student, 
  Grade, 
  Quarter, 
  ClassCourseMapping,
  GradeHistory,
  Snapshot,
  Role,
  TabId,
  GradeTypeFilter,
  CourseFilters,
  PERMISSIONS,
  Permission
} from './types';
import { PERMANENT_ADMINS } from './types';

// ============================================
// Cache System
// ============================================
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(tableName: string, filters: Record<string, unknown> = {}): string {
  return `${tableName}_${JSON.stringify(filters)}`;
}

function isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
  return !!entry && (Date.now() - entry.timestamp < CACHE_DURATION);
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function getCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry || !isCacheValid(entry)) return null;
  return entry.data;
}

export function clearCache(pattern: string | null = null): void {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

// ============================================
// App Store
// ============================================

interface AppState {
  // Auth
  user: User | null;
  userRole: Role['name'] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Data
  classes: Class[];
  courses: Course[];
  students: Student[];
  grades: Grade[];
  quarters: Quarter[];
  classCourseMappings: ClassCourseMapping[];
  gradeHistory: GradeHistory[];
  snapshots: Snapshot[];
  roles: Record<string, Role>;
  
  // Archive data
  archivedStudents: Student[];
  archivedCourses: Course[];
  archivedClasses: Class[];
  
  // Active states
  activeQuarter: Quarter | null;
  activeTab: TabId;
  activeGradeTypeFilter: GradeTypeFilter;
  
  // UI State
  favoriteCourseIds: Set<string>;
  courseFilters: CourseFilters;
  selectedClassIds: string[];
  
  // Actions - Auth
  setUser: (user: User | null) => void;
  setUserRole: (role: Role['name'] | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  
  // Actions - Data fetching
  fetchAll: () => Promise<void>;
  fetchClasses: (useCache?: boolean) => Promise<void>;
  fetchCourses: () => Promise<void>;
  fetchStudents: () => Promise<void>;
  fetchGrades: () => Promise<void>;
  fetchQuarters: () => Promise<void>;
  fetchClassCourseMappings: () => Promise<void>;
  fetchGradeHistory: () => Promise<void>;
  fetchSnapshots: () => Promise<void>;
  fetchArchivedData: () => Promise<void>;
  fetchUserRole: () => Promise<void>;
  
  // Actions - CRUD
  addClass: (name: string, courseIds: string[]) => Promise<void>;
  updateClass: (id: string, name: string, courseIds: string[]) => Promise<void>;
  archiveClass: (id: string) => Promise<void>;
  
  addCourse: (name: string, code: string, points?: number) => Promise<void>;
  archiveCourse: (id: string) => Promise<void>;
  
  addStudent: (name: string, classId: string) => Promise<void>;
  archiveStudent: (id: string) => Promise<void>;
  
  setGrade: (studentId: string, courseId: string, grade: string, gradeType: 'grade' | 'warning') => Promise<void>;
  clearGrade: (studentId: string, courseId: string) => Promise<void>;
  
  addQuarter: (name: string, startDate?: string, endDate?: string) => Promise<void>;
  setActiveQuarter: (quarterId: string) => Promise<void>;
  deleteQuarter: (quarterId: string) => Promise<void>;
  
  createSnapshot: (name: string, notes?: string) => Promise<void>;
  deleteSnapshot: (snapshotId: string) => Promise<void>;
  saveSnapshotAnalysis: (snapshotId: string, analysis: string) => Promise<void>;
  
  reactivateStudent: (id: string) => Promise<void>;
  reactivateCourse: (id: string) => Promise<void>;
  reactivateClass: (id: string) => Promise<void>;
  permanentDeleteStudent: (id: string) => Promise<void>;
  permanentDeleteCourse: (id: string) => Promise<void>;
  permanentDeleteClass: (id: string) => Promise<void>;
  
  // Actions - UI
  setActiveTab: (tab: TabId) => void;
  setActiveGradeTypeFilter: (filter: GradeTypeFilter) => void;
  toggleFavoriteCourse: (courseId: string) => void;
  setCourseFilters: (filters: Partial<CourseFilters>) => void;
  setSelectedClassIds: (ids: string[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Permissions
  userCan: (action: Permission) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  userRole: null,
  isLoading: true,
  isAuthenticated: false,
  
  classes: [],
  courses: [],
  students: [],
  grades: [],
  quarters: [],
  classCourseMappings: [],
  gradeHistory: [],
  snapshots: [],
  roles: {},
  
  archivedStudents: [],
  archivedCourses: [],
  archivedClasses: [],
  
  activeQuarter: null,
  activeTab: 'warnings',
  activeGradeTypeFilter: 'grades',
  
  favoriteCourseIds: new Set(),
  courseFilters: {
    search: '',
    classId: '',
    fOnly: false,
    onlyFavorites: false,
    sortBy: 'name_asc'
  },
  selectedClassIds: [],

  // Auth Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setUserRole: (role) => set({ userRole: role }),
  
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      if (data.user) {
        set({ user: { id: data.user.id, email: data.user.email! }, isAuthenticated: true });
        await get().fetchUserRole();
        await get().fetchAll();
        return { success: true };
      }
      return { success: false, error: 'Ingen användare returnerades' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      set({ isLoading: false });
    }
  },
  
  logout: async () => {
    await supabase.auth.signOut();
    clearCache();
    set({
      user: null,
      userRole: null,
      isAuthenticated: false,
      classes: [],
      courses: [],
      students: [],
      grades: [],
      quarters: [],
      classCourseMappings: [],
      gradeHistory: [],
      snapshots: [],
      activeQuarter: null
    });
  },
  
  checkSession: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ 
          user: { id: session.user.id, email: session.user.email! },
          isAuthenticated: true 
        });
        await get().fetchUserRole();
        await get().fetchAll();
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchUserRole: async () => {
    const { user } = get();
    if (!user) return;
    
    const userEmail = user.email.toLowerCase();
    
    // Check permanent admins first (case-insensitive)
    const isPermanentAdmin = PERMANENT_ADMINS.some(
      email => email.toLowerCase() === userEmail
    );
    
    if (isPermanentAdmin) {
      set({ userRole: 'admin' });
      return;
    }
    
    try {
      // First get profile with role_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', user.id)
        .single();
      
      if (profileError || !profileData?.role_id) {
        // Default to admin if no profile exists
        set({ userRole: 'admin' });
        return;
      }
      
      // Then get role name
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profileData.role_id)
        .single();
      
      if (roleError || !roleData) {
        set({ userRole: 'admin' });
        return;
      }
      
      set({ userRole: roleData.name as Role['name'] });
    } catch (error) {
      console.error('Error fetching user role:', error);
      set({ userRole: 'admin' }); // Default to admin on error
    }
  },

  // Data fetching
  fetchAll: async () => {
    // First fetch quarters (sets activeQuarter needed by fetchGrades)
    await get().fetchQuarters();
    
    // Then fetch everything else in parallel
    const fetchFns = [
      get().fetchClasses(),
      get().fetchCourses(),
      get().fetchStudents(),
      get().fetchClassCourseMappings(),
      get().fetchGrades(),
      get().fetchGradeHistory(),
      get().fetchArchivedData()
    ];
    await Promise.all(fetchFns);
    
    const state = get();
    console.log('Data loaded - classes:', state.classes.length, 
                'courses:', state.courses.length, 
                'students:', state.students.length, 
                'grades:', state.grades.length, 
                'quarters:', state.quarters.length,
                'activeQuarter:', state.activeQuarter?.name || 'NONE');
  },
  
  fetchClasses: async (useCache = true) => {
    const cacheKey = getCacheKey('classes');
    if (useCache) {
      const cached = getCache<Class[]>(cacheKey);
      if (cached) {
        set({ classes: cached });
        return;
      }
    }
    
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('is_active', true)  // Soft delete: only active classes
      .order('name');
    
    if (!error && data) {
      setCache(cacheKey, data);
      set({ classes: data });
    }
  },
  
  fetchCourses: async () => {
    const cacheKey = getCacheKey('courses');
    const cached = getCache<Course[]>(cacheKey);
    if (cached) {
      set({ courses: cached });
      return;
    }
    
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('is_active', true)  // Soft delete: only active courses
      .order('name');
    
    if (!error && data) {
      setCache(cacheKey, data);
      set({ courses: data });
    }
  },
  
  fetchStudents: async () => {
    const cacheKey = getCacheKey('students');
    const cached = getCache<Student[]>(cacheKey);
    if (cached) {
      set({ students: cached });
      return;
    }
    
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(name)')
      .eq('is_active', true)  // Soft delete: only active students
      .order('last_name');
    
    if (!error && data) {
      // Transform data to include full name
      const transformedData = data.map(s => ({
        ...s,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim()
      }));
      setCache(cacheKey, transformedData);
      set({ students: transformedData });
    }
  },
  
  fetchGrades: async () => {
    const { activeQuarter } = get();
    if (!activeQuarter) return;
    
    const cacheKey = getCacheKey('grades', { quarter_id: activeQuarter.id });
    const cached = getCache<Grade[]>(cacheKey);
    if (cached) {
      set({ grades: cached });
      return;
    }
    
    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('quarter_id', activeQuarter.id);
    
    if (!error && data) {
      setCache(cacheKey, data);
      set({ grades: data });
    }
  },
  
  fetchQuarters: async () => {
    const { data, error } = await supabase
      .from('quarters')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      set({ quarters: data });
      const active = data.find(q => q.is_active);
      if (active) {
        set({ activeQuarter: active });
      }
    }
  },
  
  fetchClassCourseMappings: async () => {
    const { data, error } = await supabase
      .from('course_class')
      .select('*');
    
    if (!error && data) {
      set({ classCourseMappings: data });
    }
  },
  
  fetchGradeHistory: async () => {
    const { data, error } = await supabase
      .from('grade_history')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      set({ gradeHistory: data });
    }
  },
  
  
  fetchArchivedData: async () => {
    const [studentsRes, coursesRes, classesRes] = await Promise.all([
      supabase.from('students').select('*, classes(name)').eq('is_active', false).order('archived_at', { ascending: false }),
      supabase.from('courses').select('*').eq('is_active', false).order('archived_at', { ascending: false }),
      supabase.from('classes').select('*').eq('is_active', false).order('archived_at', { ascending: false })
    ]);
    
    // Transform student data to include full name
    const transformedStudents = (studentsRes.data || []).map(s => ({
      ...s,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim()
    }));
    
    set({
      archivedStudents: transformedStudents,
      archivedCourses: coursesRes.data || [],
      archivedClasses: classesRes.data || []
    });
  },

  // CRUD Actions
  addClass: async (name, courseIds) => {
    const { error } = await supabase.from('classes').insert({ name });
    if (error) throw error;
    
    // Re-fetch to get the new class ID
    await get().fetchClasses(false);
    const newClass = get().classes.find(c => c.name === name);
    
    if (newClass && courseIds.length > 0) {
      const mappings = courseIds.map(courseId => ({
        class_id: newClass.id,
        course_id: courseId
      }));
      await supabase.from('course_class').insert(mappings);
      await get().fetchClassCourseMappings();
    }
    
    clearCache('classes');
  },
  
  updateClass: async (id, name, courseIds) => {
    await supabase.from('classes').update({ name }).eq('id', id);
    
    // Update course mappings
    await supabase.from('course_class').delete().eq('class_id', id);
    if (courseIds.length > 0) {
      const mappings = courseIds.map(courseId => ({
        class_id: id,
        course_id: courseId
      }));
      await supabase.from('course_class').insert(mappings);
    }
    
    clearCache('classes');
    await get().fetchClasses(false);
    await get().fetchClassCourseMappings();
  },
  
  archiveClass: async (id) => {
    await supabase.from('classes').update({ 
      is_active: false,
      archived_at: new Date().toISOString(),
      archived_reason: 'Arkiverad via användargränssnitt'
    }).eq('id', id);
    clearCache('classes');
    await get().fetchClasses(false);
    await get().fetchArchivedData();
  },
  
  addCourse: async (name, code, points) => {
    await supabase.from('courses').insert({ name, code, points });
    clearCache('courses');
    await get().fetchCourses();
  },
  
  archiveCourse: async (id) => {
    await supabase.from('courses').update({ 
      is_active: false,
      archived_at: new Date().toISOString(),
      archived_reason: 'Arkiverad via användargränssnitt'
    }).eq('id', id);
    clearCache('courses');
    await get().fetchCourses();
    await get().fetchArchivedData();
  },
  
  addStudent: async (name, classId) => {
    await supabase.from('students').insert({ name, class_id: classId });
    clearCache('students');
    await get().fetchStudents();
  },
  
  archiveStudent: async (id) => {
    await supabase.from('students').update({ 
      is_active: false,
      archived_at: new Date().toISOString(),
      archived_reason: 'Arkiverad via användargränssnitt'
    }).eq('id', id);
    clearCache('students');
    await get().fetchStudents();
    await get().fetchArchivedData();
  },
  
  setGrade: async (studentId, courseId, grade, gradeType) => {
    const { activeQuarter, grades, user } = get();
    if (!activeQuarter) throw new Error('Inget aktivt kvartal');
    
    const existingGrade = grades.find(
      g => g.student_id === studentId && g.course_id === courseId
    );
    
    const fromGrade = existingGrade?.grade || null;
    
    if (existingGrade) {
      // Update existing
      await supabase.from('grades').update({
        grade,
        grade_type: gradeType,
        updated_at: new Date().toISOString(),
        teacher_id: user?.id
      }).eq('id', existingGrade.id);
    } else {
      // Insert new
      await supabase.from('grades').insert({
        student_id: studentId,
        course_id: courseId,
        quarter_id: activeQuarter.id,
        grade,
        grade_type: gradeType,
        teacher_id: user?.id
      });
    }
    
    // Log grade change for improvement tracking
    if (fromGrade !== grade) {
      const gradeOrder = ['F', 'E', 'D', 'C', 'B', 'A'];
      const oldIndex = fromGrade ? gradeOrder.indexOf(fromGrade) : -1;
      const newIndex = gradeOrder.indexOf(grade);
      
      const changeType = !fromGrade ? 'new' 
        : newIndex > oldIndex ? 'improvement'
        : 'decline';
      
      await supabase.from('grade_history').insert({
        student_id: studentId,
        course_id: courseId,
        quarter_id: activeQuarter.id,
        from_grade: fromGrade,
        to_grade: grade,
        change_type: changeType,
        grade_type: gradeType,
        changed_by: user?.id
      });
    }
    
    clearCache('grades');
    await get().fetchGrades();
    await get().fetchGradeHistory();
  },
  
  clearGrade: async (studentId, courseId) => {
    const { grades } = get();
    const existingGrade = grades.find(
      g => g.student_id === studentId && g.course_id === courseId
    );
    
    if (existingGrade) {
      await supabase.from('grades').delete().eq('id', existingGrade.id);
      clearCache('grades');
      await get().fetchGrades();
    }
  },
  
  addQuarter: async (name, startDate, endDate) => {
    await supabase.from('quarters').insert({
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: false
    });
    await get().fetchQuarters();
  },
  
  setActiveQuarter: async (quarterId) => {
    // Deactivate all quarters
    await supabase.from('quarters').update({ is_active: false }).neq('id', '');
    // Activate selected quarter
    await supabase.from('quarters').update({ is_active: true }).eq('id', quarterId);
    
    await get().fetchQuarters();
    clearCache('grades');
    await get().fetchGrades();
  },
  
  deleteQuarter: async (quarterId) => {
    // Delete grades for this quarter first
    await supabase.from('grades').delete().eq('quarter_id', quarterId);
    await supabase.from('quarters').delete().eq('id', quarterId);
    await get().fetchQuarters();
  },
  
  createSnapshot: async (name, notes) => {
    const { activeQuarter, grades, students, courses, classes, user } = get();
    if (!activeQuarter) throw new Error('Inget aktivt kvartal');
    
    // Använd rätt tabellnamn: quarter_snapshots
    const snapshotData = {
      name,
      quarter_id: activeQuarter.id,
      notes,
      data: { grades, students, courses, classes },
      stats: {
        totalFGrades: grades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length,
        totalWarnings: grades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length,
        passRate: grades.length > 0 
          ? (grades.filter(g => g.grade && g.grade !== 'F').length / grades.filter(g => g.grade).length) * 100 
          : 0,
        averageGrade: 0
      },
      created_by: user?.id,
      snapshot_date: new Date().toISOString() // Viktigt för sortering
    };
    
    const { error } = await supabase.from('quarter_snapshots').insert(snapshotData);
    if (error) {
      console.error('Error creating snapshot:', error);
      throw error;
    }
    await get().fetchSnapshots();
  },
  
  deleteSnapshot: async (snapshotId) => {
    const { error } = await supabase.from('quarter_snapshots').delete().eq('id', snapshotId);
    if (error) console.error('Error deleting snapshot:', error);
    await get().fetchSnapshots();
  },

  fetchSnapshots: async () => {
    // Använd rätt tabellnamn: quarter_snapshots
    const { data, error } = await supabase
      .from('quarter_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false }); // Sortera på snapshot_date
    
    if (!error && data) {
      // Parse analysis from notes if present
      const snapshotsWithAnalysis = data.map(s => {
        let analysis = null;
        let notes = s.notes;
        
        if (s.notes && s.notes.includes('---\nANALYS\n')) {
          const parts = s.notes.split('---\nANALYS\n');
          notes = parts[0].trim();
          analysis = parts[1];
        }
        
        return { ...s, notes, analysis };
      });
      
      set({ snapshots: snapshotsWithAnalysis });
    } else if (error) {
      console.error('Error fetching snapshots:', error);
    }
  },

  saveSnapshotAnalysis: async (snapshotId, analysis) => {
    const snapshot = get().snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return;

    // Append analysis to notes with a separator, preserving existing notes
    const newNotes = `${snapshot.notes || ''}\n\n---\nANALYS\n${analysis}`;

    const { error } = await supabase
      .from('quarter_snapshots')
      .update({ notes: newNotes })
      .eq('id', snapshotId);

    if (error) {
      console.error('Error saving analysis:', error);
      throw error;
    }

    await get().fetchSnapshots();
  },
  
  reactivateStudent: async (id) => {
    await supabase.from('students').update({ 
      is_active: true,
      archived_at: null,
      archived_reason: null
    }).eq('id', id);
    clearCache('students');
    await get().fetchStudents();
    await get().fetchArchivedData();
  },
  
  reactivateCourse: async (id) => {
    await supabase.from('courses').update({ 
      is_active: true,
      archived_at: null,
      archived_reason: null
    }).eq('id', id);
    clearCache('courses');
    await get().fetchCourses();
    await get().fetchArchivedData();
  },
  
  reactivateClass: async (id) => {
    await supabase.from('classes').update({ 
      is_active: true,
      archived_at: null,
      archived_reason: null
    }).eq('id', id);
    clearCache('classes');
    await get().fetchClasses(false);
    await get().fetchArchivedData();
  },
  
  permanentDeleteStudent: async (id) => {
    await supabase.from('grades').delete().eq('student_id', id);
    await supabase.from('students').delete().eq('id', id);
    await get().fetchArchivedData();
  },
  
  permanentDeleteCourse: async (id) => {
    await supabase.from('grades').delete().eq('course_id', id);
    await supabase.from('course_class').delete().eq('course_id', id);
    await supabase.from('courses').delete().eq('id', id);
    await get().fetchArchivedData();
  },
  
  permanentDeleteClass: async (id) => {
    await supabase.from('students').update({ class_id: null }).eq('class_id', id);
    await supabase.from('course_class').delete().eq('class_id', id);
    await supabase.from('classes').delete().eq('id', id);
    await get().fetchArchivedData();
  },

  // UI Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveGradeTypeFilter: (filter) => set({ activeGradeTypeFilter: filter }),
  
  toggleFavoriteCourse: (courseId) => {
    const { favoriteCourseIds } = get();
    const newFavorites = new Set(favoriteCourseIds);
    if (newFavorites.has(courseId)) {
      newFavorites.delete(courseId);
    } else {
      newFavorites.add(courseId);
    }
    set({ favoriteCourseIds: newFavorites });
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('favoriteCourseIds', JSON.stringify([...newFavorites]));
    }
  },
  
  setCourseFilters: (filters) => set((state) => ({
    courseFilters: { ...state.courseFilters, ...filters }
  })),
  
  setSelectedClassIds: (ids) => set({ selectedClassIds: ids }),
  
  setLoading: (loading) => set({ isLoading: loading }),

  // Permissions
  userCan: (action) => {
    const { userRole, user } = get();
    
    // Permanent admins can do everything (case-insensitive check)
    if (user) {
      const userEmail = user.email.toLowerCase();
      const isPermanentAdmin = PERMANENT_ADMINS.some(
        email => email.toLowerCase() === userEmail
      );
      if (isPermanentAdmin) {
        return true;
      }
    }
    
    // If userRole is admin, allow everything
    if (userRole === 'admin') {
      return true;
    }
    
    if (!userRole) {
      return false;
    }
    
    const permissions: Record<Role['name'], Permission[]> = {
      admin: ['view_data', 'manage_classes', 'manage_courses', 'manage_students', 'manage_grades', 'manage_quarters'],
      teacher: ['view_data', 'manage_grades'],
      analyst: ['view_data']
    };
    
    return permissions[userRole]?.includes(action) ?? false;
  }
}));

