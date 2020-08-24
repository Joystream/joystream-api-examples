import { Tuple } from '@polkadot/types';
import { Codec, Constructor } from '@polkadot/types/types';
import Linkage from '@polkadot/types/codec/Linkage';

export class SingleLinkedMapEntry<T extends Codec, K extends Codec> extends Tuple {
    constructor (ValueType: Constructor<T>, KeyType: Constructor<K>, value?: any) {
        super({
            value: ValueType,
            linkage: Linkage.withKey(KeyType)
        }, value);
    }

    get value (): T {
        return this[0] as unknown as T;
    }

    get linkage (): Linkage<K> {
        return this[1] as unknown as Linkage<K>;
    }
}