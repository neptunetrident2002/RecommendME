# RecommendME

One stranger. One category. One recommendation each. A 24-hour window to decide if the connection stays.

## The problem

You have seen every "best of" list. You have scrolled the algorithm's version of your taste back at you. You have spent hours on Reddit threads, TikTok rabbit holes, and group chats trying to find the next thing to read, watch, or listen to. The search itself becomes the distraction. By the time you surface with a recommendation, the impulse that sent you looking is already gone.

None of it feels like a real recommendation. Because it isn't. A real recommendation comes from someone who thought hard about the thing itself, and then thought about why it might matter to someone else.

RecommendME is an attempt to rebuild that. A serendipitous exchange with a stranger, or a blend list built quietly with people whose taste you've come to trust. No browsing, no ranking, no feed.

## How it works

You open the app. You pick a category: Read, Listen, or Watch.

Before you can receive anything, you write down one thing that changed you, and why. Not a rating. Not a hot take. A genuine answer to: what did this change for you, and when did you last think about it?

Then you're matched with a stranger doing the same thing. Neither of you sees the other's recommendation until both of yours are locked. Then, simultaneously, you both reveal.

You have 24 hours to follow them. If you both do, a connection forms and you can start building a blend list together. If you don't, the exchange disappears but the recommendation is yours forever.

That's the whole product.

## What it is not

- Not a social network. Connections are small by design.
- Not an algorithm. Nothing is ranked or personalised.
- Not a feed. There is nothing to scroll.
- Not a chat app. You cannot message anyone.
- Not gamified. No streaks. No badges. No leaderboards.

Every pressure from growth metrics will push toward more of those things. The entire job of this product is to resist that pressure. The value lives in scarcity and intentionality, or it lives nowhere.

## The list

Every recommendation you receive lives in your list forever. Regardless of whether the connection formed. Regardless of whether the other person's account still exists. It's yours.

You can mark things completed. You can leave a note. You cannot delete anything, only archive. The experience should remain, even if it's one you'd rather forget.

If a connection forms, both of you can contribute to a shared blend list. It persists permanently, even if one person later ends the connection.

## Why a stranger

Social recommendations carry social weight. You second-guess whether your friend's taste actually overlaps with yours, or whether they're just enthusiastic. You wonder if the recommendation is really for you or for them.

A stranger who picked one thing, explained why it changed them, and whose taste was verified by a mutual exchange is a completely different kind of signal. There's no relationship to manage. No performance. Just the recommendation itself.

## The 24-hour window

The follow window isn't a dark pattern. It's the opposite.

There's no push notification reminding you to decide. There's no "you're so close" copy. There's a countdown, and then silence. If you both follow within 24 hours, you're connected. If not, the exchange is gone. No notification about the non-follow. The silence is the product decision.

The goal is that the decision happens after you've actually consumed the recommendation, not in the moment of novelty. The median time between reveal and follow decision should be greater than two hours. That's a success metric. Session length is not.

## What success looks like

Not daily active users. Not push notification open rates.

- People are actually reading the book, watching the film, listening to the album before they decide whether to follow.
- People return after 30 days without being reminded the app exists.
- At least one person says, unprompted, that a recommendation changed something for them.

That last one can't be measured in a dashboard. It shows up as a reply to an email, or a message sent to nobody in particular. That's the metric that matters.

## The build

RecommendME is built on React, Supabase, and Cloudflare Workers. The matching queue uses Supabase Realtime. The follow window is enforced by a pg_cron job. The exchange state machine, the part that ensures neither person can see the other's recommendation before submitting their own, is enforced at the database level, not trusted to the frontend.

If no human match is found within 24 hours, Claude generates a recommendation. It is clearly labelled as such. The disclosure is visible, non-apologetic, and built into the card design from day one. Hiding it was never considered.

The build order: database schema and auth first, then matching logic, then the exchange state machine, then the cron jobs, then notifications, then the list, and the frontend last, built over a system that is already provably correct. By the time there is a UI, the only things that can go wrong are visual.

## Status

Pre-build. Invite-only waitlist launch. The product is designed for a controlled start into a single community, enough density to make real-time matching feel alive, small enough that every exchange still means something.

## Get in touch

If this sounds like something you want to help build, use, or think about, reach out.

*RecommendME v1.0*
