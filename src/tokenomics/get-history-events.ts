// @ts-check

import { VoteKind } from '@joystream/types';
import { Hash, EraIndex, SessionIndex, AccountId, Balance, Proposal, BlockNumber, EventRecord } from "@polkadot/types/interfaces";
import { MemberId, Role } from '@joystream/types/lib/members';
import { ProposalId, ProposalDetails, ProposalStatus, Finalized, Approved, ProposalDecisionStatus, SpendingParams, Active, ActiveStake } from '@joystream/types/lib/proposals';
import { PoolChangeHistory, ValidatorReward, Slashing, Voters, ActiveProposal } from './interfaces';
import { EventData } from '@polkadot/types/primitive/Generic/Event';
import { ApiPromise } from '@polkadot/api';
import { RoleParameters } from '@joystream/types/lib/roles';
import { Option, Tuple } from '@polkadot/types/codec';
import { Vec } from '@polkadot/types/codec';
import { StakeId, Stake, Staked } from '@joystream/types/lib/stake';

export async function getCashouts(api: ApiPromise, event: EventData, poolStart: PoolChangeHistory, oldHash:Hash, blockHeight: number): Promise<PoolChangeHistory> {
  const amountJOY = event[2] as Balance;
  const oldIssuance = await api.query.balances.totalIssuance.at(oldHash) as Balance;
  const poolChange = -amountJOY.toNumber()*poolStart.oldPool/oldIssuance.toNumber();
  const exchange: PoolChangeHistory = {
    blockHeight: blockHeight,
    poolChange: poolChange,
    oldPool: poolStart.oldPool,
    newPool: poolStart.oldPool+poolChange,
    tokensBurned: amountJOY.toNumber(),
    issuanceBefore: oldIssuance.toNumber(),
    issuanceAfter: oldIssuance.toNumber()-amountJOY.toNumber()
  }
  return exchange
}
export async function getLastStakingRewardHeight(api: ApiPromise, firstBlock: number): Promise<number> {
  let lastRewardHeight = firstBlock-600
  getFirstHeight:
  for (let blockHeight=firstBlock; blockHeight>firstBlock-600; blockHeight--) {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockHeight)
    const events = await api.query.system.events.at(blockHash) as Vec<EventRecord>;
    for (let { event } of events) {
      if (event.section === 'staking' && event.method === 'Reward') {
        lastRewardHeight = blockHeight
        break getFirstHeight
      }
    }
  };
  return lastRewardHeight
}

export async function getStakingRewards(api: ApiPromise, event: EventData, oldHash:Hash, blockHeight: number, lastRewardHeight: number, era: EraIndex, session: SessionIndex): Promise<ValidatorReward> {
  const sharedReward = event[0] as Balance;
  const remainingReward = event[1] as Balance;
  const oldSlotStake = await api.query.staking.slotStake.at(oldHash) as Balance;
  const oldIssuance = await api.query.balances.totalIssuance.at(oldHash) as Balance;
  const oldValidatorInfo = await api.query.staking.currentElected.at(oldHash) as AccountId;
  const valReward: ValidatorReward = {
    sharedReward: sharedReward.toNumber(),
    remainingReward: remainingReward.toNumber(),
    slotStake: oldSlotStake.toNumber(),
    validators: oldValidatorInfo.length,
    issuance: oldIssuance.toNumber(),
    stakeRatio: (oldSlotStake.toNumber()*oldValidatorInfo.length)/oldIssuance.toNumber(),
    blockHeight: blockHeight,
    blocksInEra: blockHeight-lastRewardHeight,
    session: session.toNumber(),
    era: era.toNumber()
  };
  return valReward
}

export async function getSlash(event: EventData, blockHeight: number, era: EraIndex, session: SessionIndex): Promise<Slashing> {
  const validatorStash = event[0] as AccountId;
  const slashedAmount = event[1] as Balance;
  const slash: Slashing = {
    validatorStash: validatorStash.toString(),
    slashedAmount: slashedAmount.toNumber(),
    blockHeight: blockHeight,
    session: session.toNumber(),
    era: era.toNumber()
  };
  return slash
}

export async function getProposalCreated(api: ApiPromise, proposalId: ProposalId, blockHash:Hash): Promise<ActiveProposal> {
  const proposalData = await api.query.proposalsEngine.proposals.at(blockHash,proposalId) as Proposal;
  const proposalStatus = proposalData.get("status") as ProposalStatus
  const proposalsDetails = await api.query.proposalsCodex.proposalDetailsByProposalId.at(blockHash,proposalId) as ProposalDetails
  const activeProposal: ActiveProposal = {
    id: proposalId.toNumber(),
    type: proposalsDetails.type.toString(),
    title: proposalData.get("title")?.toString(),
    createdBy: (proposalData.get("proposerId") as MemberId).toNumber(),
    created: (proposalData.get("createdAt") as BlockNumber).toNumber(),
    statusAtStart: proposalStatus.type,
    voters: [],
    status: proposalStatus.type,
  };
  if (proposalsDetails.value instanceof SpendingParams) {
    activeProposal.spending = (proposalsDetails.value[0] as Balance).toNumber()
  }
  if (proposalStatus.value instanceof Active) {
    const stakeId = ((proposalStatus.value.value) as ActiveStake).get("stakeId") as StakeId
    const stakeData = (await api.query.stake.stakes.at(blockHash,stakeId) as Tuple)[0] as Stake
    activeProposal.stakeId = stakeId.toNumber()
    activeProposal.stake = (stakeData.staking_status.value as Staked).staked_amount.toNumber()
  }
  return activeProposal
}

export async function getVote(event: EventData, blockHeight: number): Promise<Voters> {
  const memberId = event[0] as MemberId;
  const voteKind = event[2] as VoteKind;
  const vote: Voters = {
    voter: memberId.toNumber(),
    vote: voteKind.toString(),
    blockNumber: blockHeight
  };
  return vote
}

export async function getProposalStatusUpdated(event: EventData, proposals: ActiveProposal[], proposalIds: number[], blockHeight: number): Promise<ActiveProposal[]> {
  const proposalId = event[0] as ProposalId
  const proposalStatus = event[1] as ProposalStatus
  if (proposalIds.includes(proposalId.toNumber())) {
    const index = proposalIds.indexOf(proposalId.toNumber())
    if (proposalStatus.value instanceof Finalized) {
      proposals[index].status = proposalStatus.type
      proposals[index].finalizedAt = blockHeight
      const decision = proposalStatus.value.get("proposalStatus") as ProposalDecisionStatus
      proposals[index].result = decision.type
      if (decision.value instanceof Approved) {
        proposals[index].executionStatus = decision.value.type
        if (decision.value.toString()!=="PendingExecution") {
          proposals[index].executedAt = blockHeight
        }
      } else {
        if (decision.type === "Canceled" ||decision.type === "Cancelled") {
          proposals[index].feePaid = 10000
        } else if (decision.type === "Rejected" || decision.type === "Expired") {
          proposals[index].feePaid = 5000
        } else if (decision.type === "Slashed") {
          if (proposals[index].stake) {
            proposals[index].feePaid = proposals[index].stake
          }
        }
      }
    }
  }
  return proposals
}

export async function getActorJoined(api: ApiPromise, event: EventData, blockHash: Hash): Promise<number> {
  const role = event[1] as Role
  let fee = 0
  if (role.toString()==="StorageProvider") {
    const storageParameters = (await api.query.actors.parameters.at(blockHash,"StorageProvider") as Option<RoleParameters>).unwrap();
    fee += storageParameters.entry_request_fee.toNumber()
  }
  return fee
}