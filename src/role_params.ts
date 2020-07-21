import { RoleParameters } from '@joystream/types/roles';

let params = new RoleParameters(
    {"min_stake":3000,"min_actors":5,"max_actors":10,"reward":10,"reward_period":600,"bonding_period":600,"unbonding_period":600,"min_service_period":600,"startup_grace_period":600,"entry_request_fee":50}
);

console.log(params.toHex())