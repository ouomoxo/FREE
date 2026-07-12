// PROJECT MAYHEM — content module.
// Pure data. No imports, no side effects. ES module named exports.

export const CATEGORIES = [
  { id: 'detach', name: 'DETACHMENT', blurb: 'The things you own end up owning you.' },
  { id: 'digital', name: 'SIGNAL', blurb: 'Kill the feeds that feed on you.' },
  { id: 'presence', name: 'PRESENCE', blurb: 'This is your life and it is ending one minute at a time.' },
  { id: 'courage', name: 'COURAGE', blurb: 'Do the thing that scares the comfortable version of you.' },
  { id: 'give', name: 'GENEROSITY', blurb: 'You are not the money in your account.' },
];

export const CHALLENGES = [
  // ── DETACHMENT ─────────────────────────────────────────────
  {
    id: 'd01', cat: 'detach', title: 'THE FIVE-THING PURGE',
    brief: 'Pick five things you own but never use and give them away today.',
    detail: 'Walk your home and pull five objects you have not touched in a year. Bag them and hand them to a shelter, a neighbor, or a donation bin before you sleep. Each thing you release is one less thing quietly claiming a piece of your attention.',
    minutes: 30, tracks: { released: 5 },
  },
  {
    id: 'd02', cat: 'detach', title: 'ONE-IN, ONE-OUT',
    brief: 'For anything new you brought home this week, release something old.',
    detail: 'Find the last thing you bought and choose an older item of the same kind to give away. Match the intake to an outflow so your space stops silently swelling. Ownership is a current, not a hoard.',
    minutes: 15, tracks: { released: 1 },
  },
  {
    id: 'd03', cat: 'detach', title: 'THE DRAWER OF SHAME',
    brief: 'Empty your junk drawer completely and only put back what you truly use.',
    detail: 'Dump the whole drawer onto a table and sort every object into keep, gift, or discard. Most of it is guilt in physical form. Reclaim the drawer and you reclaim a small proof that you can let go.',
    minutes: 25, tracks: { released: 3 },
  },
  {
    id: 'd04', cat: 'detach', title: 'CLOSET AMNESTY',
    brief: 'Remove every garment you have not worn in a year and donate it.',
    detail: 'Pull each item you have skipped past for twelve months and set it aside without excuses. Fold them, box them, and drop them at a donation point today. Your identity was never stitched into cloth you never wear.',
    minutes: 45, tracks: { released: 8 },
  },
  {
    id: 'd05', cat: 'detach', title: 'NO-BUY DAY',
    brief: 'Buy nothing for twenty-four hours except essential food and medicine.',
    detail: 'For one full day, spend on nothing but what your body genuinely needs to keep going. Notice every impulse to purchase and let it pass unfed. The urge fades, and you learn it was never really yours.',
    minutes: 10,
  },
  {
    id: 'd06', cat: 'detach', title: 'THE WISHLIST BURN',
    brief: 'Delete every saved cart, wishlist, and "buy later" item you are hoarding.',
    detail: 'Open every shopping app and clear the graveyard of things you almost bought. Watch how little you miss any of it once it is gone. A want you cannot even remember was never a need.',
    minutes: 20,
  },
  {
    id: 'd07', cat: 'detach', title: 'BOOKSHELF HONESTY',
    brief: 'Give away three books you keep only to look like the person who read them.',
    detail: 'Scan your shelves for the titles you display but will never open again. Pass them to someone who will actually read them, or to a little free library. Your worth is not measured in unread spines.',
    minutes: 15, tracks: { released: 3 },
  },
  {
    id: 'd08', cat: 'detach', title: 'ONE SURFACE, CLEARED',
    brief: 'Completely clear one cluttered surface and keep it bare for the day.',
    detail: 'Choose a counter, desk, or table and remove everything that lives on it. Return only what earns its place through daily use; rehome the rest. An empty surface is room to breathe, not a vacancy to fill.',
    minutes: 20,
  },
  {
    id: 'd09', cat: 'detach', title: 'THE PHANTOM UPGRADE',
    brief: 'Use the thing you already own instead of buying the upgrade you crave.',
    detail: 'Name the object you have been itching to replace and commit to using the working one you have. Clean it, repair it, or just accept it for one more season. The upgrade sells a story about you, not a solution you need.',
    minutes: 10,
  },
  {
    id: 'd10', cat: 'detach', title: 'GIVE THE DUPLICATE',
    brief: 'Find something you own more than one of and give the spare away.',
    detail: 'Hunt for duplicates: the third spatula, the spare charger, the backup jacket. Keep one and give the rest to someone who has none. Redundancy is just clutter that convinced you it was safety.',
    minutes: 15, tracks: { released: 2 },
  },

  // ── SIGNAL (digital) ───────────────────────────────────────
  {
    id: 'sig01', cat: 'digital', title: 'KILL THE FEED',
    brief: 'Log out of every social app on your phone for the entire day.',
    detail: 'Sign out, do not just close, every infinite-scroll app you own. Feel the reflex to check and let it go unanswered. The feed is engineered to eat your hours; today you starve it.',
    minutes: 5,
  },
  {
    id: 'sig02', cat: 'digital', title: 'NOTIFICATIONS OFF',
    brief: 'Turn off all non-essential notifications and leave them off.',
    detail: 'Go into settings and silence every badge, buzz, and banner that is not a real human contacting you directly. Each alert was a leash yanking your focus back to someone else\'s agenda. Cut the leash and let your attention be yours.',
    minutes: 15,
  },
  {
    id: 'sig03', cat: 'digital', title: 'THE UNFOLLOW SWEEP',
    brief: 'Unfollow twenty accounts that leave you emptier than they found you.',
    detail: 'Scroll your follows and cut anyone who feeds envy, rage, or the ache to buy. Curate a signal that leaves you calmer, not hungrier. You are what you repeatedly look at.',
    minutes: 20,
  },
  {
    id: 'sig04', cat: 'digital', title: 'GRAYSCALE',
    brief: 'Switch your phone screen to grayscale for the whole day.',
    detail: 'Enable grayscale in accessibility settings and live with a colorless screen. The dopamine reds and blues were designed to reel you back; drained of color, the phone loses its pull. Notice how quickly you set it down.',
    minutes: 5,
  },
  {
    id: 'sig05', cat: 'digital', title: 'INBOX ZERO, RUTHLESS',
    brief: 'Unsubscribe from ten marketing emails instead of deleting them.',
    detail: 'For every promotional email you would normally trash, hit unsubscribe instead. Cut the source, not the symptom. Ten fewer voices whispering that you are incomplete.',
    minutes: 20,
  },
  {
    id: 'sig06', cat: 'digital', title: 'ONE SCREEN, ONE HOUR',
    brief: 'Leave your phone in another room for one uninterrupted hour.',
    detail: 'Put the phone somewhere you cannot reach without standing up, and do one thing with your full attention. Let the itch to check come and pass. An hour undivided is worth more than a day fractured.',
    minutes: 60,
  },
  {
    id: 'sig07', cat: 'digital', title: 'DELETE ONE APP',
    brief: 'Delete the app you open the most on reflex and survive the day without it.',
    detail: 'Check your screen-time report, find the app you open without deciding to, and remove it. Feel the phantom reach for an icon that is no longer there. You just proved the habit was a groove, not a need.',
    minutes: 5,
  },
  {
    id: 'sig08', cat: 'digital', title: 'CANCEL ONE SUBSCRIPTION',
    brief: 'Cancel one recurring subscription you forgot you were even paying for.',
    detail: 'Open your bank statement and find a monthly charge you do not consciously use. Cancel it today and reclaim the money that was leaking out on autopilot. Every silent subscription is a small tax on inattention.',
    minutes: 15, tracks: { reclaimed: 12 },
  },
  {
    id: 'sig09', cat: 'digital', title: 'DARK BEDROOM',
    brief: 'Charge your phone outside the bedroom tonight and wake without it.',
    detail: 'Set a real alarm clock or leave the phone charging in another room overnight. Fall asleep and wake up without a screen as bookends to your rest. The first and last minutes of your day belong to you, not the feed.',
    minutes: 5,
  },
  {
    id: 'sig10', cat: 'digital', title: 'THE READ-ONLY DAY',
    brief: 'Post nothing online today — only consume, create, or stay silent.',
    detail: 'For one day, publish no updates, no photos, no comments seeking approval. Notice how often you reach to perform your life instead of living it. Silence online is not absence; it is ownership.',
    minutes: 5,
  },

  // ── PRESENCE ───────────────────────────────────────────────
  {
    id: 'pr01', cat: 'presence', title: 'TEN MINUTES OF NOTHING',
    brief: 'Sit in silence for ten minutes with no phone, screen, or task.',
    detail: 'Find a chair, set a timer, and simply sit doing absolutely nothing. Let the boredom rise and dissolve without reaching for a distraction. On the other side of that discomfort is a mind that is finally quiet.',
    minutes: 10,
  },
  {
    id: 'pr02', cat: 'presence', title: 'EAT WITHOUT A SCREEN',
    brief: 'Eat one full meal today with no phone, TV, or reading — just the food.',
    detail: 'Sit down with your meal and give it your entire attention: taste, texture, the fact of being fed. Do not narrate it, photograph it, or scroll through it. Presence turns eating from a task back into a pleasure.',
    minutes: 20,
  },
  {
    id: 'pr03', cat: 'presence', title: 'THE COLD SHOWER',
    brief: 'End your shower with thirty seconds of cold water and just breathe.',
    detail: 'Turn the water cold for the last half minute and stay under it, breathing slow. Your body will scream to flee; do not. You learn that discomfort is a wave you can ride, not an emergency you must obey.',
    minutes: 10,
  },
  {
    id: 'pr04', cat: 'presence', title: 'WALK WITH NO DESTINATION',
    brief: 'Take a twenty-minute walk with no phone and no place you need to be.',
    detail: 'Step outside and walk with no route, no podcast, and no goal but the walking itself. Look up, notice buildings and trees and faces you usually blur past. The world is astonishingly detailed when you stop rushing through it.',
    minutes: 20,
  },
  {
    id: 'pr05', cat: 'presence', title: 'HANDWRITE A PAGE',
    brief: 'Write one full page by hand about anything on your mind.',
    detail: 'Take pen and paper and fill a page without stopping to edit or perform. Let the slowness of your own hand pace your thoughts. What you think becomes real in a way no typed screen ever manages.',
    minutes: 20,
  },
  {
    id: 'pr06', cat: 'presence', title: 'ONE THING AT A TIME',
    brief: 'Do one chore today with total single-tasking focus and nothing else on.',
    detail: 'Wash the dishes, or fold the laundry, with no music, no podcast, no phone propped nearby. Feel the water, the fabric, the motion of your own hands. The ordinary task becomes a small meditation you did not know you needed.',
    minutes: 15,
  },
  {
    id: 'pr07', cat: 'presence', title: 'WATCH THE SKY',
    brief: 'Spend five minutes watching the sky without doing anything else.',
    detail: 'Go to a window or step outside and look up until five minutes pass. Track a cloud, find the moon, watch the light change. You are a small animal under an enormous sky, and remembering that is a strange relief.',
    minutes: 5,
  },
  {
    id: 'pr08', cat: 'presence', title: 'THE SLOW COFFEE',
    brief: 'Make and drink one hot drink with no other activity at all.',
    detail: 'Brew a coffee or tea and drink it seated, doing nothing but drinking it. No scrolling, no planning, no guilt about the time. Ten unhurried minutes are not stolen from your life; they are your life.',
    minutes: 15,
  },
  {
    id: 'pr09', cat: 'presence', title: 'NAME FIVE SENSES',
    brief: 'Stop right now and name what each of your five senses is registering.',
    detail: 'Pause and consciously find something you can see, hear, smell, touch, and taste in this moment. Say each one to yourself deliberately. This drops you out of the anxious future and back into the only place you can act: now.',
    minutes: 5,
  },
  {
    id: 'pr10', cat: 'presence', title: 'LIGHTS-OUT EARLY',
    brief: 'Go to bed thirty minutes early tonight with no screen, just rest.',
    detail: 'Turn everything off half an hour before your usual time and lie in the dark. Let your mind unspool without a feed to catch it. Rest is not laziness; it is the maintenance the culture keeps telling you to skip.',
    minutes: 30,
  },

  // ── COURAGE ────────────────────────────────────────────────
  {
    id: 'co01', cat: 'courage', title: 'TALK TO A STRANGER',
    brief: 'Start a genuine short conversation with one stranger today.',
    detail: 'Say something real to a person you do not know: a barista, a neighbor, someone in line. Ask a question and actually listen to the answer. The wall between you and other people is thinner than the fear pretends.',
    minutes: 10,
  },
  {
    id: 'co02', cat: 'courage', title: 'EAT ALONE IN PUBLIC',
    brief: 'Sit down and eat a meal alone in public with no phone to hide behind.',
    detail: 'Take yourself to a cafe or bench and eat alone without staring at a screen for cover. Feel the imagined eyes and notice that nobody actually cares. You can be your own good company, and that is a quiet superpower.',
    minutes: 30,
  },
  {
    id: 'co03', cat: 'courage', title: 'LEARN A NAME',
    brief: 'Learn and use the name of someone you see often but never really meet.',
    detail: 'Ask the name of the person who serves your coffee, guards your building, or shares your commute. Use it, remember it, and greet them by it next time. Seeing people as people is a small act of rebellion against a world that numbers them.',
    minutes: 5,
  },
  {
    id: 'co04', cat: 'courage', title: 'ASK FOR THE DISCOUNT',
    brief: 'Politely ask for a better price or a waived fee on something today.',
    detail: 'Call a provider or ask at a counter whether there is a lower rate or a fee they can drop. The worst answer is a simple no, and you will survive it easily. Practicing the ask dissolves the fear that keeps you overpaying and overquiet.',
    minutes: 15,
  },
  {
    id: 'co05', cat: 'courage', title: 'SAY THE HARD NO',
    brief: 'Decline one request today that you would normally accept out of guilt.',
    detail: 'Find the ask you would auto-agree to against your own interest, and say no clearly and kindly. Do not over-explain or apologize into oblivion. Every honest no protects a yes that actually matters to you.',
    minutes: 5,
  },
  {
    id: 'co06', cat: 'courage', title: 'GIVE A REAL COMPLIMENT',
    brief: 'Tell someone sincerely and specifically why you admire them.',
    detail: 'Choose a person and name a genuine quality you respect, out loud and without hedging. Watch it land and change the air between you. Vulnerability offered on purpose is braver than any armor you could wear.',
    minutes: 5,
  },
  {
    id: 'co07', cat: 'courage', title: 'SING OR SPEAK UP',
    brief: 'Do one small thing in public that your self-consciousness usually vetoes.',
    detail: 'Hum out loud, dance while you wait, ask the question in the room, wear the bold thing. Feel the flush of visibility and let it pass without shrinking. The imagined audience judging you is far smaller and far kinder than fear claims.',
    minutes: 10,
  },
  {
    id: 'co08', cat: 'courage', title: 'THE UNSENT MESSAGE',
    brief: 'Reach out to someone you have been avoiding and say the honest thing.',
    detail: 'Message or call the person you keep meaning to and have not, and say what is true. Mend it, thank them, or simply reconnect without an agenda. The dread of doing it is always heavier than the doing.',
    minutes: 15,
  },
  {
    id: 'co09', cat: 'courage', title: 'DO IT BADLY',
    brief: 'Try something new in public where you are guaranteed to be a beginner.',
    detail: 'Take one shot at a skill you are bad at where others can see you fumble. Let yourself be clumsy and laugh at it. The permission to be a beginner is the permission to actually grow.',
    minutes: 30,
  },
  {
    id: 'co10', cat: 'courage', title: 'THE UNCOMFORTABLE QUESTION',
    brief: 'Ask someone a deeper question than small talk usually allows.',
    detail: 'Skip the weather and ask a person what they are actually excited or worried about lately. Hold the small silence that follows without rushing to fill it. Real connection lives one brave question past the polite surface.',
    minutes: 10,
  },

  // ── GENEROSITY ─────────────────────────────────────────────
  {
    id: 'gv01', cat: 'give', title: 'PAY IT FORWARD',
    brief: 'Quietly cover a small cost for a stranger with no expectation.',
    detail: 'Buy the next person\'s coffee, feed a stranger\'s parking meter, or leave a generous tip. Do it without waiting for thanks or telling anyone. Money spent on a stranger\'s good moment buys something no purchase for yourself ever will.',
    minutes: 10,
  },
  {
    id: 'gv02', cat: 'give', title: 'DONATE THE UNUSED',
    brief: 'Box up ten genuinely useful items and give them to someone who needs them.',
    detail: 'Gather ten things in good condition that you do not use and get them to a shelter or family that does. Not the broken castoffs, the actually good stuff. Generosity that costs you nothing you would miss is barely generosity at all.',
    minutes: 40, tracks: { released: 10 },
  },
  {
    id: 'gv03', cat: 'give', title: 'GIVE AN HOUR',
    brief: 'Give one hour of real help to someone with nothing asked in return.',
    detail: 'Offer your time to a person or cause: carry the boxes, tutor the kid, sit with the lonely one. Show up and be useful with no invoice attached. Your hours are the realest wealth you have, and sharing them multiplies them.',
    minutes: 60,
  },
  {
    id: 'gv04', cat: 'give', title: 'THE ANONYMOUS GIFT',
    brief: 'Give something valuable to someone who will never know it was you.',
    detail: 'Leave a gift, cover a bill, or donate in a way that can never be traced back to you. Sit with the fact that no one will thank you. Generosity that buys you no credit is the only kind that proves it was never about you.',
    minutes: 20,
  },
  {
    id: 'gv05', cat: 'give', title: 'WRITE A LETTER OF THANKS',
    brief: 'Write a real letter by hand thanking someone who shaped you.',
    detail: 'Take pen and paper and tell someone exactly how they changed your life for the better. Mail it or hand it over in person. Gratitude spoken plainly is a gift that costs a stamp and lands for years.',
    minutes: 25,
  },
  {
    id: 'gv06', cat: 'give', title: 'FEED SOMEONE',
    brief: 'Give food to a person who is hungry today.',
    detail: 'Hand a real meal to someone who needs it, or stock a community fridge or food bank. Make it food you would be glad to eat yourself. Filling another person\'s stomach is the oldest and least abstract kindness there is.',
    minutes: 20,
  },
  {
    id: 'gv07', cat: 'give', title: 'REDIRECT THE IMPULSE',
    brief: 'Take the money you almost spent on yourself and give it away instead.',
    detail: 'Catch one impulse purchase today, add up what it would have cost, and donate that exact amount. Send it somewhere it will do real good. The urge to buy, redirected, becomes proof you own the impulse instead of it owning you.',
    minutes: 10,
  },
  {
    id: 'gv08', cat: 'give', title: 'GIVE YOUR SEAT, YOUR PLACE',
    brief: 'Give up something small and convenient to make someone else\'s day easier.',
    detail: 'Offer your seat, your spot in line, or the last good parking space to someone who needs it more. Do it gladly, not grudgingly. Small deference is a daily rehearsal for caring about someone other than yourself.',
    minutes: 5,
  },
  {
    id: 'gv09', cat: 'give', title: 'TEACH WHAT YOU KNOW',
    brief: 'Give someone a skill of yours for free with real patience.',
    detail: 'Show a person how to do something you are good at and they want to learn. Go slow, be kind, and expect nothing back. Knowledge given away is the rare wealth that grows in both of you at once.',
    minutes: 30,
  },
  {
    id: 'gv10', cat: 'give', title: 'THE STANDING DONATION',
    brief: 'Set up one small recurring gift to a cause you actually believe in.',
    detail: 'Choose a cause that matters to you and commit a modest monthly amount you will not miss. Make generosity a default instead of a rare event. When giving runs on autopilot, so does the reminder that you have enough.',
    minutes: 15,
  },
];

export const RULES = [
  'First rule: you decide what you own. If you cannot let it go, it owns you.',
  'Second rule: YOU DECIDE WHAT YOU OWN. Say it until your possessions get nervous.',
  'Third rule: if an impulse says buy now, wait a day. Most of them do not survive the night.',
  'Fourth rule: one assignment at a time. Do it fully or not at all.',
  'Fifth rule: no audience. If you did it only to be seen doing it, you did not do it.',
  'Sixth rule: comfort is not the goal. Choose the braver, freer thing.',
  'Seventh rule: what you give away, you finally get to keep.',
  'Eighth rule: if this is your first day, this is your first assignment. Begin.',
];

export const MANIFESTO = [
  'You were sold a story that you are what you own, what you scroll, what you buy next. It is a lie, and it is expensive. Every ad, every feed, every upgrade was built to keep you hungry, because a satisfied person is bad for business. This is where you stop being their business.',
  'Project Mayhem is simple. One small assignment a day, chosen by you, done fully. Let something go. Close a feed. Sit in the silence you have been running from. Talk to the stranger. Give without being seen. None of it is heroic and all of it is a crack in the wall.',
  'This is not about hating things. It is about ending the trance where things quietly run your life while you call it freedom. You do not have to burn anything down. You only have to notice the leash, and set it down, and feel how light your own two hands actually are.',
  'You own this. Not a brand, not a feed, not the version of you that a company invented to sell you back to yourself. Start today, start badly, start with one thing. The life you keep putting off is the only one you get, and it is already running. Begin.',
].join('\n\n');
