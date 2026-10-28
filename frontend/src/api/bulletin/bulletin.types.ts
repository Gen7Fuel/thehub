export interface BulletinAuthor {
  id: string
  firstName?: string
  lastName?: string
}

export interface BulletinPost {
  _id: string
  site: string
  text: string
  author: BulletinAuthor
  createdAt: string
  updatedAt: string
}

export interface BulletinListResponse {
  success: boolean
  data: BulletinPost[]
}

export interface BulletinMutationResponse {
  success: boolean
  data?: BulletinPost
  _id?: string
}

export interface CreateBulletinPostInput {
  text: string
}
