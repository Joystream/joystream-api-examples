import create_api from './api';
import { ApiPromise } from '@polkadot/api';
import { MemberId, Profile } from '@joystream/types/members';
import { Option, u32, u64 } from '@polkadot/types/';
import { BlockAndTime } from '@joystream/types/common';

main()

async function main () {
    const api = await create_api();

    const members = await get_all_members(api);

    console.log(JSON.stringify(members));

    api.disconnect();
}

async function get_all_members(api: ApiPromise) {
    const first = 0
    const next = (await api.query.members.membersCreated() as MemberId).toNumber();

    let members = [];

    for (let id = first; id < next; id++ ) {
        const profile = await api.query.members.memberProfile(id) as Option<any>;

        if (profile.isSome) {
            const p = profile.unwrap() as Profile;
            // Note: MemberId is not preserved (if on import the same first id is used and there are no gaps in the array
            // then the member will get the same member id assigned (assuming it is also numberic))
            members.push({
                member_id: id,
                root_address: p.root_account.toString(), // ss58 encoding
                controller_address: p.controller_account.toString(), // ss58 encoding
                handle: p.handle,
                avatar_uri: p.avatar_uri,
                about: p.about,
                registered_at_time: fixedTimestamp(p.registered_at_time)
            });
        }
    }

    return members;
}

function fixedTimestamp(time: u64) {
    const blockAndTime = new BlockAndTime({ block: new u32(1), time })
    return new u64(blockAndTime.momentDate.valueOf())
}