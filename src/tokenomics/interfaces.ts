// Tokenomics Specific
export interface Voters {
  voter: number,
  vote: string,
  blockNumber: number
}
export interface VoteStatus {
  abstensions: number,
  approvals: number,
  rejections: number,
  slashes: number
}
export interface Exchange {
  sender: string,
  recipient: string,
  amount: number,
  blockHeight: number
}
export interface ValidatorReward {
  sharedReward: number,
  remainingReward: number,
  slotStake: number,
  validators: number,
  issuance: number,
  stakeRatio: number,
  blockHeight: number,
  session: number,
  era: number
};

export interface Slashing {
  validatorStash: string,
  slashedAmount: number,
  blockHeight: number,
  session: number,
  era: number
};


export interface ActiveProposal {
  id: number,
  type: string,
  createdBy: number,
  created: number,
  voters: Voters[],
  status: string,
  finalizedAt?: number,
  result?: string,
  votingResults?: VoteStatus,
  executionStatus?: string,
  executedAt?: number,
}
export interface StorageProvider {
  memberId: number,
  memberAccount: string,
  actorAccount: string,
  joinedAt: number,
  memberAccountBalanceAtStart: number,
  memberAccountBalanceAtEnd: number,
  memberAccountBalanceDiff: number,
  roleAccountBalanceAtStart: number,
  roleAccountBalanceAtEnd: number
  roleAccountBalanceDiff: number,
}
export interface StorageProviders {
  storageProvidersThroughout: StorageProvider[],
  storageProvidersNotThroughout: string[]
  storageProvidersAtStart: string[],
  storageProvidersAtEnd: string[]
}

export interface Overview {
  startBlock: number,
  endBlock: number,
  blockRange: number
  startIssuance: number,
  endIssuance: number,
  totalExchangeBurn: number,
  totalValueExchanged: number,
  councilMintSpent: number,
  curatorMintSpent: number,
  validatorRewardsPaid: number,
  validatorBurnedBySlash: number,
  estimateOfStorageSpend: number,
  storageSignupFeesPaid: number,
  tokensBurnedFromExtrinsics: number,
  proposalsMade: number,
  forumPostsMade: number,
  contentFilesAdded: number,
  entitiesCreated: number,
  poolAtStart: number,
  poolAtEnd:  number,
  rateAtStart: number,
  rateAtEnd: number,
}

// General Parsing of Events

export interface DataInEvent {

}

export interface PoolChange {
  blockHeight: number,
  amount: number,
  change?: number,
}

export interface PoolChangeHistory {
  blockHeight: number,
  poolChange: number,
  oldPool: number,
  newPool: number,
  tokensBurned: number,
  issuanceBefore: number,
  issuanceAfter: number
}