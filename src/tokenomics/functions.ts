import { ApiPromise } from "@polkadot/api"
import { PoolChangeHistory, PoolChange } from "./interfaces"
import { Hash, Balance } from "@polkadot/types/interfaces"

export async function getPoolChanges(api: ApiPromise, firstblock:number, lastBlock: number, topUps:PoolChange[], allExchanges: PoolChange[]): Promise<PoolChangeHistory[]> {
  const blocks:number[] = []
  const blocksSorted:number[] = []
  const history:PoolChange[] = []
  const poolChangeAll:PoolChangeHistory[] = []
  const poolChangeInRange:PoolChangeHistory[] = []
  const poolChangeNotInRange:PoolChangeHistory[] = []
  for (let i=0; i<topUps.length;i++) {
    if (topUps[i].blockHeight < lastBlock) {
      blocks.push(topUps[i].blockHeight)
      blocksSorted.push(topUps[i].blockHeight)
      history.push({
        blockHeight: topUps[i].blockHeight,
        amount: topUps[i].amount,
        change: topUps[i].change
      })
    }
  }
  for (let i=0; i<allExchanges.length;i++) {
    if (allExchanges[i].blockHeight < lastBlock) {
      blocks.push(allExchanges[i].blockHeight)
      blocksSorted.push(allExchanges[i].blockHeight)
      history.push({
        blockHeight: allExchanges[i].blockHeight,
        amount: -allExchanges[i].amount
      })
    }
  }

  blocksSorted.sort((a,b) => a-b)
  const historySorted:PoolChange[] = []

  for (let i=0; i<blocksSorted.length;i++) {
    const indexInBlocks = blocks.indexOf(blocksSorted[i])
    historySorted.push(history[indexInBlocks])
  }

  for (let i=0; i<historySorted.length;i++) {
      const hash: Hash = await api.rpc.chain.getBlockHash(historySorted[i].blockHeight)
      const oldHash: Hash = await api.rpc.chain.getBlockHash(historySorted[i].blockHeight-1)
      const issuanceAtExchange = await api.query.balances.totalIssuance.at(hash) as Balance
      const oldIssuance = await api.query.balances.totalIssuance.at(oldHash) as Balance
      let oldPool = 0;
      oldPool += poolChangeAll[i-1]?.newPool ?? 0;
      let tokensBurned = historySorted[i].amount
      let poolChange = 0
      poolChange += historySorted[i].change ?? 0
      poolChange += tokensBurned*oldPool/oldIssuance.toNumber();
      const poolChanged: PoolChangeHistory = {
        blockHeight: historySorted[i].blockHeight,
        poolChange: poolChange,
        oldPool: oldPool,
        newPool: oldPool+poolChange,
        tokensBurned: tokensBurned,
        issuanceBefore: oldIssuance.toNumber(),
        issuanceAfter: issuanceAtExchange.toNumber()
      }
      poolChangeAll.push(poolChanged)
      if (poolChanged.blockHeight > firstblock) {
        poolChangeInRange.push(poolChanged)
      } else {
        poolChangeNotInRange.push(poolChanged)
      }
    }
    const fistBlockHash: Hash = await api.rpc.chain.getBlockHash(firstblock)
    const startIssuance = await api.query.balances.totalIssuance.at(fistBlockHash) as Balance
    const poolStart = {
      blockHeight: firstblock,
      poolChange: 0,
      oldPool: poolChangeNotInRange[poolChangeNotInRange.length-1].newPool,
      newPool: poolChangeNotInRange[poolChangeNotInRange.length-1].newPool,
      tokensBurned: 0,
      issuanceBefore: startIssuance.toNumber(),
      issuanceAfter: startIssuance.toNumber()
    }
    poolChangeInRange.unshift(poolStart)
    return poolChangeInRange
  }
