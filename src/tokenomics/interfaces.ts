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

export interface ValidatorReward {
  sharedReward: number,
  remainingReward: number,
  slotStake: number,
  validators: number,
  issuance: number,
  stakeRatio: number,
  blockHeight: number,
  blocksInEra: number 
  session: number,
  era: number,
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
  title?: string,
  createdBy: number,
  stakeId?: number,
  stake?: number,
  spending?: number,
  created: number,
  statusAtStart: string,
  voters: Voters[],
  status: string,
  finalizedAt?: number,
  result?: string,
  feePaid?: number,
  votingResults?: VoteStatus,
  executionStatus?: string,
  executedAt?: number,
  execution?: any[]
}

export interface OverviewGeneral {
  newCategories: number,
  newPosts: number,
  newChannels: number,
  newEntities: number,
  newMembers: number,
}

export interface OverviewProposal {
  activeProposalsAtStart: number,
  activeProposalsAtEnd: number,
  fundingCosts: number,
  feesPaid: number,
  slashAmount: number,
  proposalsAddedInRange: number,
  proposalsFinalizedInRange: number,
}

export interface OverviewRange {
  startBlock: number,
  endBlock: number,
  blockRange: number,
  timestampStart: Date,
  timestampEnd: Date,
  totalBalanceTransfers: number,
}

export interface OverviewCouncil {
  councilElectedAtFirstBlock: boolean,
  council: any[],
  councilOwnStake: number,
  councilTotalStake: number,
  councilMintSpent: number,
  councilSpendingFunded: number,
  councilRewardsPaid: number,
  councilRewardsMissed: number,
}

export interface OverviewValidation {
  averageValidatorSetSize: number,
  averageSlotStake: number,
  averageStakeRatio: number,
  numberOfRewardPayoutEras: number,
  totalRewardsMinted: number,
  totalRemainingRewards: number,
  numberOfSlashes: number,
  totalSlashesIncurred: number,
  averageBlockTime: number,
}

export interface OverviewStorage {
  storageProvidersAtStart: number,
  storageProvidersAtEnd: number,
  storageStakeAtEnd: number,
  feesPaid: number,
  estimateOfStorageSpend: number,
  netStorageProviderSpend: number,
}

export interface OverviewCurators {
  curatorGroup: any[],
  numberOfCuratorsAtStart: number,
  numberOfCuratorsAtEnd: number,
  curatorsHired: number,
  curatorsFiredOrQuit: number,
  curatorMintSpent: number,
  rewardsEarned: number,
  rewardsMissed: number,
}

export interface OverviewTokenomics {
  startIssuance: number,
  endIssuance: number,
  issuanceDiff: number,
  tokensExchangedInRange: number,
  totalValueExchanged: number,
  poolAtStart: number,
  poolAtEnd:  number,
  rateAtStart: number,
  rateAtEnd: number,
  actualExchangeBurnsInRange: number,
  extrinsicFeeBurn: number,
  extrinsicTipBurn: number,
  membershipFees: number,
  netValidatorSpend: number,
  netStorageProviderSpend: number,
  netCouncilSpend: number,
  netProposalSpend: number,
  netCuratorSpend: number,
  totalRewardsMinted: number,
  totalFeesSlashesBurns: number,
  expectedIssuanceDiffNoExchanges: number,
  actualIssuanceDiffNoExchanges: number,
}


export interface PoolStatus {
  blockHeight: number,
  issuance: number,
  poolSize: number,
  rate: number,
  totalAddedToFiatPool: number,
  totalExchangesMade: number,
  totalTokensBurned: number,
  totalCashedOut: number,
  addedToFiatPoolInRange: number,
  exchangesMadeInRange: number,
  tokensExchangedInRange: number,
  cashedOutInRange: number,
  poolChangesInRange: PoolChangeHistory[],
}

export interface PoolTopup {
  blockHeight: number,
  amount: number,
  mintBefore: number,
  change: number,
  mintAfter: number,
}

export interface ExchangeInfo {
  amount: number,
  tokensRecievedAtBlock: number,
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