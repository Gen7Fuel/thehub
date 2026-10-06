// Sage Intacct bank (checking) account IDs per Hub site, used when recording
// payments against a site's bank account. Silver Grizzly is intentionally
// absent until its Sage bank account exists — callers must treat a missing
// entry as "skip the Intacct entry", not as an error.
const SITE_BANK_ACCOUNTS = {
  Charlies: 'Charlies Gen7 SB',
  Couchiching: 'CouchichingGen7LP SB',
  'Jocko Point': 'Jocko Point SB',
  Rankin: 'Rankin Gen7 LP SB',
  Sarnia: 'Sarnia Gen7 LP SB',
  Walpole: 'Walpole Gen7 LP SB',
}

module.exports = { SITE_BANK_ACCOUNTS }
