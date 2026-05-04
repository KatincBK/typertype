import { Plugin } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import {
  copyImageToAssets,
  pickImage,
  writeImageBytes,
} from "@/lib/imageIO";
import { logger } from "@/lib/logger";

// FAZ 11 — Three entry points create images in the doc:
//   1. handlePasteImage:  Ctrl+V with an image on the clipboard.
//   2. listenForImageDrop: a `tauri://drag-drop` event with image paths.
//   3. insertImageFromDialog: the Ctrl+Shift+I shortcut → file picker.
// Each one writes the bytes to the assets folder via the Rust commands
// in src/lib/imageIO and then dispatches a single replaceSelectionWith
// to drop the resulting image node into the doc.

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;

function dispatchImageNode(
  view: EditorView,
  src: string,
  pos: number | null,
) {
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return;
  const node = imageType.create({ src, alt: "", title: null });
  let tr = view.state.tr;
  if (pos === null) {
    tr = tr.replaceSelectionWith(node);
  } else {
    tr = tr.insert(pos, node);
  }
  view.dispatch(tr.scrollIntoView());
}

export function buildImagePastePlugin(
  _schema: Schema,
  getDocPath: () => string | null,
): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        let imageItem: DataTransferItem | null = null;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.kind === "file" && it.type.startsWith("image/")) {
            imageItem = it;
            break;
          }
        }
        if (!imageItem) return false;
        const blob = imageItem.getAsFile();
        if (!blob) return false;

        // We've claimed this paste — schedule the async write/insert
        // separately so handlePaste can return synchronously.
        void (async () => {
          try {
            const buf = await blob.arrayBuffer();
            const ext =
              blob.type.split("/")[1]?.split(";")[0]?.toLowerCase() ?? "png";
            const path = await writeImageBytes(
              new Uint8Array(buf),
              ext,
              getDocPath(),
            );
            if (!path) return;
            dispatchImageNode(view, path, null);
          } catch (err) {
            logger.error("paste image failed", err);
          }
        })();
        return true;
      },
    },
  });
}

export async function insertImageFromDialog(
  view: EditorView,
  getDocPath: () => string | null,
) {
  const source = await pickImage();
  if (!source) return;
  const target = await copyImageToAssets(source, getDocPath());
  if (!target) return;
  dispatchImageNode(view, target, null);
}

export async function insertImageFromPath(
  view: EditorView,
  sourcePath: string,
  insertPos: number | null,
  getDocPath: () => string | null,
) {
  if (!IMAGE_EXT_RE.test(sourcePath)) return;
  const target = await copyImageToAssets(sourcePath, getDocPath());
  if (!target) return;
  dispatchImageNode(view, target, insertPos);
}
