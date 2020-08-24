import create_api from './api';
import { ApiPromise } from '@polkadot/api';
import { PostId, ThreadId, BlockAndTime } from '@joystream/types/common'
import { Post, CategoryId, Category,
    Thread, OptionModerationAction, VecPostTextChange,
    OptionChildPositionInParentCategory, ModerationAction
} from '@joystream/types/forum';
import { Codec, CodecArg, AnyJson } from '@polkadot/types/types';
import { Text, bool as Bool, u32, Option, u64 } from '@polkadot/types';

// Note: Codec.toHex() re-encodes the value, based on how the type
// was registered. It does NOT produce the same value read from storage
// unless it was correctly defined with exact match.
// Also toJSON() behaves similarly., and special case for types that are registered Vec<u8> vs Text
// `Vec<u8>` produces a json array of numbers (byte array), `Text` produces a json string

// To produce hex string without 0x prefix:
// Buffer.from(codec_value.toU8a()).toString('hex') // without 0x prefix
// alternatively we can just hex_string.substr(2)

function serialize<T extends Codec>(value: T, encoding: string = 'json') : string | AnyJson {
    if (encoding == 'hex') {
        // convert to hex 
        return value.toHex() //.substr(2) //strips 0x prefix
    } else {
        return value.toJSON()
    }
}

main()

async function main () {
    const encoding = process.argv[2] == "--encoded" ? "hex" : "json"

    const api = await create_api();

    const categories = await get_all_categories(api);
    const posts = await get_all_posts(api);
    const threads = await get_all_threads(api);

    let forum_data = {
        categories: categories.map(category => serialize(category, encoding)),
        posts: posts.map(post => serialize(post, encoding)),
        threads: threads.map(thread => serialize(thread, encoding)),
    };

    console.log(JSON.stringify(forum_data));

    api.disconnect();
}

// Fetches a value from map directly from storage and through the query api.
// It ensures the value actually exists in the map
async function get_forum_checked_storage<T extends Codec>(api: ApiPromise, map: string, id: CodecArg) : Promise<T> {
    const key = api.query.forum[map].key(id);
    const raw_value = await api.rpc.state.getStorage(key) as unknown as Option<T>;

    if (raw_value.isNone) {
        console.error(`Error: value does not exits: ${map} key: ${id}`);
        process.exit(-1);
    } else {
        return (await api.query.forum[map](id) as T)
    }
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
            author_id: post.author_id,
            created_at: new BlockAndTime({
                // old block number on a new chain doesn't make any sense
                block: new u32(1),
                time: new u64(post.created_at.momentDate.valueOf())
            }),
        });

        posts.push(post)
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
            created_at: new BlockAndTime({
                // old block number on a new chain doesn't make any sense
                block: new u32(1),
                time: new u64(category.created_at.momentDate.valueOf())
            }),
            deleted: new Bool(category.deleted),
            archived: new Bool(category.archived),
            num_direct_subcategories: new u32(category.num_direct_subcategories),
            num_direct_unmoderated_threads: new u32(category.num_direct_unmoderated_threads),
            num_direct_moderated_threads: new u32(category.num_direct_moderated_threads),
            position_in_parent_category: new OptionChildPositionInParentCategory(category.position_in_parent_category),
            moderator_id: category.moderator_id,
        });

        categories.push(category)
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
            created_at: new BlockAndTime({
                // old block number on a new chain doesn't make any sense
                block: new u32(1),
                time: new u64(thread.created_at.momentDate.valueOf())
            }),
            author_id: thread.author_id,
        });

        threads.push(thread);
    }

    return threads;
}

function moderationActionAtBlockOne(
    action: ModerationAction | undefined) : OptionModerationAction {

    if(!action) {
        return new OptionModerationAction();
    } else {
        return new OptionModerationAction(new ModerationAction({
            moderated_at: new BlockAndTime({
                block: new u32(1),
                time: new u64(action.moderated_at.momentDate.valueOf()),
            }),
            moderator_id: action.moderator_id,
            rationale: new Text(action.rationale)
        }));
    }
}