import create_api from './api';

async function main () {
  const api = await create_api();

  let current_block_hash = await api.rpc.chain.getBlockHash();

  // console.log('getting code as of block hash', current_block_hash.toString())

  const substrateWasm = await api.query.substrate.code.at(current_block_hash.toString());
  //const substrateWasm = await api.rpc.state.getStorage('0x'+Buffer.from(':code').toString('hex'), blockHash);

  console.log(substrateWasm.toHex());

  api.disconnect();
}

main()
