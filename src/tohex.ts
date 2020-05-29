import { CuratorApplicationId } from '@joystream/types/lib/content-working-group';
import { BTreeSet } from '@joystream/types';
let wgId:number[] = [1, 2];
let set = new BTreeSet<CuratorApplicationId>(CuratorApplicationId, wgId);
/*
Replace the integers inside the bracket in:
let wgId:number[] = [1, 2];
With the "WG ID"s of the curators you wish to hire, in ascending order.

To hire "WG ID" 18 21 and 16:
let wgId:number[] = [16, 18, 21];
*/
console.log('copy/paste the output below to hire applicant(s) with WG IDs:', wgId )
console.log(set.toHex())
