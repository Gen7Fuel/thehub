import { describe, it, expect } from 'vitest'
import { parseCsoCustomers } from '../utils/arCustomerSync.js'

describe('parseCsoCustomers', () => {
  it('extracts id/name from rows whose first cell is numeric', () => {
    const html = `
      <table>
        <tr><th>ID</th><th>Name</th></tr>
        <tr><td>1001</td><td>Acme&nbsp;Trucking </td><td>x</td></tr>
        <tr><td><b>1002</b></td><td>Three Fires</td></tr>
        <tr><td>Total</td><td>2</td></tr>
      </table>`
    expect(parseCsoCustomers(html)).toEqual([
      { customerId: '1001', name: 'AcmeTrucking' },
      { customerId: '1002', name: 'Three Fires' },
    ])
  })

  it('returns an empty list when there are no table rows', () => {
    expect(parseCsoCustomers('<html>login</html>')).toEqual([])
  })
})
