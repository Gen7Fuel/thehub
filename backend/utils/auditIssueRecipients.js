/**
 * Resolves who gets emailed when an audit issue is raised and assigned to a
 * "Assigned To" select-template option (e.g. "Daksh", "Station Manager").
 *
 * Each option carries a default TO (`email`) and default CC (`cc`), plus an
 * optional list of per-site overrides. A site only appears in
 * `siteOverrides` once it's been explicitly customized — an absent site (or
 * a present-but-blank field) inherits the option's default for that field.
 *
 * "Station Manager" is a special case: its TO comes from the site's
 * `Location.managerEmails` (falling back to `Location.email`) instead of the
 * option's default `email`, unless a site override explicitly sets `to`.
 * CC has no such dynamic lookup for any option — it always resolves from
 * the site override's `cc`, then the option's default `cc`.
 */

function parseEmailList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map(e => e.trim()).filter(Boolean);
}

function resolveIssueRecipients({ option, site, location }) {
  const override = option?.siteOverrides?.find(o => o.site === site);

  let to;
  if (option?.text === 'Station Manager' && !override?.to) {
    if (location?.managerEmails && location.managerEmails.length > 0) {
      to = [...location.managerEmails];
    } else if (location?.email) {
      to = [location.email];
    } else {
      to = [];
    }
  } else {
    to = parseEmailList(override?.to || option?.email);
  }

  const cc = parseEmailList(override?.cc || option?.cc);

  return { to, cc };
}

module.exports = { parseEmailList, resolveIssueRecipients };
