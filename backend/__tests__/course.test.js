import { describe, it, expect } from 'vitest'
import Course from '../models/academy/Course.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseItem = (overrides = {}) => ({
  type: 'video',
  order: 1,
  content: { url: 'https://cdn.gen7.com/vid.mp4' },
  ...overrides,
})

const baseSection = (overrides = {}) => ({
  title: 'Introduction',
  order: 1,
  ...overrides,
})

const baseCourse = (overrides = {}) => ({
  title: 'Customer Service Basics',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('Course — required field validation', () => {
  it('passes with only title', () => {
    expect(new Course(baseCourse()).validateSync()).toBeUndefined()
  })

  it('rejects missing title', () => {
    const err = new Course({}).validateSync()
    expect(err?.errors.title).toBeDefined()
  })
})

// ─── Status enum ─────────────────────────────────────────────────────────────

describe('Course — status enum', () => {
  it('defaults status to "draft"', () => {
    const doc = new Course(baseCourse())
    expect(doc.status).toBe('draft')
  })

  it('accepts status "published"', () => {
    const doc = new Course(baseCourse({ status: 'published' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.status).toBe('published')
  })

  it('rejects invalid status', () => {
    const doc = new Course(baseCourse({ status: 'archived' }))
    const err = doc.validateSync()
    expect(err?.errors.status).toBeDefined()
  })
})

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('Course — defaults', () => {
  it('defaults description to empty string', () => {
    const doc = new Course(baseCourse())
    expect(doc.description).toBe('')
  })

  it('defaults thumbnail to empty string', () => {
    const doc = new Course(baseCourse())
    expect(doc.thumbnail).toBe('')
  })

  it('defaults sections to empty array', () => {
    const doc = new Course(baseCourse())
    expect(doc.sections).toEqual([])
  })
})

// ─── Section schema ────────────────────────────────────────────────────────────

describe('Course — section schema', () => {
  it('accepts a section with title and order', () => {
    const doc = new Course(baseCourse({ sections: [baseSection()] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.sections).toHaveLength(1)
  })

  it('rejects a section missing title', () => {
    const { title, ...rest } = baseSection()
    const doc = new Course(baseCourse({ sections: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['sections.0.title']).toBeDefined()
  })

  it('rejects a section missing order', () => {
    const { order, ...rest } = baseSection()
    const doc = new Course(baseCourse({ sections: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['sections.0.order']).toBeDefined()
  })

  it('defaults section type to "lesson"', () => {
    const doc = new Course(baseCourse({ sections: [baseSection()] }))
    expect(doc.sections[0].type).toBe('lesson')
  })

  it('accepts section type "test"', () => {
    const doc = new Course(baseCourse({ sections: [baseSection({ type: 'test' })] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.sections[0].type).toBe('test')
  })

  it('rejects invalid section type', () => {
    const doc = new Course(baseCourse({ sections: [baseSection({ type: 'quiz' })] }))
    const err = doc.validateSync()
    expect(err?.errors['sections.0.type']).toBeDefined()
  })
})

// ─── LearningItem schema ───────────────────────────────────────────────────────

describe('Course — LearningItem schema', () => {
  const validTypes = ['hotspot', 'video', 'mcq', 'flip-card', 'ordering', 'matching']

  validTypes.forEach((type) => {
    it(`accepts learning item type "${type}"`, () => {
      const doc = new Course(baseCourse({
        sections: [baseSection({ items: [baseItem({ type })] })],
      }))
      expect(doc.validateSync()).toBeUndefined()
      expect(doc.sections[0].items[0].type).toBe(type)
    })
  })

  it('rejects missing type on learning item', () => {
    const { type, ...rest } = baseItem()
    const doc = new Course(baseCourse({ sections: [baseSection({ items: [rest] })] }))
    const err = doc.validateSync()
    expect(err?.errors['sections.0.items.0.type']).toBeDefined()
  })

  it('rejects missing order on learning item', () => {
    const { order, ...rest } = baseItem()
    const doc = new Course(baseCourse({ sections: [baseSection({ items: [rest] })] }))
    const err = doc.validateSync()
    expect(err?.errors['sections.0.items.0.order']).toBeDefined()
  })

  it('rejects missing content on learning item', () => {
    const { content, ...rest } = baseItem()
    const doc = new Course(baseCourse({ sections: [baseSection({ items: [rest] })] }))
    const err = doc.validateSync()
    expect(err?.errors['sections.0.items.0.content']).toBeDefined()
  })

  it('accepts Mixed content (object)', () => {
    const doc = new Course(baseCourse({
      sections: [baseSection({ items: [baseItem({ content: { question: 'What is...?', options: ['A', 'B'] } })] })],
    }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('accepts Mixed content (string)', () => {
    const doc = new Course(baseCourse({
      sections: [baseSection({ items: [baseItem({ content: 'https://cdn.gen7.com/video.mp4' })] })],
    }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('defaults learning item title to empty string', () => {
    const doc = new Course(baseCourse({ sections: [baseSection({ items: [baseItem()] })] }))
    expect(doc.sections[0].items[0].title).toBe('')
  })

  it('accepts a course with multiple sections and items', () => {
    const doc = new Course(baseCourse({
      title: 'Full Course',
      status: 'published',
      sections: [
        baseSection({
          order: 1,
          items: [
            baseItem({ type: 'video', order: 1 }),
            baseItem({ type: 'mcq', order: 2, content: { question: 'Q1', options: ['A', 'B'], answer: 'A' } }),
          ],
        }),
        baseSection({
          title: 'Assessment',
          order: 2,
          type: 'test',
          items: [baseItem({ type: 'ordering', order: 1, content: { steps: ['step 1', 'step 2'] } })],
        }),
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.sections).toHaveLength(2)
    expect(doc.sections[0].items).toHaveLength(2)
  })
})
