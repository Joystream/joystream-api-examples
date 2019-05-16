// @ts-check

import { ApiPromise, WsProvider } from '@polkadot/api';
import { registerJoystreamTypes, Seat } from '@joystream/types';
// import { SubscriptionResult, QueryableStorageFunction } from '@polkadot/api/promise/types';
import { AccountId } from '@polkadot/types';

const BN = require('bn.js');

async function main () {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider('ws://127.0.0.1:9944');

  // register types before creating the api
  registerJoystreamTypes();

  // Create the API and wait until ready
  const api = await ApiPromise.create(provider);

  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);

  console.log(`Chain ${chain} using ${nodeName} v${nodeVersion}`);

  let [council, validators] = await Promise.all([
    api.query.council.activeCouncil() as unknown as Seat[],
    api.query.session.validators() as unknown as AccountId[]
  ]);

  // let council: QueryableStorageFunction<Seat[], SubscriptionResult> = (await api.query.council.activeCouncil()) as unknown as Seat[]
  // let council = (await api.query.council.activeCouncil()) as unknown as Seat[];

  // number of council members
  console.log('Council size:', council.length)

  console.log('Validator count:', validators.length);

  if (validators && validators.length > 0) {
    // Retrieve the balances for all validators
    const validatorBalances = await Promise.all(
      validators.map(authorityId =>
        api.query.balances.freeBalance(authorityId)
      )
    );

    let totalValidatorBalances =
      validatorBalances.reduce((total, value) => total.add(value), new BN(0))

    console.log('Total Validator Stake:', totalValidatorBalances.toString());
  }

  api.disconnect();
}

main()