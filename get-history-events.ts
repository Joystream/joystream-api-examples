// @ts-check

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { registerJoystreamTypes, VoteKind } from '@joystream/types';
import { Hash, EraIndex, SessionIndex, Exposure, EventRecord, Moment, AccountId, Balance, Proposal, BlockNumber } from "@polkadot/types/interfaces";
import { Vec } from '@polkadot/types/codec';
import { Bytes, u32 } from '@polkadot/types';
import { EntityId, Entity, ClassId, VecU16 } from '@joystream/types/lib/versioned-store';
import { MemberId } from '@joystream/types/lib/members';
import { ProposalId, ProposalDetails, ProposalStatus, Active, Finalized, VotingResults, Approved, ProposalDecisionStatus } from '@joystream/types/lib/proposals';
//import { MintId, Mint } from '@joystream/types/lib/mint';


const firstblock:number = 936820
const lastblock = firstblock+14402
const address: string = "5D5PhZQNJzcJXVBxwJxZcsutjKPqUPydrvpu6HeiBfMaeKQu"

const objectEntity = new ClassId(1)
const videoEntity = new ClassId(7)

//const curatorMintId = new MintId(0)
//const councilMintId = new MintId(1)

interface Voters {
  voter: number,
  vote: string,
  blockNumber: number
}
interface VoteStatus {
  abstensions: number,
  approvals: number,
  rejections: number,
  slashes: number
}

interface ActiveProposal {
  id: number,
  type: string,
  createdBy: number,
  created: number,
  voters: Voters[],
  status: string,
  finalizedAt?: number,
  votingResults?: VoteStatus,
  result?: string,
  executedAt?: number,
  executionDetails?: string,
}

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
  const proposalIds: number[] = []
  const proposalsAtStart = await api.query.proposalsEngine.proposalCount.at(fistBlockHash) as u32
  for (let i=1; i<proposalsAtStart.toNumber()+1; i++) {
    const proposalData = await api.query.proposalsEngine.proposals.at(fistBlockHash,i) as Proposal
    const proposalStatus = proposalData.get("status") as ProposalStatus
    if (proposalStatus.value instanceof Active) {
      proposalIds.push(i)
      const proposalsDetails = await api.query.proposalsCodex.proposalDetailsByProposalId.at(fistBlockHash,i) as ProposalDetails
      const activeProposal: ActiveProposal = {
        id: i,
        type: proposalsDetails.type.toString(),
        createdBy: (proposalData.get("proposerId") as MemberId).toNumber(),
        created: (proposalData.get("createdAt") as BlockNumber).toNumber(),
        voters: [],
        status: proposalStatus.type
      }
      proposals.push(activeProposal)
    }

    console.log("proposalIds",proposalIds)
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
          const proposalId = event.data[1] as ProposalId
          proposalIds.push(proposalId.toNumber())
          const proposalData = await api.query.proposalsEngine.proposals.at(blockHash,proposalId) as Proposal;
          const proposalStatus = proposalData.get("status") as ProposalStatus
          const proposalsDetails = await api.query.proposalsCodex.proposalDetailsByProposalId.at(blockHash,proposalId) as ProposalDetails
          const activeProposal: ActiveProposal = {
            id: proposalId.toNumber(),
            type: proposalsDetails.type.toString(),
            createdBy: (proposalData.get("proposerId") as MemberId).toNumber(),
            created: (proposalData.get("createdAt") as BlockNumber).toNumber(),
            voters: [],
            status: proposalStatus.type
          };
          proposals.push(activeProposal)
      } else if (event.section === 'proposalsEngine' && event.method === 'Voted') {
        const proposalId = event.data[1] as ProposalId
        const memberId = event.data[0] as MemberId
        const voteKind = event.data[2] as VoteKind
        for (let proposal in proposals) {
          if (proposals[proposal].id === proposalId.toNumber() ) {
            const voters: Voters = {
              voter: memberId.toNumber(),
              vote: voteKind.toString(),
              blockNumber: blockNumber
             }
             proposals[proposal].voters.push(voters)
          }
        }
      } else if (event.section === 'proposalsEngine' && event.method === 'ProposalStatusUpdated') {
        const proposalId = event.data[0] as ProposalId
        const proposalStatus = event.data[1] as ProposalStatus
        if (proposalIds.includes(proposalId.toNumber())) {
          const index = proposalIds.indexOf(proposalId.toNumber())
          if (proposalStatus.value instanceof Finalized) {
            const decision = proposalStatus.value.get("proposalStatus") as ProposalDecisionStatus
            if (decision.value instanceof Approved) {
              if (decision.value.toString()==="PendingExecution") {
                proposals[index].executedAt = blockNumber
              }
            }
          }
        }

          if (((((proposalStatus.value as Finalized).get("proposalStatus")) as ProposalDecisionStatus).value.toString()) === "PendingExecution") {
            const finalizedAt = proposalStatus.value.get("finalizedAt") as BlockNumber
            proposals[index].finalizedAt = finalizedAt.toNumber()
          }
        }
        console.log("proposalId",proposalId,blockNumber)
        const proposalData = await api.query.proposalsEngine.proposals.at(blockHash,proposalId) as Proposal
        const proposalStatusD = proposalData.get("status") as ProposalStatus
        const proposalDataOld = await api.query.proposalsEngine.proposals.at(oldHash,proposalId) as Proposal
        const proposalStatusOld = proposalDataOld.get("status") as ProposalStatus
        if (((((proposalStatus.value as Finalized).get("proposalStatus")) as ProposalDecisionStatus).value.toString()) === "PendingExecution") {
          
        }
        if (((((proposalStatus.value as Finalized).get("proposalStatus")) as ProposalDecisionStatus).value.toString()) === "Executed") {
          console.log("isExecuted")
        }
        console.log("test",(((proposalStatus.value as Finalized).get("proposalStatus")) as ProposalDecisionStatus).value.toString())
        console.log("match",proposalStatusD===proposalStatus)
        console.log("match",proposalStatusD!==proposalStatus)
        console.log("match",proposalStatusOld===proposalStatus)
        console.log("match",proposalStatusOld!==proposalStatus)
        console.log("match",proposalStatusD===proposalStatusOld)
        console.log("match",proposalStatusD!==proposalStatusOld)
        if (proposalStatus.value instanceof Finalized) {
          const decision = proposalStatus.value.get("proposalStatus") as ProposalDecisionStatus
          if (decision.value instanceof Approved) {
            console.log("Approved",decision.value.toString())
          }
        }





        /*
        console.log("proposalId",proposalId,blockNumber)
        console.log("proposalData1",proposalData1)
        const proposalData = await api.query.proposalsEngine.proposals.at(blockHash,proposalId) as Proposal
        const proposalDataOld = await api.query.proposalsEngine.proposals.at(oldHash,proposalId) as Proposal
        console.log("proposalData",proposalData)
        console.log("proposalDataOld",proposalDataOld)
        const proposalStatus = proposalData.get("status") as ProposalStatus
        const proposalStatusOld = proposalDataOld.get("status") as ProposalStatus
        if (proposalStatus.value instanceof Finalized) {
          const decision = proposalStatus.value.get("proposalStatus") as ProposalDecisionStatus
          console.log("decision",decision)
          if (decision.value instanceof Approved) {
            console.log("Approved",decision.toString())
            console.log("Approved",decision.value.toString())
            console.log("Approved",decision.type)
            console.log("Approved",decision.value.index)
            console.log("Approved",decision.value.toRawType())
            console.log("Approved",decision.value["raw"])
            console.log("Approved",decision.value.index)
          }
        }
        if (proposalStatusOld.value instanceof Finalized) {
          const decisionOld = proposalStatusOld.value.get("proposalStatus") as ProposalDecisionStatus
          console.log("decisionOld",decisionOld)
          if (decisionOld.value instanceof Approved) {
            console.log("Approved",decisionOld.toString())
            console.log("Approved",decisionOld.value.toString())
            console.log("Approved",decisionOld.type)
            console.log("Approved",decisionOld.value.index)
            console.log("Approved",decisionOld.value.toRawType())
            console.log("Approved",decisionOld.value["raw"])
            console.log("Approved",decisionOld.value.index)
          }
        }
        */
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

  console.log("proposalIds",proposalIds)
  for (let index in proposalIds) {
    const proposalData = await api.query.proposalsEngine.proposals.at(lastBlockHash,proposalIds[index]) as Proposal
    console.log("proposalData",proposalData)
    const proposalStatus = proposalData.get("status") as ProposalStatus
    const voteStatus = proposalData.get("votingResults") as VotingResults
    const votingResults = {
      abstensions: (voteStatus.get("abstensions") as u32).toNumber(),
      approvals: (voteStatus.get("approvals") as u32).toNumber(),
      rejections: (voteStatus.get("rejections") as u32).toNumber(),
      slashes: (voteStatus.get("slashes") as u32).toNumber()
    }
    proposals[index].votingResults = votingResults
    if (proposalStatus.value instanceof Active) {
      proposals[index].status = proposalStatus.type
    }
    if (proposalStatus.value instanceof Finalized) {
      proposals[index].status = proposalStatus.type
      console.log("testFinalized",proposalStatus)
      console.log("testFinalized",proposalStatus.value)
      const finalizedAt = proposalStatus.value.get("finalizedAt") as BlockNumber
      const decision = proposalStatus.value.get("proposalStatus") as ProposalDecisionStatus
      console.log("decision",decision)
      console.log("decision",decision.type)
      console.log("decision",decision.value)
      proposals[index].result = decision.type
      if (decision.value instanceof Approved) {
        console.log("Approved",decision)
        console.log("Approved",decision.toString())
        console.log("Approved",decision.value.toString())
        console.log("Approved",decision.type)
        console.log("Approved",decision.value.index)
        console.log("Approved",decision.value.toRawType())
        console.log("Approved",decision.value["raw"])
        console.log("Approved",decision.value.index)
      }
      proposals[index].finalizedAt = finalizedAt.toNumber()
    }
    for (let items in proposals[index].voters) {
      console.log("proposals",proposals[index].voters[items])
    }
    console.log("proposals",proposals)
  }
  api.disconnect();
}
main()
/*
interface Voters {
  voter: number,
  vote: string,
  blockNumber: number
}
interface VoteStatus {
  abstensions: number,
  approvals: number,
  rejections: number,
  slashes: number
}

interface ActiveProposal {
  id: number,
  type: string,
  createdBy: number,
  created: number,
  voters: Voters[],
  status: string,
  finalized?: number,
  votingResults?: VoteStatus,
  result?: string,
  executed?: number,
  executionDetails?: string,
}
*/
