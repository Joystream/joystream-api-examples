// @ts-check

import { ApiPromise, WsProvider, /*RuntimeVersion*/ } from '@polkadot/api';
import { registerJoystreamTypes } from '@joystream/types';
import { Hash } from "@polkadot/types/interfaces";
//import { u128 } from "@polkadot/types";

// import { SubscriptionResult, QueryableStorageFunction } from '@polkadot/api/promise/types';
//import { GenericAccountId } from '@polkadot/types';


// import BN from 'bn.js';
//const BN = require('bn.js');
const firstblock:number = 958796
const lastblock = firstblock+100000
const address: string = "5D5PhZQNJzcJXVBxwJxZcsutjKPqUPydrvpu6HeiBfMaeKQu"

async function main () {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider('ws://127.0.0.1:9944');

  // register types before creating the api
  registerJoystreamTypes();

  // Create the API and wait until ready
  const api = await ApiPromise.create({provider});

  // Retrieve the chain & node information information via rpc calls
  let blockhash: Hash = await api.rpc.chain.getBlockHash(firstblock)
  console.log(`hash ${blockhash}`)
  const transfers = []
  let oldBalance = (await api.query.balances.freeBalance.at(blockhash, address)).toJSON()
  
  for (let i=firstblock; i<lastblock; i++) {
    blockhash = await api.rpc.chain.getBlockHash(firstblock)
    let balance = (await api.query.balances.freeBalance.at(blockhash, address)).toJSON()
    //console.log(`changes ${balance},${oldBalance}`,balance !== oldBalance)
    //console.log(balance.toJSON(),oldBalance.toJSON(),balance.toJSON() != oldBalance.toJSON())
    //console.log(balance.toJSON(),oldBalance.toJSON(),balance.toJSON() !== oldBalance.toJSON())
    if (balance !== oldBalance) {
      console.log(`changes ${balance} at block ${i} with hash ${blockhash}`)
      transfers.push(`changes ${balance} at block ${i} with hash ${blockhash}`)
    }
    oldBalance = balance
  }
 

  console.log("")
  console.log("")
  console.log(transfers)
  console.log("")
  console.log("")
   /*



  let oldBalance1 = await api.query.balances.freeBalance.at(blockhash, address)  as unknown as object
  for (let i=firstblock; i<lastblock; i++) {
    blockhash = await api.rpc.chain.getBlockHash(firstblock)
    let balance = await api.query.balances.freeBalance.at(blockhash, address) as unknown as object
    console.log(balance,oldBalance,balance !== oldBalance1)
    if (balance !== oldBalance1) {
      console.log(`changes ${balance} at block ${i} with hash ${blockhash}`)
      transfers1.push(`changes ${balance} at block ${i} with hash ${blockhash}`)
    }
    oldBalance1 = balance
  }
  console.log(transfers1)
  */

  api.disconnect();
}

main()
