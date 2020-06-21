// @ts-check

import { ApiPromise, WsProvider } from '@polkadot/api';
import { registerJoystreamTypes } from '@joystream/types';
import { Hash, EraIndex, SessionIndex, EventRecord, AccountId, Balance, Proposal, BlockNumber } from "@polkadot/types/interfaces";
import { Vec, Option } from '@polkadot/types/codec';
import { u32 } from '@polkadot/types';
import { EntityId } from '@joystream/types/lib/versioned-store';
import { MemberId } from '@joystream/types/lib/members';
import { ProposalId, ProposalDetails, ProposalStatus, Active, VotingResults } from '@joystream/types/lib/proposals';
import { MintId } from '@joystream/types/lib/mint';
import { ActiveProposal, Overview, Slashing, PoolChange } from './interfaces';
import { getStakingRewards, getSlash, getVote, getProposalCreated, getProposalStatusUpdated } from './get-history-events';
import { RoleParameters } from '@joystream/types/lib/roles';
import { getPoolChanges } from './functions';
import { topUps, allExchanges } from './pool-changes';

// will not work with firstblock<909252
const firstblock:number = 1260411
const lastblock = 1308706
const burnAddress: string = "5D5PhZQNJzcJXVBxwJxZcsutjKPqUPydrvpu6HeiBfMaeKQu"

//const objectEntity = new ClassId(1)
//const videoEntity = new ClassId(7)

const curatorMintId = new MintId(0)
const councilMintId = new MintId(1)

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
  //const startEra = await api.query.staking.currentEra.at(fistBlockHash) as EraIndex
  //const endEra = await api.query.staking.currentEra.at(lastBlockHash) as EraIndex

  //Some Examples
  const proposals = []
  const valRewards = []
  const slashings: Slashing[] = []
  //const storageProviders = []
  const proposalIds: number[] = []
  let transactionFees = 0
  let storageFees = 0
  const proposalsAtStart = await api.query.proposalsEngine.proposalCount.at(fistBlockHash) as u32
  const proposalsAtEnd = await api.query.proposalsEngine.proposalCount.at(lastBlockHash) as u32
  //Get active proposals at start
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
  }


  //Iterate through all blocks to get all events (some things are only available this way)
  for (let blockHeight=firstblock; blockHeight<lastblock; blockHeight++) {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockHeight)
    const session = await api.query.session.currentIndex.at(blockHash) as SessionIndex
    const era = await api.query.staking.currentEra.at(blockHash) as EraIndex
    const events = await api.query.system.events.at(blockHash) as Vec<EventRecord>;

    //const timestamp = await api.query.timestamp.now.at(blockHash) as Moment;
    for (let { event } of events) {
      
      //Get exchanges
      if (event.section === 'balances' && event.method === 'Transfer') {
        const recipient = event.data[1] as AccountId;
        if (recipient.toString() === burnAddress) {
          const amountJOY = event.data[2] as Balance;
          const newExchange:PoolChange = {
            blockHeight: blockHeight,
            amount: amountJOY.toNumber()
          }
          allExchanges.push(newExchange)
        }

      //Get validator rewards 
      } else if (event.section === 'staking' && event.method === 'Reward') {
        valRewards.push(await getStakingRewards(api, event.data, oldHash, blockHeight, era, session))

      //Get validator slashes
      } else if (event.section === 'staking' && event.method === 'Slash') {
        slashings.push(await getSlash(event.data, blockHeight, era, session))

      //Get new proposals
      } else if (event.section === 'proposalsEngine' && event.method === 'ProposalCreated') {
          const proposalId = event.data[1] as ProposalId
          proposalIds.push(proposalId.toNumber())
          proposals.push(await getProposalCreated(api, proposalId, blockHash))

      //Get votes
      } else if (event.section === 'proposalsEngine' && event.method === 'Voted') {
        const proposalId = event.data[1] as ProposalId
        for (let proposal in proposals) {
          if (proposals[proposal].id === proposalId.toNumber() ) {
             }
             proposals[proposal].voters.push(await getVote(event.data, blockHeight))
          }
        //Get changes in the status of a proposal
      } else if (event.section === 'proposalsEngine' && event.method === 'ProposalStatusUpdated') {
        await getProposalStatusUpdated(event.data, proposals, proposalIds, blockHeight)

      } else if (event.section === 'system' && event.method === 'extrinsicSuccess') {
        transactionFees += 1
    }
  }
    oldHash = blockHash
  }

  //Get voting on all proposals
  for (let index in proposalIds) {
    const proposalData = await api.query.proposalsEngine.proposals.at(lastBlockHash,proposalIds[index]) as Proposal
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
  }
  console.log("proposals",proposals)

  const startIssuance = await api.query.balances.totalIssuance.at(fistBlockHash) as Balance
  const endIssuance = await api.query.balances.totalIssuance.at(lastBlockHash) as Balance
  //const councilMembers = await api.query.council.activeCouncil.at(fistBlockHash) as AccountId
  //const councilMintInfoStart = await api.query.minting.mints.at(lastBlockHash,councilMintId) as Mint
  const councilMintInfoStart = await api.query.minting.mints.at(fistBlockHash,councilMintId) as any
  const councilMintInfoEnd = await api.query.minting.mints.at(lastBlockHash,councilMintId) as any
  const curatorMintInfoStart = await api.query.minting.mints.at(fistBlockHash,curatorMintId) as any
  const curatorMintInfoEnd = await api.query.minting.mints.at(lastBlockHash,curatorMintId) as any
  const entitiesAtStart = await api.query.versionedStore.nextEntityId.at(fistBlockHash) as EntityId;
  const entitiesAtEnd = await api.query.versionedStore.nextEntityId.at(lastBlockHash) as EntityId;
  const knownContentAtStart = await api.query.dataDirectory.knownContentIds.at(fistBlockHash) as any;
  const knownContentAtEnd = await api.query.dataDirectory.knownContentIds.at(lastBlockHash) as any;
  const forumPostsAtStart = await api.query.forum.nextPostId.at(fistBlockHash) as any;
  const forumPostsAtEnd = await api.query.forum.nextPostId.at(lastBlockHash) as any;

  let validatorRewardsPaid = 0
  for (let i=0; i<valRewards.length; i++) {
    validatorRewardsPaid += valRewards[i].sharedReward
  }
  let validatorBurnedBySlash = 0
  for (let i=0; i<slashings.length; i++) {
    validatorBurnedBySlash += slashings[i].slashedAmount
  }

  const poolHistory = await getPoolChanges(api,firstblock,lastblock, topUps, allExchanges)
  const poolStart = poolHistory[0]
  const poolEnd = poolHistory[poolHistory.length-1]

  let totalExchanged = 0
  let totalValueExchanged = 0
  for (let i=0; i<poolHistory.length; i++) {
    totalExchanged += poolHistory[i].tokensBurned
    if (poolHistory[i].poolChange < 0) {
      totalValueExchanged += poolHistory[i].poolChange
    }
  }

  let estimateOfStorageSpend = 0
  for (let blockHeight=firstblock; blockHeight<lastblock; blockHeight+=600) {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockHeight)
    const storageProviders = (await api.query.actors.actorAccountIds.at(blockHash) as any).length
    const storageParameters = (await api.query.actors.parameters.at(blockHash,"StorageProvider") as Option<RoleParameters>).unwrap();
    const reward = storageParameters.reward.toNumber()
    const rewardPeriod = storageParameters.reward_period.toNumber()
    estimateOfStorageSpend += storageProviders*reward*rewardPeriod/600
  }



  const overview: Overview = {
    startBlock: firstblock,
    endBlock: lastblock,
    blockRange: lastblock-firstblock,
    startIssuance: startIssuance.toNumber(),
    endIssuance: endIssuance.toNumber(),
    totalExchangeBurn: totalExchanged,
    totalValueExchanged: totalValueExchanged,
    councilMintSpent: councilMintInfoEnd[0].get("total_minted").toNumber() - councilMintInfoStart[0].get("total_minted").toNumber(),
    curatorMintSpent: curatorMintInfoEnd[0].get("total_minted").toNumber() - curatorMintInfoStart[0].get("total_minted").toNumber(),
    validatorRewardsPaid: validatorRewardsPaid,
    validatorBurnedBySlash: validatorBurnedBySlash,
    estimateOfStorageSpend: estimateOfStorageSpend,
    storageSignupFeesPaid: transactionFees,
    tokensBurnedFromExtrinsics: storageFees,
    proposalsMade: proposalsAtEnd.toNumber()-proposalsAtStart.toNumber(),
    forumPostsMade: forumPostsAtEnd.toNumber()-forumPostsAtStart.toNumber(),
    contentFilesAdded: entitiesAtEnd.toNumber()-entitiesAtStart.toNumber(),
    entitiesCreated: knownContentAtEnd.length-knownContentAtStart.length,
    poolAtStart: poolStart.newPool,
    poolAtEnd:  poolEnd.newPool,
    rateAtStart: poolStart.newPool/startIssuance.toNumber(),
    rateAtEnd: poolEnd.newPool/endIssuance.toNumber()
  }
  console.log("summary",overview)

  
  api.disconnect();
}
main()