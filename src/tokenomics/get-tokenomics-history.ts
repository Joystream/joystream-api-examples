// @ts-check

import { ApiPromise, WsProvider } from '@polkadot/api';
import { registerJoystreamTypes } from '@joystream/types';
import { Hash, EraIndex, SessionIndex, EventRecord, AccountId, Balance, BlockNumber, Moment, SignedBlock, Extrinsic } from "@polkadot/types/interfaces";
import { Vec } from '@polkadot/types/codec';
import { ProposalId, } from '@joystream/types/lib/proposals';
import { Slashing, OverviewRange,  OverviewTokenomics, ValidatorReward, ExchangeInfo } from './interfaces';
import { getStakingRewards, getSlash, getVote, getProposalCreated, getProposalStatusUpdated, getActorJoined, getLastStakingRewardHeight } from './get-history-events';
import { topUps, allExchanges } from './pool-changes';
import { getPoolStart, getValidationOverview, getCouncilOverview, getStorageOverview, getCuratorOverview, getPoolEnd, getActiveProposals, getProposalVotingData, getProposalOverview, getGeneralOverview } from './functions';

// Will not work with firstBlock<909252
// Script is meant to get the data from a single council term, and will not include what happens after a new one is elected
const firstBlock:number = 1442011
//
let lastBlock = 1442010+100800
const burnAddress: string = "5D5PhZQNJzcJXVBxwJxZcsutjKPqUPydrvpu6HeiBfMaeKQu"

async function main () {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider('ws://127.0.0.1:9944');

  // register types before creating the api
  registerJoystreamTypes();

  // Create the API and wait until ready
  const api = await ApiPromise.create({provider});
  let oldHash: Hash = await api.rpc.chain.getBlockHash(firstBlock-1)
  const firstBlockHash: Hash = await api.rpc.chain.getBlockHash(firstBlock)

  let councilElectedAtFirstblock = false
  let councilTermEndedBlock = lastBlock

  const valRewards: ValidatorReward[] = []
  const slashings: Slashing[] = []
  let lastValRewardHeight = await getLastStakingRewardHeight(api, firstBlock)
  const proposalIds: number[] = []
  let transactionFees = 0
  let storageFees = 0
  let membershipFees = 0
  let balanceTransfers = 0
  let extrinsicTipsPayed = 0
  let actualExchangeBurns = 0

  
  //Get active proposals at start
  const activeProposals = await getActiveProposals(api,firstBlockHash)

  //Get fiat pool info at start
  const poolStart = await getPoolStart(api, burnAddress, firstBlock, topUps, allExchanges)
  const newExchanges: ExchangeInfo[] = []

  //Iterate through all blocks to get all events (some things are only available this way)
  for (let blockHeight=firstBlock; blockHeight<lastBlock+1; blockHeight++) {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockHeight)
    const session = await api.query.session.currentIndex.at(blockHash) as SessionIndex
    const era = await api.query.staking.currentEra.at(blockHash) as EraIndex
    const events = await api.query.system.events.at(blockHash) as Vec<EventRecord>;
    const getBlock = await api.rpc.chain.getBlock(blockHash) as SignedBlock
    // Get extrinsic info
    const extrinsicsInBlock = getBlock.block.extrinsics as Vec<Extrinsic>
    for (let i=0; i<extrinsicsInBlock.length; i++) {
      const sectionName = extrinsicsInBlock[i].method.sectionName
      const methodName = extrinsicsInBlock[i].method.methodName
      // Get tokens burned as "tips"
      if (extrinsicsInBlock[i].tip.toNumber()>0) {
        if (extrinsicsInBlock[i].signer.toString() === burnAddress) {
          actualExchangeBurns += extrinsicsInBlock[i].tip.toNumber()
        } else {
          extrinsicTipsPayed += extrinsicsInBlock[i].tip.toNumber()
        }
      }
      // Get tokens burned from tx fees
      if (
        sectionName === "actors" || sectionName ==="contentWorkingGroup" || sectionName === "councilElection" || 
        sectionName === "dataDirectory" || sectionName === "dataObjectStorageRegistry" || sectionName === "discovery" || 
        sectionName === "forum" || sectionName === "memo" || sectionName === "proposalsCodex" || 
        sectionName === "proposalsDiscussion" || sectionName === "proposalsEngine" || sectionName === "staking" || 
        sectionName === "versionedStorePermissions" ||
        (sectionName === "members" && methodName !== "buyMembership") ||
        (sectionName === "session" && methodName=== "setKeys")
      ) {
        transactionFees ++
        // Get tokens burned from membership purchases
      } else if (sectionName === "members" && methodName=== "buyMembership") {
        transactionFees ++
        membershipFees += 100
      }
    }
    for (let { event } of events) {
      
      //Get exchanges
      if (event.section === 'balances' && event.method === 'Transfer') {
        balanceTransfers ++
        transactionFees ++
        const recipient = event.data[1] as AccountId;
        if (recipient.toString() === burnAddress) {
          const amountJOY = event.data[2] as Balance;
          const newExchange:ExchangeInfo = {
            amount: amountJOY.toNumber(),
            tokensRecievedAtBlock: blockHeight,
          }
          newExchanges.push(newExchange)
        }

      //Get validator rewards 
      } else if (event.section === 'staking' && event.method === 'Reward') {
        if (valRewards.length>0) {
          lastValRewardHeight = valRewards[valRewards.length-1].blockHeight
        }
        valRewards.push(await getStakingRewards(api, event.data, oldHash, blockHeight, lastValRewardHeight, era, session))

      //Get validator slashes
      } else if (event.section === 'staking' && event.method === 'Slash') {
        slashings.push(await getSlash(event.data, blockHeight, era, session))

      //Get new proposals
      } else if (event.section === 'proposalsEngine' && event.method === 'ProposalCreated') {
          const proposalId = event.data[1] as ProposalId
          proposalIds.push(proposalId.toNumber())
          activeProposals.push(await getProposalCreated(api, proposalId, blockHash))

      //Get proposal votes
      } else if (event.section === 'proposalsEngine' && event.method === 'Voted') {
        const proposalId = event.data[1] as ProposalId
        for (let proposal in activeProposals) {
          if (activeProposals[proposal].id === proposalId.toNumber() ) {
            activeProposals[proposal].voters.push(await getVote(event.data, blockHeight))
             }
          }
      //Get changes in the status of a proposal
      } else if (event.section === 'proposalsEngine' && event.method === 'ProposalStatusUpdated') {
        await getProposalStatusUpdated(event.data, activeProposals, proposalIds, blockHeight)

      //Get all storage signup fees
      } else if (event.section === 'actors' && event.method === 'Staked') {
        storageFees += await getActorJoined(api, event.data, blockHash);

        //If a new council is elected, sets lastBlock to this height
      } else if (event.section === 'councilElection' && event.method === 'CouncilElected') {
        if (blockHeight>firstBlock) {
          lastBlock = (event.data[0] as BlockNumber).toNumber()
          console.log("New council elected, ending report generation at block:", lastBlock)
          break
        } else if ( blockHeight===firstBlock ){
          councilElectedAtFirstblock = true
        }

      //Get councilRewards
      } else if (event.section === 'council' && event.method === 'CouncilTermEnded') {
        councilTermEndedBlock = blockHeight-1
      }
    }
    oldHash = blockHash
  }


  const lastBlockHash: Hash = await api.rpc.chain.getBlockHash(lastBlock)
  const timestampStart = await api.query.timestamp.now.at(firstBlockHash) as Moment;
  const timestampEnd = await api.query.timestamp.now.at(lastBlockHash) as Moment;
  const startIssuance = await api.query.balances.totalIssuance.at(firstBlockHash) as Balance
  const endIssuance = await api.query.balances.totalIssuance.at(lastBlockHash) as Balance

  //Get voting on all proposals
  const proposalEnd = await getProposalVotingData(api,lastBlockHash,proposalIds,activeProposals)

  //Get fiat pool info at end
  const poolEnd = await getPoolEnd(api,burnAddress,lastBlock,poolStart,topUps,newExchanges)

  const outputRangeStats: OverviewRange = {
    startBlock: firstBlock,
    endBlock: lastBlock,
    blockRange: lastBlock-firstBlock,
    timestampStart: new Date(timestampStart.toNumber()),
    timestampEnd: new Date(timestampEnd.toNumber()),
    totalBalanceTransfers: balanceTransfers,
  }

  const councilStats = await getCouncilOverview(api,firstBlockHash, councilElectedAtFirstblock, councilTermEndedBlock, lastBlockHash)

  const storageStats = await getStorageOverview(api, firstBlock, firstBlockHash, lastBlock, lastBlockHash, storageFees)
    
  const curatorStats = await getCuratorOverview(api, firstBlock, firstBlockHash, lastBlock, lastBlockHash)
  
  const validatorStats = await getValidationOverview(firstBlock, lastBlock, valRewards, slashings, timestampStart, timestampEnd)

  const proposalStats = await getProposalOverview(proposalEnd)

  const generalStats = await getGeneralOverview(api, firstBlockHash, lastBlockHash)

  const totalRewardsMint = councilStats.councilRewardsPaid+storageStats.netStorageProviderSpend+curatorStats.rewardsEarned+validatorStats.totalRewardsMinted+proposalStats.fundingCosts

  const totalFeesSlashesBurns = transactionFees+membershipFees+extrinsicTipsPayed+poolEnd.tokensExchangedInRange+validatorStats.totalSlashesIncurred+storageStats.feesPaid+proposalStats.feesPaid+proposalStats.slashAmount


  const tokenomicsStats: OverviewTokenomics = {
    startIssuance: startIssuance.toNumber(),
    endIssuance: endIssuance.toNumber(),
    issuanceDiff: endIssuance.toNumber()-startIssuance.toNumber(),
    tokensExchangedInRange: poolEnd.tokensExchangedInRange,
    totalValueExchanged: poolEnd.cashedOutInRange,
    poolAtStart: poolStart.poolSize,
    poolAtEnd:  poolEnd.poolSize,
    rateAtStart: poolStart.rate,
    rateAtEnd: poolEnd.rate,
    actualExchangeBurnsInRange: actualExchangeBurns,
    extrinsicFeeBurn: transactionFees,
    extrinsicTipBurn: extrinsicTipsPayed,
    membershipFees: membershipFees,
    netValidatorSpend: validatorStats.totalRewardsMinted-validatorStats.totalSlashesIncurred,
    netStorageProviderSpend: storageStats.netStorageProviderSpend-storageStats.feesPaid,
    netCouncilSpend: councilStats.councilRewardsPaid,
    netProposalSpend: proposalStats.fundingCosts-proposalStats.feesPaid-proposalStats.slashAmount,
    netCuratorSpend: curatorStats.rewardsEarned,
    totalRewardsMinted: totalRewardsMint,
    totalFeesSlashesBurns: totalFeesSlashesBurns,
    expectedIssuanceDiffNoExchanges: totalRewardsMint-totalFeesSlashesBurns+poolEnd.tokensExchangedInRange,
    actualIssuanceDiffNoExchanges: endIssuance.toNumber()-startIssuance.toNumber()+actualExchangeBurns,
  }

  console.log("proposalEnd",JSON.stringify(proposalEnd, null, 4))

  console.log("outputRangeStats",JSON.stringify(outputRangeStats, null, 4))

  console.log("generalStats",JSON.stringify(generalStats, null, 4))

  console.log("councilStats",JSON.stringify(councilStats, null, 4))

  console.log("proposalStats",JSON.stringify(proposalStats, null, 4))

  console.log("storageStats",JSON.stringify(storageStats, null, 4))

  console.log("curatorStats",JSON.stringify(curatorStats, null, 4))

  console.log("validatorStats",JSON.stringify(validatorStats, null, 4))
  
  console.log("poolStart",JSON.stringify(poolStart, null, 4))
  
  console.log("poolEnd",JSON.stringify(poolEnd, null, 4))

  console.log("tokenomicsStats",JSON.stringify(tokenomicsStats, null, 4))
  
  api.disconnect();
}
main()