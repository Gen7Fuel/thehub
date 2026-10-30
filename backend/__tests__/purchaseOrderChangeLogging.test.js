const fs = require('node:fs')
const path = require('node:path')

describe('Purchase Order change logging contract', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/purchaseOrder.js'), 'utf8')

  it('records successful creates, updates, and soft deletes in ChangeLog', () => {
    expect(source).toContain("const { logChange } = require('../middleware/changeLogger')")
    expect(source).toMatch(/action: 'create', resourceType: 'purchase-order'/)
    expect(source).toMatch(/action: 'update', resourceType: 'purchase-order'/)
    expect(source).toMatch(/action: 'delete', resourceType: 'purchase-order'/)
    expect(source).toContain("resourceStore: 'mongodb'")
  })

  it('captures complete before and after documents for generalized diffs', () => {
    expect(source).toContain("Transaction.findOne({ _id: id, deletedAt: null }).lean()")
    expect(source).toContain('before: current, after: updatedOrder.toObject()')
    expect(source).toContain('before, after: deleted.toObject()')
  })
})
