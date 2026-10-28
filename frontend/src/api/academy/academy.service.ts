import { academyApi } from './academy.api'
import { actionOptions } from '@/api/resources/action-options'
import type { CourseProgressUpdate, VideoProgressUpdate } from './academy.types'

type AcademySource = 'academy' | 'ai-customer.mcq'

const options = (source: AcademySource, action: 'read' | 'create' | 'update', resourceType: string, message: string) =>
  actionOptions('academy', source, action, resourceType, message)

export const academyService = {
  listCourses(source: AcademySource = 'academy') {
    return academyApi.listPublishedCourses(options(source, 'read', 'academy-course', source === 'academy'
      ? 'Published Academy courses viewed'
      : 'Academy courses viewed for AI Customer MCQ training'))
  },

  getCourse<T = unknown>(courseId: string, source: AcademySource = 'academy') {
    return academyApi.getPublishedCourse<T>(courseId, options(source, 'read', 'academy-course', source === 'academy'
      ? `Academy course ${courseId} opened`
      : `Academy course ${courseId} opened for AI Customer MCQ training`))
  },

  lookupEmployee(employeeNumber: string) {
    return academyApi.lookupEmployee(employeeNumber, options('academy', 'read', 'academy-employee', 'Employee verified before starting Academy course'))
  },

  getCourseProgress(courseId: string, employeeCode: string) {
    return academyApi.getCourseProgress(courseId, employeeCode, options('academy', 'read', 'academy-progress', `Academy course progress viewed for course ${courseId}`))
  },

  saveCourseProgress(input: CourseProgressUpdate) {
    return academyApi.saveCourseProgress(input, options('academy', 'update', 'academy-progress', `Academy course progress update requested for course ${input.courseId}`))
  },

  completeCourse(courseId: string, employeeCode: string) {
    return academyApi.completeCourse(courseId, employeeCode, options('academy', 'create', 'academy-completion', `Academy course ${courseId} completion requested`))
  },

  getVideoProgress(courseId: string, itemId: string, employeeCode: string) {
    return academyApi.getVideoProgress(courseId, itemId, employeeCode, options('academy', 'read', 'academy-video-progress', `Academy video progress viewed for course ${courseId}`))
  },

  saveVideoProgress(input: VideoProgressUpdate) {
    return academyApi.saveVideoProgress(input, options('academy', 'update', 'academy-video-progress', `Academy video progress update requested for course ${input.courseId}`))
  },
}

