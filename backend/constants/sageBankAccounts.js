// Sage Intacct bank (checking) account IDs per Hub site, used when recording
// payments against a site's bank account. Callers must treat a missing entry as
// "skip the Intacct entry", not as an error. Little Shuswap and Test Lab have no
// Sage bank account yet. A site also needs its sageEntityKey set on the Location
// (see manual/backfill-sage-entity-keys.js) or its entry fails.
const SITE_BANK_ACCOUNTS = {
  Charlies: 'Charlies Gen7 SB',
  Couchiching: 'CouchichingGen7LP SB',
  'Jocko Point': 'Jocko Point SB',
  Oliver: 'Oliver RBC',
  Osoyoos: 'Osoyoos CIBC',
  Rankin: 'Rankin Gen7 LP SB',
  Sarnia: 'Sarnia Gen7 LP SB',
  'Silver Grizzly': 'Penticton Gen7 SB',
  'Sioux Valley': 'Sioux Valley TD',
  Walpole: 'Walpole Gen7 LP SB',
  'Wavers East': 'Wavers East BMO',
  'Wavers West': 'Wavers West BMO',
}

module.exports = { SITE_BANK_ACCOUNTS }
