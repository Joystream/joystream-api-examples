import create_api from './api';
import { Category } from '@joystream/types/lib/forum';

async function main () {
  const api = await create_api();

  // compute storage key
  const storage_key = api.query.forum.categoryById.key(1);
  // get raw storage value
  const category_codec = await api.rpc.state.getStorage(storage_key);

  console.log(category_codec.toHex())
  console.log((category_codec as Category).toHex());
  // console.log(category_codec.toJSON());// prints hex

  let category_by_query = await api.query.forum.categoryById(1);

  // 1 byte shorter. Doesn't include first byte 0x01 it is a boolean
  // to indicate if key exists
  if (!category_by_query.isEmpty) {
    console.log(category_by_query.toHex());
    console.log(category_by_query.toJSON());
  }
  api.disconnect();
}

main()
