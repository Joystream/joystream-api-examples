import create_api from './api';
import { ApiPromise } from '@polkadot/api';
import { PostId, Post, CategoryId, Category, ThreadId, Thread } from '@joystream/types/lib/forum';
// import { Codec } from '@polkadot/types/types';

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

async function get_all_posts(api: ApiPromise) {
    let first = 1;
    let next = (await api.query.forum.nextPostId() as PostId).toNumber();

    let posts = [];

    for (let id = first; id < next; id++ ) {
        let post = await api.query.forum.postById(id) as Post;
        // Assuming isEmpty is true if value doesn't exist in map!
        if (!post.isEmpty) {
            posts.push([id, post.toJSON()])
        }
    }

    return posts;
}

async function get_all_categories(api: ApiPromise) {
    let first = 1;
    let next = (await api.query.forum.nextCategoryId() as CategoryId).toNumber();

    let categories = [];

    for (let id = first; id < next; id++ ) {
        let category = await api.query.forum.categoryById(id) as Category;
        // Assuming isEmpty is true if value doesn't exist in map!
        if (!category.isEmpty) {
            categories.push([id, category.toJSON()])
        }
    }

    return categories;
}

async function get_all_threads(api: ApiPromise) {
    let first = 1;
    let next = (await api.query.forum.nextThreadId() as ThreadId).toNumber();

    let threads = [];

    for (let id = first; id < next; id++ ) {
        let thread = await api.query.forum.threadById(id) as Thread;
        // Assuming isEmpty is true if value doesn't exist in map!
        if (!thread.isEmpty) {
            threads.push([id, thread.toJSON()])
        }
    }

    return threads;
}