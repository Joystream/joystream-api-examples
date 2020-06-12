// @ts-check

import { VoteKind } from '@joystream/types';
import { Hash, EraIndex, SessionIndex, AccountId, Balance, Proposal, BlockNumber } from "@polkadot/types/interfaces";
import { MemberId } from '@joystream/types/lib/members';
import { ProposalId, ProposalDetails, ProposalStatus, Finalized, Approved, ProposalDecisionStatus } from '@joystream/types/lib/proposals';
import { PoolChangeHistory, ValidatorReward, Slashing, Voters, ActiveProposal } from './interfaces';
import { EventData } from '@polkadot/types/primitive/Generic/Event';
import { ApiPromise } from '@polkadot/api';
//import Event from '@polkadot/types/primitive/Generic/Event';

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

export async function getStakingRewards(api: ApiPromise, event: EventData, oldHash:Hash, blockHeight: number, era: EraIndex, session: SessionIndex): Promise<ValidatorReward> {
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
    createdBy: (proposalData.get("proposerId") as MemberId).toNumber(),
    created: (proposalData.get("createdAt") as BlockNumber).toNumber(),
    voters: [],
    status: proposalStatus.type
  };
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

export async function getProposalStatusUpdated(event: EventData, proposals: any[], proposalIds: number[], blockHeight: number): Promise<any[]> {
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
      }
    }
  }
  return proposals
}
/*
export async function getEventsInBlock(event: Event): Promise<any[]> {
  const eventSection = event.section
  const eventMethod = event.method
  console.log("event.section:",eventSection)
  console.log("event.method:",eventMethod)
  console.log("event.data:",event.data.toJson())
  for (let i=0; i<event.data.length; i++ ) {
    console.log(`eventData: ${i}`)
  }
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
      }
    }
  }
  return proposals
}
*/