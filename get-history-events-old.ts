// @ts-check

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { registerJoystreamTypes } from '@joystream/types';
import { Hash, EraIndex, SessionIndex, Exposure, EventRecord, Moment, AccountId, Balance, Proposal, BlockNumber } from "@polkadot/types/interfaces";
import { Vec } from '@polkadot/types/codec';
import { Bytes, u32 } from '@polkadot/types';
import { EntityId, Entity, ClassId, VecU16 } from '@joystream/types/lib/versioned-store';
import { MemberId } from '@joystream/types/lib/members';
import { ProposalId, ProposalDetails, ProposalStatus, Finalized, VotingResults, Active } from '@joystream/types/lib/proposals';
//import { MintId, Mint } from '@joystream/types/lib/mint';


const firstblock:number = 991558
const lastblock = firstblock+2
const address: string = "5D5PhZQNJzcJXVBxwJxZcsutjKPqUPydrvpu6HeiBfMaeKQu"

const objectEntity = new ClassId(1)
const videoEntity = new ClassId(7)

//const curatorMintId = new MintId(0)
//const councilMintId = new MintId(1)

async function main () {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider('ws://127.0.0.1:9944');

  // register types before creating the api
  registerJoystreamTypes();

  // Create the API and wait until ready
  const api = await ApiPromise.create({provider});
  let oldHash: Hash = await api.rpc.chain.getBlockHash(firstblock-1)
  const fistBlockHash: Hash = await api.rpc.chain.getBlockHash(firstblock)
  const lastBlockHash: Hash = await api.rpc.chain.getBlockHash(lastblock)
  /*
  const startEra = await api.query.staking.currentEra.at(fistBlockHash) as EraIndex
  const endEra = await api.query.staking.currentEra.at(lastBlockHash) as EraIndex
  const startIssuance = await api.query.balances.totalIssuance.at(fistBlockHash) as Balance
  const endIssuance = await api.query.balances.totalIssuance.at(lastBlockHash) as Balance
  const councilMembers = await api.query.council.activeCouncil.at(fistBlockHash) as AccountId
  const councilMintInfo = await api.query.minting.mints.at(fistBlockHash,councilMintId) as Mint
  const curatorMintInfo = await api.query.minting.mints.at(fistBlockHash,curatorMintId) as Mint
  */

  const exchanges = []
  const slashes = []
  //const offline = []
  const dataDirectory = []
  const versionedStore = []
  const proposals = []
  const valRewards = []
  const proposalsAtStart = await api.query.proposalsEngine.proposalCount.at(fistBlockHash) as u32
  for (let i=1; i<proposalsAtStart.toNumber()+1; i++) {
    const proposalsData = await api.query.proposalsEngine.proposals.at(fistBlockHash,i) as Proposal
    console.log("proposalsData",proposalsData)
    console.log("proposalsData",proposalsData.keys())
    console.log("proposalsData",proposalsData.values)
    console.log("proposalsData",proposalsData.Type)
    console.log("proposalsData",proposalsData.toJSON())
    const proposalStatus = proposalsData.get("status") as ProposalStatus
    console.log("proposalStatus",proposalStatus)
    console.log("proposalStatus",proposalStatus.type)
    console.log("proposalStatus",proposalStatus.value)
    console.log("proposalStatus",proposalStatus.index)
    console.log("proposalStatus",proposalStatus.toString())
    console.log("proposalStatus",proposalStatus.toJSON())
    console.log("proposalStatus",proposalStatus.toRawType())
    const proposalCreator = proposalsData.get("proposerId") as MemberId
    console.log("proposalCreator",proposalCreator)
    console.log("proposalCreator",proposalCreator.toNumber())
    console.log("proposalCreator",proposalCreator.toRawType())
    console.log("proposalCreator",proposalCreator.toRawType())
    const proposalCreated = proposalsData.get("createdAt") as BlockNumber
    console.log("proposalCreated",proposalCreated)
    console.log("proposalCreated",proposalCreated.toNumber())
    console.log("proposalCreated",proposalCreated.toRawType())
    const proposalVoting = proposalsData.get("votingResults") as VotingResults
    console.log("proposalVoting",proposalVoting)
    console.log("proposalVoting",proposalVoting.entries())
    console.log("proposalVoting",proposalVoting.toJSON())
    console.log("proposalVoting",proposalVoting.toRawType())
    //console.log("proposalStatusKeys",proposalStatusKeys)
    const proposalStatusValue = proposalStatus.value as Finalized
    if (proposalStatus.value instanceof Active) {
      console.log("is Active")
    }
    if (proposalStatus.value instanceof Finalized) {
      console.log("is Finalized")
    }
    console.log("proposalStatusValue1",proposalStatusValue.getEnumAsString)
    console.log("proposalStatusValue1",proposalStatusValue.getString)
    console.log("proposalStatusValue2",proposalStatusValue.unwrapOrUndefined)
    console.log("proposalStatusValue",proposalStatusValue)
    console.log("proposalStatusValue",proposalStatusValue.toString())
    console.log("proposalStatusValue",proposalStatusValue.Type)
    //console.log("proposalStatusValue",proposalStatusValue.get("proposalStatus"))
    console.log("proposalStatusValue",proposalStatusValue.toJSON())
    console.log("proposalStatusValue",proposalStatusValue.toRawType())
    console.log("Active asa", proposalStatusValue.toString(), i)
    if (proposalStatusValue.toString() == "Active") {
      console.log("Active asa ", proposalStatusValue.toString(), i)
    }
    const activeProposals = {
      proposalId: i
    }
    proposals.push(activeProposals)
    /*
    const proposalStatusValueStatus = proposalStatusValue.get("proposalStatus") as ProposalDecisionStatus
    console.log("proposalStatusValueStatus",proposalStatusValueStatus)
    //const proposalStatusValueStatusType = proposalStatusValueStatus.type

    console.log("proposalStatusValueStatus",proposalStatusValueStatus)
    console.log("proposalStatusValueStatus",proposalStatusValueStatus.toString())
    console.log("proposalStatusValueStatus",proposalStatusValueStatus.type)
    console.log("proposalStatusValueStatus",proposalStatusValueStatus.toJSON())
    console.log("proposalStatusValueStatus",proposalStatusValueStatus.toRawType())
    */
  }
   

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
          const oldSlotStake = await api.query.staking.slotStake.at(oldHash) as Balance;
          const newSlotStake = await api.query.staking.slotStake.at(blockHash) as Balance;
          const oldValidatorInfo = await api.query.staking.currentElected.at(oldHash) as AccountId;
          const newValidatorInfo = await api.query.staking.currentElected.at(blockHash) as AccountId;
          const valReward = {
            sharedReward: sharedReward.toNumber(),
            slotStakeDiff: (newSlotStake.toNumber()-oldSlotStake.toNumber()),
            remainingReward: remainingReward.toNumber(),
            validatorInOldEra: {number: oldValidatorInfo.length, stashAccounts: oldValidatorInfo.toJSON(),slotStake: oldSlotStake.toNumber()},
            validatorInNewEra: {number: newValidatorInfo.length, stashAccounts: newValidatorInfo.toJSON(), slotStake: newSlotStake.toNumber()},
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
      } else if (event.section === 'proposalsEngine' && event.method === 'ProposalCreated') {
          const madeBy = event.data[0] as MemberId
          const proposalId = event.data[1] as ProposalId
          const proposalStatus = await api.query.proposalsEngine.proposals.at(blockHash,proposalId) as Proposal;
          const proposalType = await api.query.proposalsCodex.proposalDetailsByProposalId.at(blockHash,proposalId) as ProposalDetails;
          console.log("proposalStatus",proposalStatus)
          console.log("proposalType",proposalType)
          console.log("proposalType",proposalType.value)
          console.log("proposalType",proposalType.toJSON())
          console.log("proposalStatus",proposalStatus.toJSON())
          //const proposalType = proposalStatus
          const proposal = {
            proposalEvent: event.method.toString(),
            proposalId: proposalId.toNumber(),
            madeBy: madeBy.toNumber(),
            date: new Date(timestamp.toNumber()),
            blockHeight: blockNumber,
            session: session.toNumber(),
            era: era.toNumber()
          };
          //console.log("proposalCreated",proposalStatus)
          proposals.push(proposal)
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
        const slotStake = await api.query.staking.slotStake.at(oldHash) as Balance;
        const validatorInfo = await api.query.staking.currentElected.at(oldHash) as AccountId;
        console.log("validatorInfo",validatorInfo)
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
          validatorSet: validatorInfo.length,
          slotStake: slotStake.toNumber(),
          date: new Date(timestamp.toNumber()),
          blockHeight: blockNumber,
          session: session.toNumber(),
          era: era.toNumber()
        };
        slashes.push(slashesAtBlock)
    }
    oldHash = blockHash
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
