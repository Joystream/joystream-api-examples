import { u64, Text } from '@polkadot/types'
import { Moment } from '@polkadot/types/interfaces'
import { JoyStruct } from '@joystream/types/common'
import AccountId from '@polkadot/types/primitive/Generic/AccountId'
import { MemberId } from '@joystream/types/members'
  
export type IGenesisMember = {
    member_id: MemberId
    root_account: AccountId
    controller_account: AccountId
    handle: Text
    avatar_uri: Text
    about: Text
    registered_at_time: Moment
}

export class GenesisMember extends JoyStruct<IGenesisMember> {
    constructor(value?: IGenesisMember) {
      super(
        {
          member_id: MemberId,
          root_account: AccountId,
          controller_account: AccountId,
          handle: Text,
          avatar_uri: Text,
          about: Text,
          registered_at_time: u64,
        },
        value
      )
    }
  
    get member_id(): MemberId {
        return this.get('member_id') as MemberId
    }

    get handle(): Text {
      return this.get('handle') as Text
    }
  
    get avatar_uri(): Text {
      return this.get('avatar_uri') as Text
    }
  
    get about(): Text {
      return this.get('about') as Text
    }
  
    get registered_at_time(): u64 {
      return this.get('registered_at_time') as u64
    }
  
    get root_account(): AccountId {
      return this.get('root_account') as AccountId
    }
  
    get controller_account(): AccountId {
      return this.get('controller_account') as AccountId
    }
}