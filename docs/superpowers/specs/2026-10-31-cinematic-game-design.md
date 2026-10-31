# 百世问鼎 · 游戏内山海墨金界面

## Intent

The user requests that the interface after entering the game match the existing cinematic homepage. Extend its original mountain artwork, blue-black ink surfaces, warm ivory text, muted gold accents and restrained atmosphere through character creation, live/offline play, settings, saved journeys, character/history drawers and endings.

## Implementation decisions

Reuse the homepage artwork and scene renderer. A persistent scene outside `#app` remains mounted while the game rerenders; it is disposed and emptied on returning home. The scene stays behind an opaque-enough reading surface, with no motion on prose or choice nodes. Shared CSS image variables embed each image once in the offline release.

A narrow reading column sits within an ink panel on the left on wide screens, leaving the landscape visible. Small screens use the available width, safe-area padding and a compact sticky identity bar. Controls retain clear keyboard focus, touch targets and their existing labels and behavior.

Add `cinematic` as the default reading theme. Existing explicit `system`, `light`, `dark` and large-text preferences remain valid. Optional light reading uses the same gold detail and mountain surroundings with a parchment surface; it is not overwritten in storage.

Approaches considered: palette-only replacement would leave creation/dialogs and the surrounding scene disconnected; remounting full effects inside every game render would restart animation during live updates. The selected persistent shared scene gives visual continuity without changing story or save handling.

## Constraints

- No engine, provider, price/budget, prompt, save format, navigation or story-content changes.
- Preserve live paragraph/choice DOM identity and equal draft/final typography, spacing and border styles.
- Preserve native dialog focus and dismissal, character/history drawers, all existing selectors and keyboard choices.
- Dynamic controls respect stored pause, reduced motion and background-tab suspension. Sound remains opt-in.
- No new runtime dependency, external image/font request or duplicate embedded artwork. Offline HTML stays below 3,000,000 bytes.
- Do not merge or overwrite concurrent engine/RAG work. Refresh main before publishing, retaining any intervening changes.

## Acceptance

Inspect 320px/390px mobile and 1440px desktop creation, live story, custom action, drawer, settings, saved journeys and ending surfaces. Verify scene lifetime, read-only menu navigation and pause behavior. Run existing streaming/native-browser regressions and complete release validation. Publish the exact reviewed commit through GitHub and the existing Cloudflare production process, preserving live bindings/configuration; check the custom domain's actual version and story capabilities.
