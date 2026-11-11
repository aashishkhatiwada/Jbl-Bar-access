# Rear battery low threshold

**Result:** `REAR_LOW_BATTERY_PERCENT = 14` (alert when a detached rear reports 1–14 %).
Defined in `app/src/notifications/thresholds.ts`.

| | |
|---|---|
| Method | Static analysis (plan §8.2, method 1). No drain test run. |
| Date | 2026-11-10 |
| Binary | `rootfs/usr/local/bin/bdpprog` from `Firmware_update-JBL_Bar_9.1_TWS_Version_21.23.11.80` (md5 `91e5ccbf741f1693d4d273e8fd78ee36`) |
| Target bar | firmware build `310669`: its `bdpprog` is **different** (md5 `35fc2269ef2a14b3207a3e3b82eea91c`, checked 2026-11-11), so the value is unconfirmed for this bar |

## What the firmware does

`bdpprog` is a stripped 32-bit ARM ELF. The display strings live in `.rodata`:

| String | File offset | VA |
|---|---|---|
| `CHARGE SPKR BATT LOW` | `0xabc6c2` | `0xac46c2` |
| `REAR SPKR LOW BATT` | `0xabc721` | `0xac4721` |
| `[TONLY HINA] … R/L SOD insert and battery is low` (7 variants) | `0xb89ed6`… | `0xb91ed6`… |

The display strings are referenced only from the front-display renderer's literal pool
(`0x6238f4`–`0x623900`, Thumb-2, TBH switch at `0x622456`, cases 78–81). The decision to show them
is made in the Tonly (OEM) speaker code in ARM mode at `0x7e2a04`, `0x7e2e74` and `0x7e2fd4`. Every path
performs the same test on the left/right battery byte `b`:

```
ldrb  r3, [battery]
sub   r3, r3, #1
uxtb  r3, r3
cmp   r3, #13
bhi   not_low          ; low only when (uint8)(b − 1) ≤ 13  →  1 ≤ b ≤ 14
...
mov   r0, #112 / #113  ; post the display message
```

Where the byte may carry a charging flag, the code first checks `b > 100` and uses `b − 100`
(`sub r3, r3, #101; cmp r3, #13` ⇒ 101 ≤ b ≤ 114). So the threshold is the same docked or
undocked: **≤ 14 %**, and **0 is never low** (it underflows to 255). The app mirrors both rules.

## App behaviour built on it

- Alert when undocked, bar `On`, and battery 1–14 %, once per speaker per discharge cycle.
- Re-arm at ≥ 19 % (threshold + 5) or when docked.
- Suppressed when docked, when battery/dock state is unknown, when unreachable, and in standby
  (cached telemetry). Covered by `app/__tests__/battery.test.ts`.

## Open item

On 2026-11-11 the bar reported `md5sum /usr/local/bin/bdpprog` = `35fc2269ef2a14b3207a3e3b82eea91c`,
which differs from the analysed image (`91e5ccbf741f1693d4d273e8fd78ee36`). The bar runs a newer build
(release notes for 23.06.41.80 are in `firmware/`). Until the bar's own binary is analysed, 14 % is a
best estimate from the older firmware.

To finish: copy the bar's binary and repeat the analysis above (find the `REAR SPKR LOW BATT` path and
its `cmp` constant):

```
ssh -p 2222 root@192.168.100.25 cat /usr/local/bin/bdpprog > bdpprog-310669
```

Fallback: the observation method (§8.2 method 2).
