#!/usr/bin/env node
/**
 * Read Chromium IndexedDB records from a LevelDB-backed store.
 *
 * Chromium stores IndexedDB data in LevelDB with a specific key encoding
 * (database ID, object store ID) and V8-serialized values wrapped in a Blink
 * envelope. This module handles the key parsing and value deserialization.
 *
 * Exports: readIndexedDb(dir) → { conversations: Map, messages: Map }
 */

import v8 from "node:v8";
import { readAllEntries } from "./leveldb-reader.mjs";

// Chromium IndexedDB key prefix types (from indexed_db_leveldb_coding.h)
// Key format: [database_id varint] [object_store_id varint] [key_type byte] [...]
// We care about object store data records (key_type = 1) and database metadata

function readIdbVarint(buf, offset) {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) break;
  }
  return { value: result, bytesRead: pos - offset };
}

/**
 * Try to deserialize a Chromium IndexedDB value.
 * Values have a Blink envelope before the V8 payload.
 * Scans for the V8 version tag (0xFF) and attempts deserialization.
 */
function tryDeserialize(rawValue) {
  if (!rawValue || rawValue.length < 4) return null;

  // Strategy: scan for 0xFF bytes (V8 version markers) and try deserializing.
  // The Blink envelope has: [varint wire_size] [0xFF blink_ver] [envelope...] [0xFF v8_ver] [V8 data]
  // We want the second 0xFF that starts valid V8 data.
  let ffCount = 0;
  for (let i = 0; i < Math.min(rawValue.length, 60); i++) {
    if (rawValue[i] === 0xff) {
      ffCount++;
      if (ffCount >= 2) {
        try {
          return v8.deserialize(rawValue.subarray(i));
        } catch {
          // keep scanning
        }
      }
    }
  }

  // Fallback: try from every 0xFF position
  for (let i = 0; i < Math.min(rawValue.length, 100); i++) {
    if (rawValue[i] === 0xff) {
      try {
        return v8.deserialize(rawValue.subarray(i));
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Parse a Chromium IndexedDB key prefix to extract database and object store IDs.
 * Returns null if the key doesn't look like an IndexedDB data record.
 */
function parseKeyPrefix(key) {
  if (key.length < 3) return null;
  const db = readIdbVarint(key, 0);
  if (db.bytesRead + 1 > key.length) return null;
  const os = readIdbVarint(key, db.bytesRead);
  return {
    databaseId: db.value,
    objectStoreId: os.value,
    remaining: key.subarray(db.bytesRead + os.bytesRead),
  };
}

/**
 * Read all IndexedDB records from a Chromium LevelDB directory and return
 * conversations and messages.
 *
 * @param {string} dir - path to the .indexeddb.leveldb directory
 * @returns {{ conversations: object[], messages: object[] }}
 */
export function readIndexedDb(dir) {
  // Use Maps so later entries (from newer .ldb files) overwrite older ones.
  // LevelDB reads files in ascending order — newer compactions have higher
  // numbers, so the last write for a given key is the most current.
  const convMap = new Map();
  const msgMap = new Map();

  for (const entry of readAllEntries(dir)) {
    const obj = tryDeserialize(entry.value);
    if (!obj || typeof obj !== "object") continue;

    if (isConversation(obj)) {
      const id = obj.id;
      if (id) convMap.set(id, obj);
      continue;
    }

    if (obj.messageMap && obj.conversationId) {
      const rcId = `${obj.conversationId}:${obj.replyChainId ?? ""}`;
      msgMap.set(rcId, obj);
    }
  }

  return {
    conversations: [...convMap.values()],
    messages: [...msgMap.values()],
  };
}

function isConversation(obj) {
  return (
    obj.id &&
    typeof obj.id === "string" &&
    (obj.type === "Chat" || obj.type === "Thread") &&
    (obj.members !== undefined ||
      obj.threadProperties !== undefined ||
      obj.lastMessageTimeUtc !== undefined)
  );
}
