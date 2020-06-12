import { ApiPromise } from "@polkadot/api"
import { PoolChangeHistory, PoolChange } from "./interfaces"
import { Hash, Balance } from "@polkadot/types/interfaces"

export async function getPreviousPoolChanges(api: ApiPromise, firstblock:number, topUps:PoolChange[], oldExchanges: PoolChange[]): Promise<PoolChangeHistory[]> {
  const blocks:number[] = []
  const blocksSorted:number[] = []
  const history:PoolChange[] = []
  const poolChangeHistory:PoolChangeHistory[] = []
  for (let i=0; i<topUps.length;i++) {
    if (topUps[i].blockHeight < firstblock) {
      blocks.push(topUps[i].blockHeight)
      blocksSorted.push(topUps[i].blockHeight)
      history.push({
        blockHeight: topUps[i].blockHeight,
        amount: topUps[i].amount,
        change: topUps[i].change
      })
    }
  }
  for (let i=0; i<oldExchanges.length;i++) {
    if (oldExchanges[i].blockHeight < firstblock) {
      blocks.push(oldExchanges[i].blockHeight)
      blocksSorted.push(oldExchanges[i].blockHeight)
      history.push({
        blockHeight: oldExchanges[i].blockHeight,
        amount: -oldExchanges[i].amount
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
      oldPool += poolChangeHistory[i-1]?.newPool ?? 0;
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
      poolChangeHistory.push(poolChanged)
    }
    return poolChangeHistory
  }





  
  
