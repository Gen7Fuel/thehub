import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  AcademyCourseProgress,
  AcademyCourseSummary,
  AcademyEmployee,
  CourseProgressUpdate,
  VideoProgressUpdate,
} from './academy.types'

export const academyApi = {
  async listPublishedCourses(options: RequestOptions): Promise<AcademyCourseSummary[]> {
    const response = await apiClient.get('/academy/learner/courses', requestConfig(options))
    return response.data.courses ?? response.data
  },

  async getPublishedCourse<T = unknown>(courseId: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/academy/learner/courses/${courseId}`, requestConfig(options))).data
  },

  async lookupEmployee(employeeNumber: string, options: RequestOptions): Promise<AcademyEmployee> {
    return (await apiClient.get('/academy/learner/employee-lookup', {
      ...requestConfig(options),
      params: { employeeNumber },
    })).data
  },

  async getCourseProgress(courseId: string, employeeCode: string, options: RequestOptions): Promise<AcademyCourseProgress> {
    return (await apiClient.get(`/academy/learner/course-progress/${courseId}`, {
      ...requestConfig(options),
      params: { employeeCode },
    })).data
  },

  async saveCourseProgress(input: CourseProgressUpdate, options: RequestOptions): Promise<AcademyCourseProgress> {
    return (await apiClient.put('/academy/learner/course-progress', input, requestConfig(options))).data
  },

  async completeCourse(courseId: string, employeeCode: string, options: RequestOptions): Promise<void> {
    await apiClient.post(`/academy/learner/courses/${courseId}/complete`, { employeeCode }, requestConfig(options))
  },

  async getVideoProgress(courseId: string, itemId: string, employeeCode: string, options: RequestOptions): Promise<number> {
    const response = await apiClient.get(`/academy/learner/video-progress/${courseId}/${itemId}`, {
      ...requestConfig(options),
      params: { employeeCode },
    })
    return response.data.progressSeconds ?? 0
  },

  async saveVideoProgress(input: VideoProgressUpdate, options: RequestOptions): Promise<void> {
    await apiClient.put('/academy/learner/video-progress', input, requestConfig(options))
  },
}

