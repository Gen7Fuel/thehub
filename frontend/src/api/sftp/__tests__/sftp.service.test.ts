import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { sftpService } from '../sftp.service'

describe('sftpService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: { files: [] } })
  })

  it('annotates file listing and file content reads with their purpose', async () => {
    await sftpService.listFiles('Rankin', 'sft')
    await sftpService.getFile('21678', 'Rankin', 'sft')

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/sftp/receive', expect.objectContaining({
      params: { site: 'Rankin', type: 'sft' },
      headers: expect.objectContaining({
        'X-Action-Type': 'read',
        'X-Action-Source': 'sftp.files',
        'X-Action-Resource': 'sftp-file',
      }),
    }))
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/sftp/receive/21678', expect.objectContaining({
      params: { site: 'Rankin', type: 'sft' },
      headers: expect.objectContaining({
        'X-Action-Source': 'sftp.file-viewer',
        'X-Action-Message': 'SFTP SFT shift 21678 viewed for Rankin',
      }),
    }))
  })

  it('annotates the multi-site shift summary read', async () => {
    await sftpService.getShiftSummary()

    expect(mocks.get).toHaveBeenCalledWith('/sftp/shift-summary', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Source': 'sftp.shift-summary',
        'X-Action-Resource': 'sftp-shift-summary',
      }),
    }))
  })
})
