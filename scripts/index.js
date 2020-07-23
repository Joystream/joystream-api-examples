const typesVersion = require('@joystream/types/package.json')

const exportedScripts = {}

exportedScripts.example = require('./example.js')
exportedScripts.exportDataDirectory = require('./export-data-directory.js')
exportedScripts.injectDataObjects = require('./inject-data-objects.js')

// This scripts uses the joy injected types introduced in @joystream/types v0.12.0
if (typesVersion === '0.12.0') {
  exportedScripts.listDataDirectory = require('./list-data-directory.js')
}

module.exports = exportedScripts
