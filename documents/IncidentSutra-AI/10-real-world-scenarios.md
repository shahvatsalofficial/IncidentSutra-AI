# Real-world scenarios

> Six situations on-call engineers recognise. Each one is a **runnable sample** in `fixtures/scenarios/`: the timeline, hypotheses and gaps shown on the website are produced by running the tool on that file when the site is built. The stories are fictional; the outputs are real.

Run any of them yourself:

```bash
npx incidentsutra analyze --input fixtures/scenarios/deploy-blamed --out report --synthetic
```

## Scenario 1: "It was the deploy!"

**02:10, war room.** Orders are failing. Release 4.2.0 shipped a few minutes ago. Someone is already typing the rollback command.

<!-- scenario:deploy-blamed -->

**What changes the conversation:** the same error appears at 10:02, four minutes **before** the 10:06 release. The report lists it as counter-evidence and offers a pre-existing defect as a competing explanation. A rollback may still be reasonable, but nobody should expect it to be the whole answer.

**Usually without it:** the rollback runs, errors continue, and the real defect is found an hour later.

## Scenario 2: The time zone trap

**The CI system logs in India time. The application logs in UTC.** Read side by side, the deployment seems to come five hours after the errors started.

<!-- scenario:timezone-mixup -->

**What changes the conversation:** both are converted to UTC. The deployment at 01:15 +05:30 is 19:45 UTC, **four minutes before** the first error. The report flags mixed offsets and says clock skew was not measured.

## Scenario 3: The provider is slow, but search just shipped

**14:03, checkout times out.** The only deployment nearby belongs to the search team, and they are being asked to roll back.

<!-- scenario:payment-provider -->

**What changes the conversation:** a payment-provider latency warning appears three minutes **before** the first checkout error, so a dependency hypothesis is raised with that event as support. Search is not an erroring service, so no change hypothesis is built against its release.

## Scenario 4: The connection pool

**Monday 08:14, logins fail.** A release went out 44 minutes earlier.

<!-- scenario:database-pool -->

**What changes the conversation:** the release falls outside the 15-minute correlation window, so it is not linked automatically. A datastore hypothesis cites the pool-exhaustion and lock messages, and the metric series shows connections moving from 40 to 200. Widen the window with `--window-minutes 60` if your releases take longer to show effects.

## Scenario 5: The 3 a.m. alert storm

**Pages every few seconds.** Logs contain a customer email address and an authorization header.

<!-- scenario:night-alert-storm -->

**What changes the conversation:** the burst is grouped as one storm, the first signal (out of memory) is easy to find, a saturation hypothesis is raised, and the email address and token are masked before anything is written.

## Scenario 6: Almost no evidence

**Two customers say the page is blank.** There are no metrics, traces or deployment records, and one note has no real timestamp.

<!-- scenario:thin-evidence -->

**What changes the conversation:** the report refuses to guess. The note is rejected with a reason, the missing data is listed as **unknown**, and the next steps are about collecting evidence.

## What these scenarios do not show

The inputs are small and clean. Real exports are larger and messier. Classification is keyword based, so a message worded differently can miss a hypothesis family. None of this proves a root cause.
