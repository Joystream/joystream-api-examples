import create_api from './api'
import { ApiPromise } from '@polkadot/api'
import { Codec, CodecArg } from '@polkadot/types/types'
import { Option, Tuple, u64, u32 } from '@polkadot/types'
import { SingleLinkedMapEntry } from './linkedMap'
import { Credential, BlockAndTime } from '@joystream/types/common'
import { ClassId, EntityId, Class, Entity } from '@joystream/types/versioned-store'
import { ClassPermissionsType } from '@joystream/types/versioned-store/permissions'
import { DataObject, ContentId } from '@joystream/types/media'
import { Channel, ChannelId } from '@joystream/types/content-working-group'
import { assert } from '@polkadot/util'

// Nicaea schemas
const VIDEO_CLASS_ID = 7
const MEDIA_OBJECT_CLASS_ID = 1
const VIDEO_SCHEMA_MEDIA_OBJECT_IN_CLASS_INDEX = 7
const MEDIA_OBJECT_SCHEMA_CONTENT_ID_IN_CLASS_INDEX = 0

// Entity Ids of 'Video' entities we don't wish to export
const EXCLUDED_VIDEOS = [773, 769, 765, 761, 757, 753, 751]

type ExportedEntities = Array<{entity: Entity, maintainer: Credential | undefined}>

main()

async function main () {
    const api = await create_api();

    const classes = await get_all_classes(api)

    const exportedEntities = await get_all_entities(api)

    const dataDirectory = await get_data_directory_from_entities(
        api,
        exportedEntities.map(({ entity }) => entity)
    )

    const channels = await get_channels(api)

    const versioned_store_data = {
        classes: classes.map(classAndPermissions => ({
            class: classAndPermissions.class.toHex(),
            permissions: classAndPermissions.permissions.toHex()
        })),
        entities: exportedEntities.map(
            ({ entity, maintainer }) => ({
                entity: entity.toHex(),
                maintainer: maintainer ? maintainer.toHex() : null
            })
        ),
        data_objects: dataDirectory.map(content => ({
            content_id: content.content_id.toHex(),
            data_object: content.data_object.toHex()
        })),
        channels: channels.map(channel => ({id: channel.id, channel: channel.channel.toHex()}))
    }

    api.disconnect()

    console.log(JSON.stringify(versioned_store_data))
}

// Fetches a value from map directly from storage and through the query api.
// It ensures the value actually exists in the map.
async function get_checked_map_value<T extends Codec>(api: ApiPromise, module: string, map: string, key: CodecArg) : Promise<T> {
    const storageKey = api.query[module][map].key(key);
    const raw_value = await api.rpc.state.getStorage(storageKey) as unknown as Option<T>;

    if (raw_value.isNone) {
        console.error(`Error: value does not exits: ${map} key: ${key}`);
        process.exit(-1);
    } else {
        return (await api.query[module][map](key) as T)
    }
}

async function get_all_classes(api: ApiPromise) {
    let first = 1;
    let next = (await api.query.versionedStore.nextClassId() as ClassId).toNumber();

    let values = [];

    for (let id = first; id < next; id++ ) {
        const clazz = await get_checked_map_value<Class>(api, 'versionedStore', 'classById', id) as Class;
        const permissions =  new SingleLinkedMapEntry<ClassPermissionsType, ClassId>(
            ClassPermissionsType,
            ClassId,
            await api.query.versionedStorePermissions.classPermissionsByClassId(id)
        )

        // encoding as hex assuming in import the parity codec will be identical
        // if we have issues will need to serialize as json instead
        values.push({
            class: clazz,
            permissions: permissions.value,
        })
    }

    return values
}

async function get_all_entities(api: ApiPromise) : Promise<ExportedEntities> {
    const first = 1
    const next = (await api.query.versionedStore.nextEntityId() as EntityId).toNumber()
    const entities: ExportedEntities = []

    for (let id = first; id < next; id++ ) {
        let entity = await get_checked_map_value<Entity>(api, 'versionedStore', 'entityById', id) as Entity
        
        const maintainerStorageKey = api.query.versionedStorePermissions.entityMaintainerByEntityId.key(id)
        const maintainerEntry = await api.rpc.state.getStorage(maintainerStorageKey) as unknown as Option<Tuple>
        const maintainer = maintainerEntry.isSome ? new SingleLinkedMapEntry<Credential, EntityId>(
            Credential,
            EntityId,
            maintainerEntry.unwrap()
        ).value : undefined

        if (entity.class_id.eq(VIDEO_CLASS_ID) && EXCLUDED_VIDEOS.includes(id)) {
            continue
        }

        entities.push({
            entity,
            maintainer,
        })
    }

    return entities
}

async function get_data_directory_from_entities(api: ApiPromise, entities: Entity[]) {
    const videoEntities = entities.filter(entity =>
        entity.class_id.eq(VIDEO_CLASS_ID)
            && !EXCLUDED_VIDEOS.includes(entity.id.toNumber())
    )

    const mediaObjectEntityIds = videoEntities.filter(entity =>
        entity.entity_values.length
    ).map(entity => {
        const property = entity.entity_values[VIDEO_SCHEMA_MEDIA_OBJECT_IN_CLASS_INDEX]
        assert(property && property.in_class_index.eq(VIDEO_SCHEMA_MEDIA_OBJECT_IN_CLASS_INDEX), 'Unexpected Video Schema')
        return property.value.value
    })

    const contentIds = mediaObjectEntityIds.map((entityId) => {
        const entity = entities.find((entity) => entity.id.eq(entityId))
        // Runtime protects against this invalid state..just sanity check
        if (!entity) {
            throw new Error('Referenced Entity Not Found')
        }

        if(!entity.class_id.eq(MEDIA_OBJECT_CLASS_ID)) {
            throw new Error('Referenced Entity Is Not a Media Object Entity!')
        }

        const property = entity.entity_values[MEDIA_OBJECT_SCHEMA_CONTENT_ID_IN_CLASS_INDEX]
        assert(property && property.in_class_index.eq(MEDIA_OBJECT_SCHEMA_CONTENT_ID_IN_CLASS_INDEX), 'Unexpected Media Object Schema')
        const contentId = property.value.value.toString()
        return ContentId.decode(contentId)
    })

    const dataDirectory = []

    for (let i = 0; i < contentIds.length; i++) {
        const content_id = contentIds[i]
        const data_object = await api.query.dataDirectory.dataObjectByContentId(content_id) as Option<DataObject>
        
        if (data_object.isNone) {
            console.log('Warning: Entity references a non existent contentId')
            continue
        }

        const obj = data_object.unwrap()

        dataDirectory.push({
            content_id,
            data_object: new DataObject({
                owner: obj.owner,
                added_at: new BlockAndTime({
                    block: new u32(1),
                    time: obj.added_at.time,
                }),
                type_id: obj.type_id,
                size: obj.size_in_bytes,
                liaison: new u64(0),
                liaison_judgement: obj.liaison_judgement,
                ipfs_content_id: obj.ipfs_content_id
            })
        })
    }

    return dataDirectory
}

async function get_channels(api: ApiPromise) {
    const firstChannelId = 1
    const nextChannelId = (await api.query.contentWorkingGroup.nextChannelId()) as ChannelId
    const channels = []

    for (let id = firstChannelId; nextChannelId.gtn(id); id++) {
        const channel = (await api.query.contentWorkingGroup.channelById(id)) as Channel
        channels.push({id, channel})
    }

    return channels
}