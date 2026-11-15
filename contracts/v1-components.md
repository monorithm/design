# The components of version 1

Version 1 of the packages has a core set of 20 components. React and Flutter get them first. React Native and Compose get the same 20 components in a 1.x release. Flutter is the reference stack of the phone.

This list is a draft for the approval of the user. When the user approves it, each component gets a contract in this folder, in the build order below.

## How the 20 were selected

A component is in version 1 if all three rules apply:

1. A consumer uses it: the language site, the web apps of the products, or the Monorithm app on phones.
2. It is a base that other components or screens use.
3. The language gives its rules on a component page.

## The size classes

| Class | Meaning |
| --- | --- |
| S | One control with one state model |
| M | A keyboard model, many parts, or an overlay |
| L | Gestures, physics, or a scroll handoff |

## The list

| No. | Component | Class | Language page | Moments | Why in version 1 |
| --- | --- | --- | --- | --- | --- |
| 1 | Button | S | Buttons and toggles | `press` | The base action. Six variants and three sizes |
| 2 | Icon button | S | Buttons and toggles | `press` | The headers, the toolbars, and the cards use it |
| 3 | Segmented control | M | Buttons and toggles | `select` | Filters and views. The pill moves with `spring-control` |
| 4 | Chip | S | Buttons and toggles | `select` | Filters and quick choices on phones |
| 5 | Text field | M | Forms | `success`, `warning`, `error` | The base input: the label, the help text, the error, and the field types |
| 6 | Checkbox | S | Forms | `toggle` | Independent options. The mixed state of a parent checkbox |
| 7 | Radio group | S | Forms | `select` | One option from a list. Option cards are a variant |
| 8 | Switch | S | Forms | `toggle` | A change that applies immediately. The first component to build |
| 9 | Select | M | Forms | `open`, `select`, `close` | A short list of options. Phones use the picker of the system |
| 10 | Code entry | M | Forms | `success`, `error` | The sign-in with a one-time code |
| 11 | Alert and banner | S | Data display, and Accordion, banners, and notifications | `success`, `warning`, `error` | The status of a page or a form |
| 12 | Toast | M | Overlays | `notify`, `success`, `warning`, `error` | A short message after an action, with a queue |
| 13 | Progress and skeleton | S | Data display | None | The loading state of each component and screen |
| 14 | Avatar | S | Data display | None | The people of the product: profiles, comments, chats |
| 15 | Card | S | Data display | `press`, if the card is a link | The container of the screens on phones and on the web |
| 16 | Dialog | M | Overlays | `open`, `close` | A confirmation or a short task. It keeps the focus |
| 17 | Menu | M | Overlays | `open`, `select`, `close` | The actions of a row or a card. An action sheet on phones |
| 18 | Bottom sheet | L | Draggable bottom sheet | `drag-start`, `snap`, `open`, `close` | The overlay of phones. Snap points, velocity, and the scroll handoff |
| 19 | Tabs | M | Navigation | `select` | Views of one page. The indicator moves with `spring-control` |
| 20 | Tab bar | M | Navigation | `select` | The primary navigation of phones, with up to five destinations |

The 20 are 10 of class S, 9 of class M, and 1 of class L.

## The build order

1. Switch. It is the first component end to end. It includes the accessibility, the right-to-left layout, the two densities, the moments, and the tests. Its time sets the rate of the other components.
2. Button, Icon button, Checkbox, and Radio group. They make the base of the other controls.
3. Segmented control, Chip, Text field, Select, and Code entry.
4. Progress and skeleton, Alert and banner, Avatar, and Card.
5. Tabs and Tab bar.
6. Toast, Menu, and Dialog.
7. Bottom sheet. It is last, because it uses the springs, the velocity tracker, and the conformance vectors of the motion system.

## Not in version 1

These components have a page in the language. They come after version 1, when a consumer starts to use them.

| Component | Class | Cause |
| --- | --- | --- |
| Combobox | L | A filter list with a keyboard model. A Select is sufficient for the first consumers |
| Date picker | L | A calendar grid, ranges, and the formats of each region |
| Data table | L | Sort, filters, selection, and pages. The web apps get it first, after version 1 |
| Rich text editor | L | Eight formats, safe content, and a toolbar |
| Address field | L | The rules of each country, an area, or a map pin |
| Phone field and locale picker | M | The rules of each country |
| Charts | L | The data visualization pattern has its own rules |
| Media: gallery, upload, video, audio, documents | L | Each is a large component |
| Command menu | M | Web apps only |
| Tooltip and popover | S, M | An icon button has a text name. A tooltip is not necessary for version 1 |
| Accordion | M | Few screens use it |
| Notifications | M | The platform shows them, not the product |
| Pagination and steps | S, M | Web apps only |
| Web shell: header, sidebar, rail | L | The language site has its own shell. The web apps get it after version 1 |
| Badge and empty state | S | Parts of other components in version 1: a count on a tab, a state of a card |
