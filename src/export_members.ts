import create_api from './api';
import { ApiPromise } from '@polkadot/api';
import { MemberId, Profile } from '@joystream/types/lib/members';
import { Option } from '@polkadot/types/';

main()

async function main () {
    const api = await create_api();

    const members = await get_all_members(api);

    console.log(JSON.stringify(members));

    api.disconnect();
}

async function get_all_members(api: ApiPromise) {
    const first = (await api.query.membership.firstMemberId() as MemberId).toNumber();
    const next = (await api.query.membership.nextMemberId() as MemberId).toNumber();

    let members = [];

    for (let id = first; id < next; id++ ) {
        const profile = await api.query.membership.memberProfile(id) as Option<any>;

        if (profile.isSome) {
            const p = profile.unwrap() as Profile;
            const account_id = await api.query.membership.accountIdByMemberId(id);
            // Note: MemberId is not preserved (if on import the same first id is used and there are no gaps in the array
            // then the member will get the same member id assigned (assuming it is also numberic))
            members.push({
                address: account_id.toString(), // ss58 encoding
                handle: p.handle,
                avatar_uri: p.avatar_uri,
                about: p.about,
            });
        }
    }

    return members;
}
