import type { RequestOptions } from '@/api/core/types'
import { invoiceUploadApi } from './invoice-upload.api'

const ctx = (source: string, action: 'read' | 'create' | 'update', message: string, permission = 'uploadInvoice'): RequestOptions => ({
  permission, actionContext: { source, action, resourceType: 'invoice-upload', message },
})

export const invoiceUploadService = {
  vendors<T>() { return invoiceUploadApi.vendors<T>(ctx('upload-invoice.form', 'read', 'Invoice vendor list loaded for invoice entry')) },
  list<T>(query: Record<string, unknown>, site: string, from?: string, to?: string) {
    const range = from || to ? ` from ${from || 'start'} to ${to || 'end'}` : ''
    return invoiceUploadApi.list<T>(query, ctx('upload-invoice.list', 'read', `Uploaded invoices viewed for ${site || 'all sites'}${range}`, 'uploadInvoice.list'))
  },
  get<T>(id: string) { return invoiceUploadApi.get<T>(id, ctx('upload-invoice.detail', 'read', `Uploaded invoice ${id} opened for editing`, 'uploadInvoice.list')) },
  create<T extends { siteName?: string; vendorName?: string; docNumber?: string }, R = unknown>(input: T) {
    return invoiceUploadApi.create<T, R>(input, ctx('upload-invoice.form', 'create', `Invoice ${input.docNumber || 'without document number'} from ${input.vendorName || 'selected vendor'} submitted for ${input.siteName || 'unknown site'}`))
  },
  update<T extends { siteName?: string; vendorName?: string; docNumber?: string }, R = unknown>(id: string, input: T) {
    return invoiceUploadApi.update<T, R>(id, input, ctx('upload-invoice.detail', 'update', `Invoice ${input.docNumber || id} from ${input.vendorName || 'selected vendor'} updated for ${input.siteName || 'unknown site'}`, 'uploadInvoice.list'))
  },
}
