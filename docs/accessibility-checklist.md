# Accessibility checklist

Status: **built to spec; device passes (M7) not yet run.** Automated checks are in `app/__tests__`.

## Controls (plan §5.1)

| Requirement | Implementation | Verified |
|---|---|---|
| >6-step controls have slider, steppers and typed entry | `ValueControl` used by volume, audio sync, 5 EQ bands, bass offset | unit test |
| Rotor "Adjust value" | Wrapper `View` with `accessibilityRole="adjustable"`, `accessibilityValue`, increment/decrement actions; native SeekBar hidden from TalkBack | unit test · device: pending |
| Slider commits on release / 300 ms idle | `ValueControl` | unit test |
| Volume hold-to-repeat 400/180 ms | `Controller.startHold`; screen-reader activation steps once | unit test |
| Typed dialog: range+step shown, snapped, invalid rejected and announced, focus restored | `SetValueDialog` | unit test (validation) · device: focus pending |
| ≤6-step controls are segmented radios | `Segmented` (`radiogroup`/`radio`, `checked`) | unit test |
| 44 dp minimum target | `AppButton`, `Segmented`, steppers (48 dp) | code review |
| Focus order = reading order; no traps outside modals | Single scroll view in web order; modals use `accessibilityViewIsModal` | device: pending |

## Text and colour (§5.2)

| Requirement | Implementation | Verified |
|---|---|---|
| 200 % text | No fixed-height text containers; rows wrap; speaker labels move out of the drawing above 1.3× | device: pending |
| Contrast ≥ 4.5:1 | Palette audited; three web greys lifted (`feedback`, rear caption, bass caption) | unit test (`contrast audit`) |
| No colour-only state | Selected source: "Selected" text + `selected` state; segments: `checked` + underline; battery: % + level word; mute/night: switch `checked` + label; EQ: state sentence; errors: "Problem:" prefix for screen readers | code review |

## Feedback and motion (§5.3)

| Requirement | Implementation | Verified |
|---|---|---|
| Results announced | `useFeedbackAnnouncer` → `announceForAccessibility`; the feedback row is not a live region (no duplicates) | device: pending |
| Volume runs not over-announced | "Setting volume N" once, then the final result | code review |
| Reduce Motion | No animations are used anywhere (charts and bass rings are static) | code review |
| Charts have text equivalents | CPU/RAM/EQ graphs are `image` with descriptive labels; metrics have text values | code review |

## Web→native adaptations (§5.4)

Speaker drawing hidden from TalkBack with a spoken summary; `<details>` → `Disclosure` with
`expanded` state; skip link → visible "Jump to controls" header button; `<select>` → `Picker`
radio list.

## M7 device script (to run)

1. TalkBack: swipe through the whole screen; every control has a name, role and state.
2. Volume rotor: swipe up/down on the Volume slider changes volume by one step each.
3. Set value dialog: open, type 40 → error read aloud; type 20 → applied; focus returns to "Set value".
4. Switch Access: reach and operate volume steppers, a segment, Night mode, Apply EQ.
5. Font size 200 % + display size largest: no clipped or overlapping text.
6. Remove animations on: nothing animates.
