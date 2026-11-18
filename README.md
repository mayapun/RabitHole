# RabbitHole

RabbitHole is a Chrome extension for saving research pages and personal notes to a searchable local library, then connecting saved pages in a research graph.

## Install in Chrome

Run these commands from the project root using Node.js 24 and npm.

```sh
cd apps/extension
npm ci
npm run build
```

1. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select `apps/extension/dist`.
3. Open a regular web page and select **RabbitHole** from Chrome’s Extensions menu. Pin it there for one-click access.
4. Add a note if you like, then click **Save page**. Use **Library** to search titles, URLs, and notes, reopen pages, or delete bookmarks.
5. Save at least two related pages, then open **Graph**. Choose a starting page under **Explore from**. Follow a dotted suggestion to explore it, or click **Keep** to save that connection. You can also connect pages yourself or select **Open full view** to explore in a Chrome tab.

## Develop and verify

Run the following in `apps/extension`.

```sh
npm test
npm run lint
npm run build
```

Rebuild after code or manifest changes and click **Reload** on the RabbitHole card at `chrome://extensions`. Open the popup again on a regular web page to exercise the Chrome APIs. `npm run dev` serves the UI in a regular browser tab, where Chrome’s extension APIs are unavailable.

## Architecture and privacy

- `src/components` contains the Capture, Library, and Graph views. `src/hooks/useBookmarks.ts` loads bookmarks and connections and refreshes them when the stored data changes.
- `src/services/bookmarks.ts` manages bookmarks and two-way connections in `chrome.storage.local`. The Chrome adapter supplies an origin-scoped Web Lock to serialize writes across extension windows. Deleting a bookmark removes its connections in the same write. Existing saved pages are available in the graph as soon as the extension reloads.
- The graph centers on one page and shows its direct connections alongside up to four suggestions based on words shared across saved titles and notes. Suggestions are computed locally and become stored connections when you click **Keep**. The matcher uses shared words, so it can miss related pages that use different terminology.
- URLs are normalized before duplicate checks. The comparison preserves query parameters, their order, and nonempty fragments so links to distinct destinations can be saved separately. Capture supports HTTP and HTTPS pages.
- The Manifest V3 extension uses `activeTab` to read the current page’s title and URL when you invoke the popup and `storage` to keep explicitly saved bookmarks in the current Chrome profile. RabbitHole has no browsing-history collection, background tracking, or data transmission. Removing the extension clears its local library.
