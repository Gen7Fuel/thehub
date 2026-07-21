/**
 * Attaches Mongoose hooks that keep a new `site` field in sync with a
 * legacy name field (e.g. stationName, location, locationName), on every
 * document write (create + update via .save()) and every query-style
 * write (findOneAndUpdate / findByIdAndUpdate / updateOne / updateMany).
 *
 * Purely additive: never touches the legacy field, never deletes `site`,
 * never overwrites a `site` value a caller explicitly set to something
 * different from the legacy field in the same write.
 *
 * Known, intentional limitations (no current write path needs these):
 * bulkWrite() bypasses Mongoose middleware entirely, and aggregation-
 * pipeline-array updates are skipped rather than parsed.
 *
 * IMPORTANT: this file is bind-mounted directly into the auth-backend
 * container (see compose.dev.yaml / compose.yaml) because Location/User
 * are require()'d there too, but auth-backend runs Mongoose 9 while backend
 * runs Mongoose 8. Mongoose 9 removed callback-style (`next`) middleware
 * entirely, so these hooks are deliberately written as zero-argument
 * synchronous functions (no `next` param, no return value) — that form
 * runs to completion identically on both major versions, since Mongoose
 * only waits on a hook if it explicitly returns a Promise. Do not
 * reintroduce a `next` parameter here.
 */
function attachSiteAlias(schema, legacyField, siteField = 'site') {
  // Document-style writes: new Model(), Model.create(), doc.save()
  schema.pre('validate', function () {
    const legacyVal = this[legacyField];
    if (legacyVal !== undefined && legacyVal !== null) {
      const explicitlyDifferent = this.isModified(siteField) && this[siteField] !== legacyVal;
      if (!explicitlyDifferent) this[siteField] = legacyVal;
    }
  });

  // Query-style writes: findOneAndUpdate / findByIdAndUpdate / updateOne / updateMany
  const syncOnQueryUpdate = function () {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return; // skip pipeline-style updates

    const applyTo = (obj) => {
      if (!obj || !Object.prototype.hasOwnProperty.call(obj, legacyField)) return;
      const legacyVal = obj[legacyField];
      if (legacyVal === undefined || legacyVal === null) return;
      const explicitlyDifferent = Object.prototype.hasOwnProperty.call(obj, siteField) && obj[siteField] !== legacyVal;
      if (!explicitlyDifferent) obj[siteField] = legacyVal;
    };
    applyTo(update);       // bare shape, e.g. findByIdAndUpdate(id, { stationName: 'x' })
    applyTo(update.$set);  // $set shape, e.g. findByIdAndUpdate(id, { $set: { stationName: 'x' } })

    this.setUpdate(update);
  };

  ['findOneAndUpdate', 'updateOne', 'updateMany'].forEach((method) => {
    schema.pre(method, syncOnQueryUpdate);
  });
}

module.exports = { attachSiteAlias };
