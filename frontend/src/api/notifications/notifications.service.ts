import type { ActionType, RequestOptions } from '@/api/core/types'
import { usersApi } from '@/api/users/users.api'
import { userGroupsApi } from '@/api/user-groups/user-groups.api'
import { notificationsApi } from './notifications.api'

const options = (action: ActionType, resourceType: string, message: string, permission?: string): RequestOptions => ({
  ...(permission ? { permission } : {}),
  actionContext: { action, resourceType, source: 'notifications', message },
})

export const notificationsService = {
  // Shell polling intentionally omits action headers so the backend retains its
  // established "Application request" classification.
  pollInbox<T>() { return notificationsApi.list<T>({}) },
  pollUnreadCount() { return notificationsApi.unreadCount({}) },
  pollUnreadSummary() { return notificationsApi.unreadSummary({}) },
  dismissSummary() { return notificationsApi.dismissSummary({}) },

  listInbox<T>() { return notificationsApi.list<T>(options('read', 'notification', 'Notification inbox viewed', 'notification')) },
  listSent<T>() { return notificationsApi.listSent<T>(options('read', 'notification', 'Sent notifications viewed', 'notification')) },
  get<T>(id: string, subject?: string) { return notificationsApi.get<T>(id, options('read', 'notification', `Notification ${subject || id} opened`)) },
  send<T extends { subject?: string; recipientIds?: string[]; bccUserIds?: string[] }, R = unknown>(input: T) {
    const count = new Set([...(input.recipientIds || []), ...(input.bccUserIds || [])]).size
    return notificationsApi.send<T, R>(input, options('create', 'notification', `Notification "${input.subject || 'Untitled'}" sent to ${count} recipient${count === 1 ? '' : 's'}`, 'notification.create'))
  },

  listTemplates<T>(purpose = 'Notification templates viewed', permission = 'notification.template') {
    return notificationsApi.listTemplates<T>(options('read', 'notification-template', purpose, permission))
  },
  getTemplate<T>(id: string) { return notificationsApi.getTemplate<T>(id, options('read', 'notification-template', `Notification template ${id} opened for editing`, 'notification.template')) },
  saveTemplate<T extends { _id?: string; name?: string }, R = unknown>(input: T) {
    return notificationsApi.saveTemplate<T, R>(input, options(input._id ? 'update' : 'create', 'notification-template', `Notification template ${input.name || input._id || ''} ${input._id ? 'update' : 'creation'} requested`, 'notification.template'))
  },
  deleteTemplate(id: string, name?: string) { return notificationsApi.deleteTemplate(id, options('delete', 'notification-template', `Notification template ${name || id} deletion requested`, 'notification.template')) },

  listRecipients<T>() { return usersApi.listWithRoles(options('read', 'user', 'Notification recipients loaded', 'notification.create')) as Promise<T> },
  listGroups<T>() { return userGroupsApi.list<T>(options('read', 'notification-user-group', 'Notification recipient groups loaded', 'notification.create')) },
  saveGroup<T extends { id?: string; _id?: string; name?: string }, R = unknown>(input: T) {
    const id = input.id || input._id
    return userGroupsApi.save<T, R>(input, options(id ? 'update' : 'create', 'notification-user-group', `Notification recipient group ${input.name || id || ''} ${id ? 'update' : 'creation'} requested`, 'notification.create'))
  },
  deleteGroup(id: string, name?: string) { return userGroupsApi.remove(id, options('delete', 'notification-user-group', `Notification recipient group ${name || id} deletion requested`, 'notification.create')) },
}
