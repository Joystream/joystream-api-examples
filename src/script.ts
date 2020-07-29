// @ts-check

import { ApiPromise, WsProvider } from '@polkadot/api'
import * as types from '@polkadot/types'
import * as util from '@polkadot/util'
import * as joy from '@joystream/types'
import * as hashing from '@polkadot/util-crypto'

const scripts = require('../scripts')

async function main () {
  joy.registerJoystreamTypes()

  const scriptArg = process.argv[2]

  if (!scriptArg) {
    return console.error('Script not specified')
  }

  const script = scripts[scriptArg]

  if (!script) {
    console.error('Script not found:', scriptArg)
    console.error('Available scripts:', Object.keys(scripts))
    return
  }

  const provider = new WsProvider('ws://127.0.0.1:9944')

  const api = await ApiPromise.create({ provider })

  try {
    await script({ api, types, util, hashing })
  } catch (err) {
    console.error(err)
  }

  api.disconnect();
}

main()
