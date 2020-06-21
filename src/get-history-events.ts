// @ts-check

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { registerJoystreamTypes } from '@joystream/types';
import { Hash, EraIndex, SessionIndex, Exposure, EventRecord, Moment, AccountId, Balance } from "@polkadot/types/interfaces";
import { Vec } from '@polkadot/types/codec';
import { Bytes } from '@polkadot/types';
import { EntityId, Entity, ClassId, VecU16 } from '@joystream/types/lib/versioned-store';


const firstblock:number = 1066900
const lastblock = firstblock+2000
const address: string = "5D5PhZQNJzcJXVBxwJxZcsutjKPqUPydrvpu6HeiBfMaeKQu"

const objectEntity = new ClassId(1)
const videoEntity = new ClassId(7)

async function main () {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider('ws://127.0.0.1:9944');

  // register types before creating the api
  registerJoystreamTypes();

  // Create the API and wait until ready
  const api = await ApiPromise.create({provider});
  const lastBlockHash: Hash = await api.rpc.chain.getBlockHash(lastblock)

  const exchanges = []
  const valRewards = []
  const slashes = []
  //const offline = []
  const dataDirectory = []
  const versionedStore = []

  for (let blockNumber=firstblock; blockNumber<lastblock; blockNumber++) {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockNumber)
    const session = await api.query.session.currentIndex.at(blockHash) as SessionIndex
    const era = await api.query.staking.currentEra.at(blockHash) as EraIndex
    const events = await api.query.system.events.at(blockHash) as Vec<EventRecord>;
    const slashedAccountsInBlock: string[] = []
    const slashedAmountsInBlock: number[] = []
    const timestamp = await api.query.timestamp.now.at(blockHash) as Moment;
    for (let { event } of events) {
      if (event.section === 'balances' && event.method === 'Transfer') {
        const recipient = event.data[1] as AccountId;
        if (recipient.toString() === address) {
          // For all events of "Transfer" type with matching recipient...
          const sender = event.data[0] as AccountId;
          const amountJOY = event.data[2] as Balance;
          const feesJOY = event.data[3] as Balance;
          //const memo = await api.query.memo.memo.at(blockHash, sender) as Text;
          const exchange = {
            sender: sender.toString(),
            recipient: recipient.toString(),
            amount: amountJOY.toNumber(),
            fees: feesJOY.toNumber(),
            date: new Date(timestamp.toNumber()),
            blockHeight: blockNumber,
            session: session.toNumber(),
            era: era.toNumber()
          };
          exchanges.push(exchange)
        }
      } else if (event.section === 'staking' && event.method === 'Reward') {
          const sharedReward = event.data[0] as Balance;
          const remainingReward = event.data[1] as Balance;
          const oldHash: Hash = await api.rpc.chain.getBlockHash(blockNumber-1)
          const slotStake = await api.query.staking.slotStake.at(oldHash) as Balance;
          const validatorInfo = await api.query.staking.currentElected.at(oldHash) as AccountId;
          const valReward = {
            sharedReward: sharedReward.toNumber(),
            remainingReward: remainingReward.toNumber(),
            validators: validatorInfo.length,
            slotStake: slotStake.toNumber(),
            date: new Date(timestamp.toNumber()),
            blockHeight: blockNumber,
            session: session.toNumber(),
            era: era.toNumber()
          };
          valRewards.push(valReward)
      } else if (event.section === 'staking' && event.method === 'Slash') {
          const slashedAccount = event.data[0] as AccountId
          const slashedAmount = event.data[1] as Balance
          slashedAccountsInBlock.push(slashedAccount.toString())
          slashedAmountsInBlock.push(slashedAmount.toNumber())
      } else if (event.section === 'dataDirectory' && event.method === 'ContentAdded') {
        const contentId = event.data[0] as Bytes
        const keyring = new Keyring()
        const contentIdObject = keyring.encodeAddress(contentId);
        const uploader = event.data[1] as AccountId
        const membersId = await api.query.members.memberIdsByRootAccountId.at(lastBlockHash,uploader) as VecU16;
        const contentAdded = {
          ContentId: contentId.toString(),
          ObjectIdInVS: contentIdObject,
          uploader: uploader.toString(),
          memberId: membersId[0].toNumber(),
          date: new Date(timestamp.toNumber()),
          blockHeight: blockNumber,
          session: session.toNumber(),
          era: era.toNumber()
        }
        dataDirectory.push(contentAdded)
      } else if (event.section === 'versionedStore' && event.method === 'EntitySchemaAdded') {
        const entityId = event.data[0] as EntityId
        const entity = await api.query.versionedStore.entityById.at(blockHash,entityId) as Entity;
        if (entity["class_id"].toNumber() === objectEntity.toNumber()) {
          const entityValues = entity.entity_values
          const entityData = {
            entityId: entityId.toNumber(),
            Object: entityValues[0].value["raw"].toString(),
            date: new Date(timestamp.toNumber()),
            blockHeight: blockNumber,
            session: session.toNumber(),
            era: era.toNumber()
          }
          versionedStore.push(entityData)
        }
        if (entity["class_id"].toNumber() === videoEntity.toNumber()) {
          const entityId = event.data[0] as EntityId
          const entity = await api.query.versionedStore.entityById.at(blockHash,entityId) as Entity;
          const entityValues = entity.entity_values
          //const channelId = entityValues[13].value["raw"] as Uint64
          //const channelInfo = await api.query.contentWorkingGroup.channelById.at(lastBlockHash,channelId as unknown as ChannelId) as unknown as Channel;          
          const entityData = {
            entityId: entityId.toNumber(),
            Title: entityValues[0].value["raw"].toString(),
            ObjectEntityId: entityValues[7].value["raw"].toString(),
            Channel: entityValues[13].value["raw"].toString(),
            date: new Date(timestamp.toNumber()),
            blockHeight: blockNumber,
            session: session.toNumber(),
            era: era.toNumber()
          }
          versionedStore.push(entityData)
        }
      }
        // How to get event info:
        /*
      } else if (event.section === 'dataDirectory' && event.method === 'ContentAdded') {
        console.log("event.data",event.data)
        const contentId = event.data[0]
        const slashedAmount = event.data[1] as Balance
        slashedAccountsInBlock.push(slashedAccount.toString())
        slashedAmountsInBlock.push(slashedAmount.toNumber())
      }
      */      
    }
      if (slashedAccountsInBlock.length > 0) {
        const oldHash: Hash = await api.rpc.chain.getBlockHash(blockNumber-1)
        const slotStake = await api.query.staking.slotStake.at(oldHash) as Balance;
        const validatorInfo = await api.query.staking.currentElected.at(oldHash) as AccountId;
        const totalStakeOfSlashedBefore = []
        const totalStakeOfSlashedAfter = []
        for (let i=0; i<slashedAccountsInBlock.length; i++) {
          const stakersBefore = await api.query.staking.stakers.at(oldHash,slashedAccountsInBlock[i] as unknown as AccountId) as Exposure;
          const stakersAfter = await api.query.staking.stakers.at(blockHash,slashedAccountsInBlock[i] as unknown as AccountId) as Exposure;
          totalStakeOfSlashedBefore.push(stakersBefore["total"].toNumber())
          totalStakeOfSlashedAfter.push(stakersAfter["total"].toNumber())
        }
        const slashesAtBlock = {
          slashedAccounts: slashedAccountsInBlock,
          slashedAmounts: slashedAmountsInBlock,
          totalStakeOfSlashedBefore: totalStakeOfSlashedBefore,
          totalStakeOfSlashedAfter: totalStakeOfSlashedAfter,
          validators: validatorInfo.length,
          slotStake: slotStake.toNumber(),
          date: new Date(timestamp.toNumber()),
          blockHeight: blockNumber,
          session: session.toNumber(),
          era: era.toNumber()
        };
        slashes.push(slashesAtBlock)
    }
  }
  console.log("exchanges",exchanges)
  /*
  console.log("valRewards",valRewards)
  console.log("slashes",slashes)
  console.log("dataDirectory",dataDirectory)
  console.log("versionedStore",versionedStore)
  */
  let totalReward = 0
  for (let rewards in valRewards) {
    totalReward += valRewards[rewards]["sharedReward"]
  }
  console.log("totalReward",totalReward)
  api.disconnect();
}
main()
