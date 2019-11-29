import create_api from './api';
import { ApiPromise } from '@polkadot/api';
import { PostId, Post, CategoryId, Category, ThreadId, Thread } from '@joystream/types/lib/forum';
import { CodecArg } from '@polkadot/types/types';
import { Codec } from '@polkadot/types/types';
import assert from 'assert';

const SERIALIZER = process.argv[2] == "--encoded" ? "toHex" : "toJSON"

// Note: Codec.toHex() re-encodes the value, based on how the type
// was registered. It does NOT produce the same value read from storage
// unless it was correctly defined with exact match.

// To produce hex string without 0x prefix:
// Buffer.from(codec_value.toU8a()).toString('hex') // without 0x prefix
// alternatively we can just hex_string.substr(2)

function serialize<T extends Codec>(value: T) : string {
    let serialized = value[SERIALIZER]();

    if (SERIALIZER == 'toHex') {
        // strip 0x prefix
        return serialized.substr(2);
    } else {
        return serialized;
    }
}

main()

async function main () {
    const api = await create_api();

    const categories = await get_all_categories(api);
    const posts = await get_all_posts(api);
    const threads = await get_all_threads(api);

    let forum_data = {
        categories,
        posts,
        threads,
    };

    console.log(JSON.stringify(forum_data));

    api.disconnect();
}

// Fetches a value from map directly from storage and through the query api.
// It ensures the type is correctly decoded and exists.
async function get_forum_checked_storage<T extends Codec>(api: ApiPromise, map: string, arg: CodecArg) : Promise<T> {
    const key = api.query.forum[map].key(arg);
    let raw_value = await api.rpc.state.getStorage(key);
    let value = await api.query.forum[map](arg) as T;

    if (raw_value.toHex() == '0x00') {
        // assert(value.isEmpty); // why isn't this assertion holding?
        console.error(`Error: value does not exits: ${map} id: ${arg}`);
        process.exit(-1);
    } else {
        const hex_value = value.toHex().substr(2); // remove 0x prefix
        assert(raw_value.toHex() == '0x01' + hex_value);
    }

    return value
}

async function get_all_posts(api: ApiPromise) {
    let first = 1;
    let next = (await api.query.forum.nextPostId() as PostId).toNumber();

    let posts = [];

    for (let id = first; id < next; id++ ) {
        let post = await get_forum_checked_storage<Post>(api, 'postById', id) as Post;
        posts.push([id, serialize(post)])
    }

    return posts;
}

async function get_all_categories(api: ApiPromise) {
    let first = 1;
    let next = (await api.query.forum.nextCategoryId() as CategoryId).toNumber();

    let categories = [];

    for (let id = first; id < next; id++ ) {
        let category = await get_forum_checked_storage<Category>(api, 'categoryById', id) as Category;
        categories.push([id, serialize(category)])
    }

    return categories;
}

async function get_all_threads(api: ApiPromise) {
    let first = 1;
    let next = (await api.query.forum.nextThreadId() as ThreadId).toNumber();

    let threads = [];

    for (let id = first; id < next; id++ ) {
        let thread =  await get_forum_checked_storage<Thread>(api, 'threadById', id) as Thread;
        threads.push([id, serialize(thread)]);
    }

    return threads;
}