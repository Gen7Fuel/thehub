export interface AcademyCourseSummary {
  _id: string
  title: string
  description: string
  thumbnail: string
  sectionCount: number
  createdAt: string
}

export interface AcademyCourseProgress {
  currentPageIndex: number
  completedPages: number[]
}

export interface AcademyEmployee {
  name: string
  [key: string]: unknown
}

export interface CourseProgressUpdate {
  employeeCode: string
  courseId: string
  currentPageIndex?: number
  completedPageIndex?: number
}

export interface VideoProgressUpdate {
  employeeCode: string
  courseId: string
  itemId: string
  progressSeconds: number
}

