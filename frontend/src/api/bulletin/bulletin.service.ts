import { actionOptions } from '@/api/resources/action-options'
import { bulletinApi } from './bulletin.api'
import type { CreateBulletinPostInput } from './bulletin.types'

const permission = 'bulletin'
const source = 'bulletin.board'

export const bulletinService = {
  list() {
    return bulletinApi.list(
      actionOptions(permission, source, 'read', 'bulletin-post', 'Bulletin Board posts viewed for assigned site'),
    )
  },

  create(input: CreateBulletinPostInput, site?: string) {
    return bulletinApi.create(
      input,
      actionOptions(permission, source, 'create', 'bulletin-post', `Bulletin post creation requested for ${site || 'assigned site'}`),
    )
  },

  remove(id: string, postLabel?: string) {
    return bulletinApi.remove(
      id,
      actionOptions(permission, source, 'delete', 'bulletin-post', `Bulletin post deletion requested${postLabel ? ` — ${postLabel}` : ''}`),
    )
  },
}
