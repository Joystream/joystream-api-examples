import { ApiPromise } from "@polkadot/api"
import { PoolTopup, ExchangeInfo, OverviewCouncil, ValidatorReward, Slashing, OverviewValidation, OverviewStorage, OverviewCurators, ActiveProposal, PoolStatus, PoolChangeHistory, OverviewProposal, OverviewGeneral, VoteStatus } from "./interfaces"
import { Hash, Balance, Proposal, Moment, BlockNumber } from "@polkadot/types/interfaces"
import { Seats, Active, ProposalStatus, VotingResults, ProposalDetails, SpendingParams, Finalized, ProposalDecisionStatus, Approved, ActiveStake } from "@joystream/types/lib/proposals"
import { MemberId } from "@joystream/types/lib/members"
import { Vec, Option, Tuple, Enum } from '@polkadot/types/codec';
import { MintId } from "@joystream/types/lib/mint"
import { RewardRelationshipId, Recipient } from "@joystream/types/lib/recurring-rewards"
import { RoleParameters } from "@joystream/types/lib/roles"
import AccountId from "@polkadot/types/primitive/Generic/AccountId"
import { Curator, CuratorRoleStage, CuratorInduction, CuratorExitSummary, CuratorApplication, ChannelId } from "@joystream/types/lib/content-working-group"
import { u32 } from "@polkadot/types"
import { StakeId, Stake, Staked } from "@joystream/types/lib/stake"
import { PostId, CategoryId } from "@joystream/types/lib/forum"
import { EntityId } from "@joystream/types/lib/versioned-store"

export async function getProposalVotingData(api: ApiPromise, lastBlockHash: Hash, proposalIds:number[], activeProposals: ActiveProposal[]): Promise<ActiveProposal[]> {
  const proposals = activeProposals
  for (let index in proposalIds) {
    const proposalInfo = await api.query.proposalsEngine.proposals.at(lastBlockHash,proposalIds[index]) as Proposal
    const proposalStatus = proposalInfo.get("status") as ProposalStatus
    const voteStatus = proposalInfo.get("votingResults") as VotingResults
    const votingResults: VoteStatus = {
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
  return proposals  
}

export async function getActiveProposals(api: ApiPromise, firstBlockHash: Hash): Promise<ActiveProposal[]> {
  const proposalsAtStart = await api.query.proposalsEngine.proposalCount.at(firstBlockHash) as u32
  const activeProposalsAtStart: ActiveProposal[] = []
  for (let i=1; i<proposalsAtStart.toNumber()+1; i++) {
    const proposalData = await api.query.proposalsEngine.proposals.at(firstBlockHash,i) as Proposal
    const proposalStatus = proposalData.get("status") as ProposalStatus
    let stake = 0
    if (proposalStatus.value instanceof Active) {
      const proposalsDetails = await api.query.proposalsCodex.proposalDetailsByProposalId.at(firstBlockHash,i) as ProposalDetails
      const stakeId = ((proposalStatus.value.value) as ActiveStake).get("stakeId") as StakeId
      const stakeData = (await api.query.stake.stakes.at(firstBlockHash,stakeId) as Tuple)[0] as Stake
      stake = (stakeData.staking_status.value as Staked).staked_amount.toNumber()
      const activeProposal: ActiveProposal = {
        id: i,
        type: proposalsDetails.type.toString(),
        title: proposalData.get("title")?.toString(),
        createdBy: (proposalData.get("proposerId") as MemberId).toNumber(),
        stakeId: stakeId.toNumber(),
        stake: stake,
        created: (proposalData.get("createdAt") as BlockNumber).toNumber(),
        statusAtStart: proposalStatus.type,
        voters: [],
        status: proposalStatus.type,
      }
      if (proposalsDetails.value instanceof SpendingParams) {
        activeProposal.spending = (proposalsDetails.value[0] as Balance).toNumber()
      }
      activeProposalsAtStart.push(activeProposal)
    } else if (proposalStatus.value instanceof Finalized) {
        const decision = proposalStatus.value.get("proposalStatus") as ProposalDecisionStatus
        if (decision.value instanceof Approved) {
          if (decision.value.toString()==="PendingExecution") {
            const proposalsDetails = await api.query.proposalsCodex.proposalDetailsByProposalId.at(firstBlockHash,i) as ProposalDetails
            const activeProposal: ActiveProposal = {
              id: i,
              type: proposalsDetails.type.toString(),
              title: proposalData.get("title")?.toString(),
              createdBy: (proposalData.get("proposerId") as MemberId).toNumber(),
              created: (proposalData.get("createdAt") as BlockNumber).toNumber(),
              statusAtStart: proposalStatus.type,
              voters: [],
              status: proposalStatus.type,
            }
            if (proposalsDetails.value instanceof SpendingParams) {
              activeProposal.spending = (proposalsDetails.value[0] as Balance).toNumber()
            }
            activeProposalsAtStart.push(activeProposal)
          }
        }
      }
    }
  return activeProposalsAtStart
}

export async function getProposalOverview(proposals: ActiveProposal[]): Promise<OverviewProposal> {
  let activeProposalsAtStart = 0
  let activeProposalsAtEnd = 0
  let fundingCosts = 0
  let feesPaid = 0
  let slashAmount = 0
  let proposalsAddedInRange = 0
  let proposalsFinalizedInRange = 0
  for (let i=0;i<proposals.length; i++) {
    const prop = proposals[i]
    if (prop.statusAtStart === "Active") {
      activeProposalsAtStart += 1
    } else {
      proposalsAddedInRange += 1
    } 
    if (prop.status === "Active") {
      activeProposalsAtEnd += 1
    }
    if (prop.executionStatus === "Executed" && prop.type === "Spending") {
      fundingCosts += prop.spending ?? 0
    }
    if (prop.status === "Finalized" && prop.statusAtStart !== "Finalized") {
      proposalsFinalizedInRange +=1
    }
    if (prop.result === "Canceled" || prop.result === "Cancelled" || prop.result === "Rejected" || prop.result === "Expired") {
      feesPaid += prop.feePaid ?? 0
    }
    if (prop.result === "Slashed") {
      slashAmount += prop.stake ?? 0
    }
  }
  const proposalData: OverviewProposal = {
    activeProposalsAtStart: activeProposalsAtStart,
    activeProposalsAtEnd: activeProposalsAtEnd,
    fundingCosts: fundingCosts,
    feesPaid: feesPaid,
    slashAmount: slashAmount,
    proposalsAddedInRange: proposalsAddedInRange,
    proposalsFinalizedInRange: proposalsFinalizedInRange,
  }
  return proposalData
}


export async function getPoolStart(api: ApiPromise, burnAddress:string, firstBlock:number, topUps:PoolTopup[], allExchanges: ExchangeInfo[]): Promise<PoolStatus> {
  let totalAddedToPool = 0
  let status = topUps[topUps.length-1]
  getStatus:
  for (let i=0; i<topUps.length;i++) {
    if (topUps[i].blockHeight > firstBlock) {
      status = topUps[i-1]
      break getStatus
    } else {
      totalAddedToPool += topUps[i].change
    }
  }
  let totalTokensBurned = 0
  let totalExchangesMade = 0
  let poolSize = status.mintAfter
  for (let i=0; i<allExchanges.length;i++) {
    const blockHeight = allExchanges[i].tokensRecievedAtBlock
    if (blockHeight < firstBlock) {
      const tokensBurned = allExchanges[i].amount
      totalTokensBurned += tokensBurned
      totalExchangesMade += 1
      if (blockHeight > status.blockHeight) {
        const blockHash: Hash = await api.rpc.chain.getBlockHash(blockHeight-1)
        const issuance = await api.query.balances.totalIssuance.at(blockHash) as Balance
        const balanceOfAccount = await api.query.balances.freeBalance.at(blockHash,burnAddress) as Balance
        const calculatedIssuance = issuance.toNumber()-balanceOfAccount.toNumber()
        const poolDrain = (poolSize/calculatedIssuance)*tokensBurned
        poolSize -= poolDrain
      }
    }
  }
  const blockHash: Hash = await api.rpc.chain.getBlockHash(firstBlock)
  const issuance = (await api.query.balances.totalIssuance.at(blockHash) as Balance).toNumber()
  const poolStart: PoolStatus = {
    blockHeight: firstBlock,
    issuance: issuance,
    poolSize: poolSize,
    rate: poolSize/issuance,
    totalAddedToFiatPool: totalAddedToPool,
    totalExchangesMade: totalExchangesMade,
    totalTokensBurned: totalTokensBurned,
    totalCashedOut: totalAddedToPool-poolSize,
    addedToFiatPoolInRange: 0,
    exchangesMadeInRange: 0,
    tokensExchangedInRange: 0,
    cashedOutInRange: 0,
    poolChangesInRange: [],
  }
  return poolStart
}

export async function getGeneralOverview(api: ApiPromise, firstBlockHash:Hash,lastBlockHash:Hash): Promise<OverviewGeneral> {
  const forumCategoriesAtStart = await api.query.forum.nextCategoryId.at(firstBlockHash) as CategoryId;
  const forumCategoriesAtEnd = await api.query.forum.nextCategoryId.at(lastBlockHash) as CategoryId;
  const newCategories = forumCategoriesAtEnd.toNumber()-forumCategoriesAtStart.toNumber()
  const forumPostsAtStart = await api.query.forum.nextPostId.at(firstBlockHash) as PostId;
  const forumPostsAtEnd = await api.query.forum.nextPostId.at(lastBlockHash) as PostId;
  const newPosts = forumPostsAtEnd.toNumber()-forumPostsAtStart.toNumber()
  const channelsAtStart = await api.query.contentWorkingGroup.nextChannelId.at(firstBlockHash) as ChannelId;
  const channelsAtEnd = await api.query.contentWorkingGroup.nextChannelId.at(lastBlockHash) as ChannelId;
  const newChannels = channelsAtEnd.toNumber()-channelsAtStart.toNumber()
  const entitiesAtStart = await api.query.versionedStore.nextEntityId.at(firstBlockHash) as EntityId;
  const entitiesAtEnd = await api.query.versionedStore.nextEntityId.at(lastBlockHash) as EntityId;
  const newEntities = entitiesAtEnd.toNumber()-entitiesAtStart.toNumber()
  const membersAtStart = await api.query.members.membersCreated.at(firstBlockHash) as MemberId;
  const membersAtEnd = await api.query.members.membersCreated.at(lastBlockHash) as MemberId;
  const newMembers = membersAtEnd.toNumber()-membersAtStart.toNumber()
  const generalData: OverviewGeneral = {
    newCategories: newCategories,
    newPosts: newPosts,
    newChannels: newChannels,
    newEntities: newEntities,
    newMembers: newMembers,
}
return generalData
}


export async function getPoolEnd(api: ApiPromise, burnAddress:string,lastBlock:number, poolStart: PoolStatus, topUps:PoolTopup[], newExchanges: ExchangeInfo[]): Promise<PoolStatus> {
  const firstBlock = poolStart.blockHeight
  let poolSize = poolStart.poolSize
  let addedToFiatPoolInRange = 0
  let exchangesMadeInRange = 0
  let tokensExchangedInRange = 0
  let cashedOutInRange = 0
  const topUpSize: number[] = []
  const mintAfterTopUp: number[] = []
  const topUpHeight: number[] = []
  const poolChanges: PoolChangeHistory[] = []
  for (let i=0; i<topUps.length;i++) {
    if (topUps[i].blockHeight > firstBlock && topUps[i].blockHeight <= lastBlock) {
      topUpSize.push(topUps[i].change)
      mintAfterTopUp.push(topUps[i].mintAfter)
      topUpHeight.push(topUps[i].blockHeight)
    }
  }
  for (let i=0; i<newExchanges.length;i++) {
    const blockHeight = newExchanges[i].tokensRecievedAtBlock
    let topUpsProcessed = 0
    for (let n=0; n<topUpHeight.length; n++) {
      if (topUpHeight[n] < blockHeight) {
        const blockHash: Hash = await api.rpc.chain.getBlockHash(topUpHeight[n])
        const issuance = (await api.query.balances.totalIssuance.at(blockHash) as Balance).toNumber()
        const newPoolChange: PoolChangeHistory = {
          blockHeight: topUpHeight[n],
          poolChange: topUpSize[n],
          oldPool: poolSize,
          newPool: mintAfterTopUp[n],
          tokensBurned: 0,
          issuanceBefore: issuance,
          issuanceAfter: issuance,
        }
        poolChanges.push(newPoolChange)
        poolSize = mintAfterTopUp[n]
        addedToFiatPoolInRange += topUpSize[n]
        topUpsProcessed += 1
        }
      }
      topUpHeight.splice(0,topUpsProcessed)
      topUpSize.splice(0,topUpsProcessed)
      mintAfterTopUp.splice(0,topUpsProcessed)

      const tokensBurned = newExchanges[i].amount
      const blockHash: Hash = await api.rpc.chain.getBlockHash(blockHeight-1)
      const issuance = (await api.query.balances.totalIssuance.at(blockHash) as Balance).toNumber()
      const balanceOfAccount = (await api.query.balances.freeBalance.at(blockHash,burnAddress) as Balance).toNumber()
      const calculatedIssuance = issuance-balanceOfAccount
      const poolDrain = (poolSize/calculatedIssuance)*tokensBurned
      const newPoolChange: PoolChangeHistory = {
        blockHeight: blockHeight,
        poolChange: -poolDrain,
        oldPool: poolSize,
        newPool: poolSize-poolDrain,
        tokensBurned: tokensBurned,
        issuanceBefore: issuance,
        issuanceAfter: issuance-tokensBurned,
      }
      poolChanges.push(newPoolChange)
      poolSize -= poolDrain
      exchangesMadeInRange += 1
      tokensExchangedInRange += tokensBurned
      cashedOutInRange += poolDrain
    }
    for (let n=0; n<topUpHeight.length; n++) {
      const blockHash: Hash = await api.rpc.chain.getBlockHash(topUpHeight[n])
      const issuance = (await api.query.balances.totalIssuance.at(blockHash) as Balance).toNumber()
      const newPoolChange: PoolChangeHistory = {
        blockHeight: topUpHeight[n],
        poolChange: topUpSize[n],
        oldPool: poolSize,
        newPool: mintAfterTopUp[n],
        tokensBurned: 0,
        issuanceBefore: issuance,
        issuanceAfter: issuance,
      }
      poolChanges.push(newPoolChange)
      poolSize = mintAfterTopUp[n]
      addedToFiatPoolInRange += topUpSize[n]
    }
  const blockHash: Hash = await api.rpc.chain.getBlockHash(lastBlock)
  const issuance = (await api.query.balances.totalIssuance.at(blockHash) as Balance).toNumber()
  const poolEnd: PoolStatus = {
    blockHeight: lastBlock,
    issuance: issuance,
    poolSize: poolSize,
    rate: poolSize/issuance,
    totalAddedToFiatPool: poolStart.totalAddedToFiatPool+addedToFiatPoolInRange,
    totalExchangesMade: poolStart.totalExchangesMade+exchangesMadeInRange,
    totalTokensBurned: poolStart.totalTokensBurned+tokensExchangedInRange,
    totalCashedOut: poolStart.totalCashedOut+cashedOutInRange,
    addedToFiatPoolInRange: addedToFiatPoolInRange,
    exchangesMadeInRange: exchangesMadeInRange,
    tokensExchangedInRange: tokensExchangedInRange,
    cashedOutInRange: cashedOutInRange,
    poolChangesInRange: poolChanges,
  }
  return poolEnd
}

//needs moar
export async function getValidationOverview(firstBlock: number, lastBlock: number, validationRewards: ValidatorReward[], slashings: Slashing[], timestampStart: Moment, timestampEnd: Moment): Promise<OverviewValidation> {
  let firstValRewardHeight = 0
  let lastValRewardHeight = 1
  let sharedRewards = 0
  let remainingRewards = 0
  let slotStakes = 0
  let validators = 0
  let averageStakeRatios = 0
   if (validationRewards.length>0) {
    firstValRewardHeight = validationRewards[0].blockHeight-validationRewards[0].blocksInEra
    lastValRewardHeight = validationRewards[validationRewards.length-1].blockHeight
    for (let i=0; i<validationRewards.length; i++) {
      const rewardsInEra = validationRewards[i]
      sharedRewards += rewardsInEra.sharedReward
      remainingRewards += rewardsInEra.remainingReward
      validators += rewardsInEra.validators*rewardsInEra.blocksInEra
      slotStakes += rewardsInEra.slotStake*rewardsInEra.blocksInEra
      averageStakeRatios += rewardsInEra.stakeRatio*rewardsInEra.blocksInEra
    }
  }
  let slashedSum = 0
  if (slashings.length>0) {
    for (let i=0; i<slashings.length; i++) {
      slashedSum += slashings[i].slashedAmount
    }
  }
  const averageBlockTime = (timestampEnd.toNumber()-timestampStart.toNumber())*0.001/(lastBlock-firstBlock)
  const overviewValidation:OverviewValidation = {
    averageValidatorSetSize: validators/(lastValRewardHeight-firstValRewardHeight),
    averageSlotStake: slotStakes/(lastValRewardHeight-firstValRewardHeight),
    averageStakeRatio: averageStakeRatios/(lastValRewardHeight-firstValRewardHeight),
    numberOfRewardPayoutEras: validationRewards.length,
    totalRewardsMinted: sharedRewards,
    totalRemainingRewards: remainingRewards,
    numberOfSlashes: slashings.length,
    totalSlashesIncurred: slashedSum,
    averageBlockTime: averageBlockTime,
  }
  return overviewValidation
}

export async function getCouncilOverview(api: ApiPromise, firstBlockHash:Hash, councilElectedAtFirstblock: boolean, blockHeight: number, lastHash: Hash): Promise<OverviewCouncil> {
  const lastHashOfTerm: Hash = await api.rpc.chain.getBlockHash(blockHeight)
  const getCouncilStart = await api.query.council.activeCouncil.at(firstBlockHash) as Seats
  const councilMintId = (await api.query.council.councilMint.at(firstBlockHash) as Option<MintId>).unwrap()
  const councilMintInfoStart = await api.query.minting.mints.at(firstBlockHash,councilMintId) as any
  const councilMintInfoEnd = await api.query.minting.mints.at(lastHash,councilMintId) as any
  const councilMintSpent = councilMintInfoEnd[0].get("total_minted").toNumber() - councilMintInfoStart[0].get("total_minted").toNumber()
  const councilMemberAtStart = []
  let totalStakeAtStart = 0
  let ownStakeAtStart = 0
  let rewardsPaid = 0
  let rewardsMissed = 0
  for (let i=0; i<getCouncilStart.length; i++) {
    const accountIdOfMember = getCouncilStart[i].member
    const memberId = await api.query.members.memberIdsByRootAccountId(accountIdOfMember) as Vec<MemberId>
    const ownStakeOfCM = getCouncilStart[i].stake.toNumber()
    let backersStake = 0
    const rewardId = await api.query.council.rewardRelationships.at(firstBlockHash,accountIdOfMember) as RewardRelationshipId
    const rewardStart = (await api.query.recurringRewards.recipients.at(firstBlockHash,rewardId) as Tuple)[0] as Recipient
    const rewardAtStart = rewardStart.total_reward_received.toNumber()
    const rewardMissedAtStart = rewardStart.total_reward_missed.toNumber()
    const rewardEnd = (await api.query.recurringRewards.recipients.at(lastHashOfTerm,rewardId) as Tuple)[0] as Recipient
    const rewardAtEnd = rewardEnd.total_reward_received.toNumber()
    const rewardMissedAtEnd = rewardEnd.total_reward_missed.toNumber()
    for (let n=0; n<getCouncilStart[i].backers.length; n++) {
      const backers = getCouncilStart[i].backers[n].stake.toNumber()
      backersStake += backers
    }
    ownStakeAtStart += ownStakeOfCM
    totalStakeAtStart += backersStake
    councilMemberAtStart.push({
      memberId: memberId[0].toNumber(),
      accountIdOfMember: accountIdOfMember.toString(),
      ownStake: ownStakeOfCM,
      backers: getCouncilStart[i].backers.length,
      backersStake: backersStake,
      rewardReceivedInRange: rewardAtEnd-rewardAtStart,
      rewardMissed: rewardMissedAtEnd-rewardMissedAtStart
    })
    rewardsPaid += rewardAtEnd-rewardAtStart
    rewardsMissed += rewardMissedAtEnd-rewardMissedAtStart
  }

  const councilData: OverviewCouncil = {
    councilElectedAtFirstBlock: councilElectedAtFirstblock,
    council: councilMemberAtStart,
    councilOwnStake: ownStakeAtStart,
    councilTotalStake: ownStakeAtStart+totalStakeAtStart,
    councilMintSpent: councilMintSpent,
    councilSpendingFunded: councilMintSpent-rewardsPaid,
    councilRewardsPaid: rewardsPaid,
    councilRewardsMissed: rewardsMissed
  }
  return councilData
}
  
export async function getStorageOverview(api: ApiPromise, firstBlock: number, firstBlockHash: Hash, lastBlock: number, lastBlockHash: Hash, storageFees: number): Promise<OverviewStorage> {
  let estimateOfStorageSpend = 0
  const storageProvidersStart = await api.query.actors.actorAccountIds.at(firstBlockHash) as Vec<AccountId>
  const storageProvidersEnd = await api.query.actors.actorAccountIds.at(lastBlockHash) as Vec<AccountId>
  const storageStakeParameters = (await api.query.actors.parameters.at(lastBlockHash,"StorageProvider") as Option<RoleParameters>).unwrap();
  const stake = storageStakeParameters.reward.toNumber()
  const totalStake = storageProvidersEnd.length*stake
  for (let blockHeight=firstBlock; blockHeight<lastBlock; blockHeight+=600) {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockHeight)
    const storageProviders = await api.query.actors.actorAccountIds.at(blockHash) as Vec<AccountId>
    const storageParameters = (await api.query.actors.parameters.at(blockHash,"StorageProvider") as Option<RoleParameters>).unwrap();
    const reward = storageParameters.reward.toNumber()
    const rewardPeriod = storageParameters.reward_period.toNumber()
    estimateOfStorageSpend += storageProviders.length*reward*rewardPeriod/600
  }
  const storageStats: OverviewStorage = {
    storageProvidersAtStart: storageProvidersStart.length,
    storageProvidersAtEnd: storageProvidersEnd.length,
    storageStakeAtEnd: totalStake,
    feesPaid: storageFees,
    estimateOfStorageSpend: estimateOfStorageSpend,
    netStorageProviderSpend: estimateOfStorageSpend-storageFees,
  }
  return storageStats
}


export async function getCuratorOverview(api: ApiPromise, firstBlock: number, firstBlockHash:Hash, lastBlock: number, lastBlockHash: Hash): Promise<OverviewCurators> {
  let curators = 0
  let inductionHeight = 1
  let rewardsEarned = 0
  let rewardsMissed = 0
  let numberOfCuratorsAtStart = 0
  let numberOfCuratorsAtEnd = 0
  let curatorsHired = 0
  let curatorsFiredOrQuit = 0
  const curatorGroup = []
  const curatorMintId = await api.query.contentWorkingGroup.mint.at(firstBlockHash) as MintId
  const curatorMintInfoStart = await api.query.minting.mints.at(firstBlockHash,curatorMintId) as any
  const curatorMintInfoEnd = await api.query.minting.mints.at(lastBlockHash,curatorMintId) as any
  const curatorMintSpent = curatorMintInfoEnd[0].get("total_minted").toNumber() - curatorMintInfoStart[0].get("total_minted").toNumber()
  
  while (inductionHeight > 0) {
    const curatorEnd = (await api.query.contentWorkingGroup.curatorById.at(lastBlockHash, curators) as Tuple)[0] as Curator
    inductionHeight = (curatorEnd.induction as CuratorInduction).at_block.toNumber()
    if (inductionHeight == 0) {
      break
    }
    const curatorStart = (await api.query.contentWorkingGroup.curatorById.at(firstBlockHash, curators) as Tuple)[0] as Curator
    const curatorStageStart = (curatorStart.stage as CuratorRoleStage).value as Enum
    const curatorStageEnd = (curatorEnd.stage as CuratorRoleStage).value as Enum
    if (!(curatorStageStart instanceof CuratorExitSummary) || inductionHeight > firstBlock) {
      let activeCurator = true
      let rewardStartBlockHash = firstBlockHash
      let rewardEndBlockHash = lastBlockHash
      if (inductionHeight > firstBlock) {
        rewardStartBlockHash = await api.rpc.chain.getBlockHash(inductionHeight)
        curatorsHired += 1
      } else {
        numberOfCuratorsAtStart += 1
      }
      if (curatorStageEnd instanceof CuratorExitSummary) {
        const rewardEndBlock = (((curatorStageEnd.value as CuratorExitSummary).get("initiated_at_block_number") as u32).toNumber())
        rewardEndBlockHash = await api.rpc.chain.getBlockHash(rewardEndBlock)
        activeCurator = false
        curatorsFiredOrQuit += 1
      } else {
        numberOfCuratorsAtEnd += 1
      }
      const curatorApplicationId = (curatorEnd.induction as CuratorInduction).curator_application_id
      const memberId = ((await api.query.contentWorkingGroup.curatorApplicationById.at(lastBlockHash,curatorApplicationId) as Tuple)[0] as CuratorApplication).member_id

      const accountIdOfCurator = curatorEnd.role_account
      const rewardRelationship = curatorEnd.reward_relationship.unwrap()
      const rewardStart = (await api.query.recurringRewards.recipients.at(rewardStartBlockHash,rewardRelationship) as Tuple)[0] as Recipient
      const rewardAtStart = rewardStart.total_reward_received.toNumber()
      const rewardMissedAtStart = rewardStart.total_reward_missed.toNumber()
      const rewardEnd = (await api.query.recurringRewards.recipients.at(rewardEndBlockHash,rewardRelationship) as Tuple)[0] as Recipient
      const rewardAtEnd = rewardEnd.total_reward_received.toNumber()
      const rewardMissedAtEnd = rewardEnd.total_reward_missed.toNumber()

      rewardsEarned += rewardAtEnd-rewardAtStart
      rewardsMissed += rewardMissedAtEnd-rewardMissedAtStart


      
      curatorGroup.push({
        roleAccount:accountIdOfCurator.toString(),
        memberId: memberId.toNumber(),
        hiredAt: inductionHeight,
        curatorApplicationId: curatorApplicationId.toNumber(),
        active: activeCurator,
        rewardRelationship: rewardRelationship.toNumber(),
        rewardsInRange: rewardAtEnd-rewardAtStart,
        rewardsMissedInRange: rewardMissedAtEnd-rewardMissedAtStart
      })
    }
    curators ++
  }
  const curatorStats: OverviewCurators = {
    curatorGroup: curatorGroup,
    numberOfCuratorsAtStart: numberOfCuratorsAtStart,
    numberOfCuratorsAtEnd: numberOfCuratorsAtEnd,
    curatorsHired: curatorsHired,
    curatorsFiredOrQuit: curatorsFiredOrQuit,
    curatorMintSpent: curatorMintSpent,
    rewardsEarned: rewardsEarned,
    rewardsMissed: rewardsMissed,
  }
  return curatorStats
}