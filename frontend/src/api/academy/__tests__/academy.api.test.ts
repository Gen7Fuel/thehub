import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { academyService } from '../academy.service'

describe('academyService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('annotates the Academy course list with its user purpose', async () => {
    mocks.get.mockResolvedValue({ data: { courses: [] } })
    await academyService.listCourses()
    expect(mocks.get).toHaveBeenCalledWith('/academy/learner/courses', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'academy',
        'X-Action-Type': 'read',
        'X-Action-Source': 'academy',
        'X-Action-Message': 'Published Academy courses viewed',
      }),
    }))
  })

  it('identifies MCQ reads separately while reusing the Academy endpoint', async () => {
    mocks.get.mockResolvedValue({ data: { courses: [] } })
    await academyService.listCourses('ai-customer.mcq')
    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Action-Source': 'ai-customer.mcq',
      'X-Action-Message': 'Academy courses viewed for AI Customer MCQ training',
    }))
  })

  it('annotates persisted learner progress updates', async () => {
    mocks.put.mockResolvedValue({ data: { currentPageIndex: 2, completedPages: [1] } })
    await academyService.saveCourseProgress({ employeeCode: '1234', courseId: 'course-1', currentPageIndex: 2 })
    expect(mocks.put.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'update',
      'X-Action-Resource': 'academy-progress',
      'X-Action-Source': 'academy',
    }))
  })
})

