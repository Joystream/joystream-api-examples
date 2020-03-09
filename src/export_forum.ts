import create_api from './api';
import { ApiPromise } from '@polkadot/api';
import { PostId, Post, CategoryId, Category, ThreadId,
    Thread, BlockchainTimestamp, OptionModerationAction, VecPostTextChange,
    OptionChildPositionInParentCategory, ModerationAction
} from '@joystream/types/lib/forum';
import { Codec, CodecArg } from '@polkadot/types/types';
import { BlockNumber, Text, AccountId, Bool, u32 } from '@polkadot/types';
import assert from 'assert';

const SERIALIZER = process.argv[2] == "--encoded" ? "toHex" : "toJSON"

// Note: Codec.toHex() re-encodes the value, based on how the type
// was registered. It does NOT produce the same value read from storage
// unless it was correctly defined with exact match.
// Also toJSON() behaves similarly., and special case for types that are registered Vec<u8> vs Text
// `Vec<u8>` produces a json array of numbers (byte array), `Text` produces a json string

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

        // Transformation to a value that makes sense in a new chain.
        post = new Post({
            id: post.id,
            thread_id: post.thread_id,
            nr_in_thread: post.nr_in_thread,
            current_text: new Text(post.current_text),
            moderation: moderationActionAtBlockOne(post.moderation),
            // No reason to preserve change history
            text_change_history: new VecPostTextChange(),
            author_id: new AccountId(post.author_id),
            created_at: new BlockchainTimestamp({
                // old block number on a new chain doesn't make any sense
                block: new BlockNumber(1),
                time: post.created_at.time
            }),
        });

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

        category = new Category({
            id: new CategoryId(category.id),
            title: new Text(category.title),
            description: new Text(category.description),
            created_at: new BlockchainTimestamp({
                // old block number on a new chain doesn't make any sense
                block: new BlockNumber(1),
                time: category.created_at.time
            }),
            deleted: new Bool(category.deleted),
            archived: new Bool(category.archived),
            num_direct_subcategories: new u32(category.num_direct_subcategories),
            num_direct_unmoderated_threads: new u32(category.num_direct_unmoderated_threads),
            num_direct_moderated_threads: new u32(category.num_direct_moderated_threads),
            position_in_parent_category: new OptionChildPositionInParentCategory(category.position_in_parent_category),
            moderator_id: new AccountId(category.moderator_id),
        });

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

        thread = new Thread({
            id: new ThreadId(thread.id),
            title: new Text(thread.title),
            category_id: new CategoryId(thread.category_id),
            nr_in_category: new u32(thread.nr_in_category),
            moderation: moderationActionAtBlockOne(thread.moderation),
            num_unmoderated_posts: new u32(thread.num_unmoderated_posts),
            num_moderated_posts: new u32(thread.num_moderated_posts),
            created_at: new BlockchainTimestamp({
                // old block number on a new chain doesn't make any sense
                block: new BlockNumber(1),
                time: thread.created_at.time
            }),
            author_id: new AccountId(thread.author_id),
        });

        threads.push([id, serialize(thread)]);
    }

    return threads;
}

function moderationActionAtBlockOne(
    action: ModerationAction | undefined) : OptionModerationAction {

    if(!action) {
        return new OptionModerationAction();
    } else {
        return new OptionModerationAction(new ModerationAction({
            moderated_at: new BlockchainTimestamp({
                block: new BlockNumber(1),
                time: action.moderated_at.time,
            }),
            moderator_id: new AccountId(action.moderator_id),
            rationale: new Text(action.rationale)
        }));
    }
}