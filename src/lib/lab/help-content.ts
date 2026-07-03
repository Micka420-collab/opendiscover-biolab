/**
 * Plain-language help cards — the "?" explanations that make the lab approachable to
 * anyone, with no biology or maths background. Core to the citizen-science goal: if a
 * stranger can understand what they are tuning and why it matters, they can take part.
 *
 * Each card answers three questions in everyday words — what you are doing, why it matters,
 * and how to find the answer (a non-spoiler nudge) — plus a tiny glossary for any
 * unavoidable term. Generated then accuracy/accessibility-VERIFIED from the engines own
 * descriptions and challenge briefs (aurora-help-content generate→verify workflow), so the
 * copy never contradicts the science.
 *
 * Keyed by challenge id. A test asserts every pooled challenge has a card, so a new
 * challenge cannot ship without its plain-language help.
 */

export interface HelpTerm {
  term: string;
  meaning: string;
}

export interface HelpCard {
  /** What you are actually doing, in everyday words. */
  plainWhat: string;
  /** Why it matters in real life / for people and the planet. */
  plainWhy: string;
  /** A friendly, non-spoiler nudge on how to find the answer. */
  plainHow: string;
  /** 0-3 unavoidable technical words, each with a one-line plain meaning. */
  terms: HelpTerm[];
}

/** Verified plain-language cards, keyed by challenge id. */
export const HELP_CARDS: Record<string, HelpCard> = {
  'epidemic-half': {
    plainWhat:
      'You are setting how easily a make-believe illness jumps from one person to the next. Your goal this round is to land it so that about half of everyone ends up catching it before the outbreak ends.',
    plainWhy:
      'When a real disease spreads, health teams badly want to guess how many people will get sick in the end. That final headcount tells them how many hospital beds to ready and how hard to push things like masks or vaccines to protect everyone.',
    plainHow:
      'If the illness spreads too weakly it barely gets going and almost nobody catches it. If it spreads too strongly it races through and nearly everybody catches it. Half means finding a gentle middle setting between those two extremes.',
    terms: [
      {
        term: 'attack rate',
        meaning: 'The share of people who caught the illness by the time the outbreak is over.',
      },
      {
        term: 'transmission rate',
        meaning: 'How easily the illness passes from a sick person to a healthy one.',
      },
    ],
  },
  'noncompetitive-half-vmax': {
    plainWhat:
      'You are adding a "brake" chemical that slows down a tiny biological worker called an enzyme. Set the amount so the worker\'s fastest possible speed drops to exactly half of normal.',
    plainWhy:
      'This is how most medicines actually work: a drug gently throttles a busy part of the body until it runs at just the right pace. Get the dose right and people get better safely; get it wrong and the medicine does too little to help, or so much it causes harm.',
    plainHow:
      'Add too little brake and the worker barely slows. Add too much and it nearly stops. The half-speed point sits at a special in-between amount that matches how tightly this particular brake grips the worker.',
    terms: [
      { term: 'enzyme', meaning: 'A tiny helper in living things that speeds up a chemical job.' },
      { term: 'inhibitor', meaning: 'Something that slows an enzyme down, like a brake.' },
      {
        term: 'top speed (Vmax)',
        meaning: 'The fastest an enzyme can possibly work when nothing is holding it back.',
      },
    ],
  },
  'edge-of-chaos': {
    plainWhat:
      "You're turning one dial that sets how fast a make-believe animal population tries to grow each year. Your job is to park it right where the yearly ups and downs stop being predictable but haven't gone wild.",
    plainWhy:
      'In real life this line decides whether a species keeps a steady rhythm or lurches unpredictably from boom to crash. Knowing where that edge sits helps people protect fish, insects, and other wildlife before their numbers spin out of control.',
    plainHow:
      'Turn the dial low and the population settles into a calm, repeating pattern year after year. Turn it high and the numbers jump around with no rhythm at all. The spot you want is the exact tipping point between those two, so nudge it up until the steady pattern is just about to break.',
    terms: [
      {
        term: 'Growth parameter',
        meaning: 'The dial that says how strongly the population tries to multiply each year.',
      },
      {
        term: 'Chaos indicator',
        meaning:
          'A reading that is calm when the numbers repeat and climbs once they become unpredictable.',
      },
    ],
  },
  'chemostat-productivity': {
    plainWhat:
      'You are setting how fast fresh food flows through a never-stopping brewing tank. That same flow also washes some of the tiny living microbes out of the tank. Your goal is to get the most new microbe growth out of the tank each hour.',
    plainWhy:
      'Tanks like this run around the clock to make fuel, food, and medicine without ever shutting down. Getting the flow right means more of these useful things from the same tank, in the same time, using the same energy — cheaper medicine, cleaner fuel, more food for everyone.',
    plainHow:
      "Set the flow too slow and very little passes through each hour, so you waste the tank's time. Set it too fast and you wash the microbes out quicker than they can breed, so the tank empties and output crashes to nothing. The best spot is a fast flow that stops just short of that emptying point.",
    terms: [
      {
        term: 'Washout',
        meaning:
          'When fresh liquid pours in so fast that the microbes get flushed away before they can multiply, leaving the tank empty.',
      },
      {
        term: 'Dilution rate',
        meaning:
          'How quickly fresh food flows in (and old liquid flows out) compared to the size of the tank.',
      },
    ],
  },
  'pk-terminal-half-life': {
    plainWhat:
      'You are setting how much room the drug has to hide inside body tissue. Your goal is to make the drug take exactly 8 hours to drop to half its strength.',
    plainWhy:
      'How long a medicine sticks around decides how often someone has to take it. Getting this right means fewer pills a day and steadier, safer treatment for real patients.',
    plainHow:
      'Think of tissue as a hiding spot for the drug. Too small a hiding spot and the drug clears out fast, halving too quickly. Too big and it lingers, halving too slowly. The 8-hour sweet spot sits at just the right size in between.',
    terms: [
      {
        term: 'Half-life',
        meaning: 'The time it takes for the amount of drug in the body to drop to half.',
      },
      {
        term: 'Tissue reservoir',
        meaning: 'Body tissue that soaks up and slowly holds onto some of the drug.',
      },
    ],
  },
  'wilson-cowan-brain-rhythm': {
    plainWhat:
      'You are setting how strongly two teams of brain cells get pushed. One team fires the cells up, the other calms them down, and you want them to trade off in a steady back-and-forth beat.',
    plainWhy:
      'Your brain works by pulsing in gentle rhythms, like a heartbeat for thinking. When that push-and-pull tips too far, the rhythm breaks and cells all fire at once, which is what a seizure is. Finding the balance shows how a healthy brain keeps its beat.',
    plainHow:
      'Push too gently and nothing wakes up, so the beat stays flat. Push too hard and everything fires at once and jams up, so it goes flat again. The biggest, healthiest swing hides in a narrow spot near the top, just before it overloads.',
    terms: [
      { term: 'External drive', meaning: 'how strongly you push the brain cells from the outside' },
      {
        term: 'Rhythm swing size',
        meaning: 'how big the back-and-forth beat gets; bigger means a stronger, clearer rhythm',
      },
    ],
  },
  'reed-frost-vaccinate': {
    plainWhat:
      'You choose how many people in a town of 100,000 get vaccinated before a fast-spreading illness arrives. Your job is to keep the number of people who catch it down to a small slice of the town.',
    plainWhy:
      'When enough people are protected, a spreading illness runs out of new people to jump to and simply fizzles out. That keeps even the folks who could not get the shot safe, and it stops hospitals from being flooded all at once. This is exactly how real vaccine campaigns shut down outbreaks in real towns.',
    plainHow:
      'Vaccinate too few and the illness still races through almost everyone. Vaccinate the whole town and you keep it safe but pour out doses nobody needed. The magic happens at a tipping point: once protection climbs past a certain share of the town, the outbreak suddenly collapses instead of growing. So the smart move is to land just past that edge, not below it and not far above it.',
    terms: [
      {
        term: 'herd immunity',
        meaning:
          'when enough people are protected that an illness can no longer spread and dies out on its own',
      },
    ],
  },
  'wlc-stretch-dna': {
    plainWhat:
      "You're holding a single molecule of DNA in a beam of light and gently pulling it straighter. Set how far you stretch it so your pull reads exactly 10 piconewtons (a truly tiny tug).",
    plainWhy:
      'Your body squeezes a huge tangle of DNA into every tiny cell. Feeling exactly how a single molecule pushes back when you tug it helps scientists understand how life folds and packs its instructions so neatly.',
    plainHow:
      'Think of a crumpled string: at first it straightens easily, but the closer you get to fully straight, the harder it fights back and the pull shoots up fast. Stretch too little and the pull is far too gentle; go almost all the way and it suddenly spikes past your target, so the sweet spot sits very near full length.',
    terms: [
      {
        term: 'piconewton',
        meaning:
          'An almost unimaginably tiny amount of pulling force, way smaller than the weight of a single grain of sand.',
      },
      {
        term: 'DNA',
        meaning:
          'The long, thread-like molecule inside your cells that carries the instructions for building and running your body.',
      },
    ],
  },
  'endemic-sir-target': {
    plainWhat:
      'You are setting how easily a disease like measles spreads from person to person. Your goal is to land its steady, always-around level at 5 out of every 100 people.',
    plainWhy:
      "Measles and diseases like it never fully vanish, because new babies who haven't caught it keep being born and can catch it later. Getting the spread to the right level helps you picture how much illness a community would carry for good, and how much vaccines and care could push it down.",
    plainHow:
      'Turn the spreading up and the always-around level rises, creeping toward a ceiling a bit below one in ten. Turn it down and the disease barely lingers. Your target sits partway up that climb, so nudge gently until the steady level rests right at 5 in 100.',
    terms: [
      {
        term: 'Endemic level',
        meaning:
          'The steady share of people who stay infected once the disease settles in for the long haul.',
      },
      {
        term: 'Reproduction number',
        meaning: 'The average number of new people one sick person passes the disease to.',
      },
    ],
  },
  'firefly-sync': {
    plainWhat:
      'You have a swarm of blinking fireflies, each flashing at its own pace. This round you turn up how strongly they notice and nudge each other, trying to get them all flashing in perfect time.',
    plainWhy:
      'When lots of separate things fall into the same rhythm all on their own, amazing order appears for free — real fireflies flash as one, heart cells beat together, and power grids stay in step. Understanding this helps us keep hearts and electricity running smoothly.',
    plainHow:
      "There's a tipping point: below a certain nudging strength the swarm stays a scattered mess and nothing lines up. Once you push past that point their togetherness starts climbing. To get them nearly perfectly in sync, don't just barely cross the line — turn the nudging up well beyond it.",
    terms: [
      {
        term: 'coupling',
        meaning: "how strongly each firefly senses and reacts to the others' flashes",
      },
      {
        term: 'coherence',
        meaning:
          'a score for how closely the whole swarm blinks together, from a scattered mess to perfectly as one',
      },
    ],
  },
  'sis-endemic-half': {
    plainWhat:
      'You are turning one dial that sets how easily a sickness spreads from person to person. Your aim is to make it settle so that, over the long run, half of everyone is infected at any time.',
    plainWhy:
      "Some illnesses never give you lasting protection, so you can catch them again and again. They don't disappear on their own; they stick around at a steady level we can only push down, so knowing what sets that level helps us plan care and keep it as low as we can.",
    plainHow:
      'Turn the spread dial too low and the illness fades toward almost no one; turn it too high and it climbs to fill most of the group. Somewhere in between it balances at exactly half, so nudge it until the long-term level rests right in the middle.',
    terms: [
      {
        term: 'Endemic level',
        meaning:
          'The steady share of people who stay infected over the long run once things settle.',
      },
      {
        term: 'No lasting immunity',
        meaning: "Getting better doesn't protect you, so you can catch the same illness again.",
      },
    ],
  },
  'folding-max-stability': {
    plainWhat:
      'You are setting the temperature at which this protein gives way and loses its shape, so its steadiest, most tightly folded point lands right at normal room warmth. Slide it until the protein holds its shape as firmly as possible at 25°C.',
    plainWhy:
      "A protein is a tiny living machine that only works when it holds its exact shape. If you can make one that keeps its shape at room temperature, medicines and lab kits can travel the world without being kept cold the whole way, reaching people in places that don't have reliable fridges or freezers.",
    plainHow:
      'Think of it like a comfort zone. Set the give-way point too high and the protein treats the room as "too cold" and can slowly come undone; set it too low and the room feels "too hot" and it starts to melt. The best spot sits balanced in between, right around room warmth.',
    terms: [
      {
        term: 'Protein folding',
        meaning: 'How a protein curls up into the exact shape it needs to do its job.',
      },
      {
        term: 'Melting temperature',
        meaning: 'The temperature where a protein gives way and starts to lose its shape.',
      },
      {
        term: 'Cold chain',
        meaning:
          'Keeping something chilled at every step, from the factory all the way to the patient.',
      },
    ],
  },
  'levins-tipping-point': {
    plainWhat:
      'You clear patches of wild habitat one round at a time, watching how many patches still have animals living in them. Your goal is to strip it down until only a sliver stays occupied, without wiping the animals out entirely.',
    plainWhy:
      'Real animals live spread across many little patches of forest, wetland, or meadow, hopping between them to survive. Bulldoze too many and the whole connected family of them can vanish all at once, so knowing exactly where that cliff-edge sits helps people protect just enough land to keep a species alive.',
    plainHow:
      'Clear too little and lots of patches stay full, overshooting your target. Clear too much and you shove the animals right off the cliff into nothing. The sweet spot for that razor-thin sliver sits somewhere before the total collapse point, so ease up as you get close.',
    terms: [
      {
        term: 'habitat patch',
        meaning: 'A single pocket of wild land, like one small wood, where animals can live',
      },
      { term: 'occupied', meaning: 'A patch that still has animals living in it right now' },
    ],
  },
  'replicator-hawk-dove': {
    plainWhat:
      'You are turning up how big a reward a bully-like "hawk" grabs when it wins a fight. As the prize changes, the crowd settles into a steady blend of fierce hawks and gentle doves, and you want that blend to land at 6 out of every 10 being hawks.',
    plainWhy:
      'This is how nature really decides how much fighting versus sharing shows up in a group of animals, plants, or even people. Nobody gives a speech about being nice or being tough. The rewards and costs quietly steer the whole crowd toward a balance that lasts, all on their own.',
    plainHow:
      'The bigger the prize for winning a fight, the more it pays to be fierce, so more of the crowd settles in as hawks. Make the prize tiny and fighting barely pays, so gentle doves rule and hawks stay rare. Keep raising the prize and hawks steadily take over more and more of the crowd. Your job is to stop at just the right spot: nudge the prize up bit by bit and watch the steady share of hawks climb until it reaches your target, no lower and no higher.',
    terms: [
      {
        term: 'hawk and dove',
        meaning:
          'two ways of acting in a clash: a hawk always fights, a dove backs down and shares',
      },
      {
        term: 'stable mix',
        meaning:
          'the steady blend the crowd settles into and stays at, because neither side can do better by switching',
      },
    ],
  },
  'beer-lambert-linear-range': {
    plainWhat:
      'You shine light through a coloured liquid and watch how much of the light the colour blocks. You water down the dye until the strongest reading lands at a nice, safe level.',
    plainWhy:
      'This is exactly how scientists check for pollution in a river. When the reading can be trusted, even a faint colour change can reveal how much of a harmful chemical is in the water, helping keep people, fish and wildlife safe.',
    plainHow:
      'The darker the liquid, the higher the reading, but past a certain point the machine gets overwhelmed and stops giving honest numbers. Too pale, and the reading is so weak it is easy to get wrong. Aim for a nice strong reading that still stays safely under the point where the machine starts to fib.',
    terms: [
      {
        term: 'absorbance',
        meaning:
          'a number for how much light a coloured liquid soaks up instead of letting through',
      },
    ],
  },
  'oxygen-transfer-aerate': {
    plainWhat:
      'You are turning up how hard air is bubbled and stirred into a tank full of hungry cells. Your job is to land the oxygen in the water at a comfortable half-full level.',
    plainWhy:
      "Tiny living microbes need oxygen to eat the gunk in a city's dirty water. Getting enough oxygen into the tank is exactly what lets them clean wastewater so it can safely go back to rivers and taps.",
    plainHow:
      'Turn it up too little and the busy cells gulp the oxygen faster than it arrives, so the level stays too low. Crank it way up and each extra push adds less and less, so you sail past half-full. The right setting sits at one particular spot in between.',
    terms: [
      {
        term: 'Aeration',
        meaning: 'Bubbling and stirring air into liquid so oxygen can soak into the water.',
      },
      {
        term: 'Dissolved oxygen',
        meaning:
          'How much breathable oxygen is actually mixed into the water for the cells to use.',
      },
    ],
  },
  'size-a-nanoparticle': {
    plainWhat:
      'You have a measured "jiggle-speed" for a tiny particle floating in liquid. Slide the particle-size dial up or down until the jiggle-speed matches that measurement.',
    plainWhy:
      "These tiny particles are the little carriers that ferry medicine through the body. Doctors and scientists can't put a ruler on something this small, so measuring how fast it jiggles is how they check a drug carrier is the right size, and safe, before it ever reaches a patient.",
    plainHow:
      'Small particles get bumped around and dart about quickly; big ones lumber along slowly. Make the particle too small and it jiggles too fast, too big and it barely moves. Slide the size until the jiggle-speed lands right on the target.',
    terms: [
      {
        term: 'jiggle (Brownian motion)',
        meaning:
          'the random dance a tiny particle does as unseen water molecules keep knocking into it',
      },
      {
        term: 'jiggle-speed (diffusion)',
        meaning: 'how fast a particle wanders and spreads out because of all that knocking',
      },
    ],
  },
  'fret-measure-distance': {
    plainWhat:
      'You have two tiny glowing tags that quietly pass energy to each other. You slide them closer or farther apart until they share exactly half the energy.',
    plainWhy:
      'This trick works like a ruler small enough to measure things inside a living cell, where nothing else can reach. Scientists use it to watch two molecules actually touch or drift apart, which helps them understand how our bodies work and how to design better medicines.',
    plainHow:
      'Move them too far apart and the tags barely share any energy; squeeze them too close and they share almost all of it. Somewhere in between is one special gap where the sharing lands right on half, so nudge toward that middle spot.',
    terms: [
      { term: 'tag', meaning: 'A tiny glowing marker stuck onto a molecule so you can spot it.' },
      {
        term: 'energy sharing',
        meaning:
          'How much energy one glowing tag hands over to the other; more sharing means they are closer together.',
      },
    ],
  },
  'buffer-blood-ph': {
    plainWhat:
      'You are picking a helper chemical that keeps a liquid from turning too sour or too soapy. You want one whose calm, steady spot matches your blood, which sits at a value of 7.4.',
    plainWhy:
      'Your blood has to stay at exactly the right sourness every single second, or your body simply stops working. The right helper is the quiet guardian that soaks up sudden changes and keeps you alive without you ever noticing.',
    plainHow:
      "Each helper chemical has one favorite value where it fights off changes the best, like a spring that pushes back hardest right at its middle. Pick one whose favorite spot sits too low and your liquid holds too sour; pick one too high and it holds too soapy. The winning helper is the one whose calm center lands right on blood's own value.",
    terms: [
      {
        term: 'buffer',
        meaning: 'A helper chemical that keeps a liquid from swinging too sour or too soapy',
      },
      {
        term: 'pH',
        meaning: 'A number that says how sour or soapy a liquid is; blood sits at 7.4',
      },
    ],
  },
  'right-shift-oxygen-delivery': {
    plainWhat:
      'You\'re setting how eagerly blood lets go of the oxygen it carries. Turn the "release nudge" up and the blood hands its oxygen off more easily.',
    plainWhy:
      'Hard-working muscle is hungry for oxygen. When blood can sense a busy, warm, tired muscle and drop off extra oxygen right there, you can run, lift, and keep going, and every cell gets the fuel it needs to stay alive.',
    plainHow:
      'Think of blood as a delivery truck: it picks oxygen up at the lungs and drops it off at the muscle. A bigger nudge makes it drop off more, but it also makes it pick up a little less at the lungs. Nudge too little and the muscle stays hungry; nudge too much and the truck arrives half-empty. The most oxygen actually delivered sits somewhere in the middle.',
    terms: [
      {
        term: 'P50',
        meaning:
          'A dial for how easily blood lets go of its oxygen; higher means it releases oxygen more readily.',
      },
    ],
  },
  'isotonic-iv-drip': {
    plainWhat:
      'You set how salty the drip fluid is. Your job is to match it to the saltiness of blood, not too weak and not too strong.',
    plainWhy:
      "This fluid goes straight into someone's vein, so it mixes right in with their blood. Get the saltiness right and it keeps their tiny blood cells safe and healthy. Get it wrong and those cells can swell up and pop, or shrink and wrinkle, which harms the patient.",
    plainHow:
      'Think of the salt as a tug-of-war over water moving in and out of each blood cell. Too little salt in the drip and water rushes into the cells until they burst; too much and water gets pulled out until they shrivel. The safe spot is right in the middle, where the drip is exactly as salty as blood and the water stops rushing either way.',
    terms: [
      {
        term: 'blood cells',
        meaning: 'the tiny red parts of your blood that carry oxygen around your body',
      },
      {
        term: 'saline',
        meaning: 'water with a little salt mixed in, the safe kind used in hospital drips',
      },
    ],
  },
  'reach-herd-immunity': {
    plainWhat:
      'You slide the vaccination coverage up or down to change how easily a disease hops from person to person. Your aim is to land right on the tipping point, where each sick person passes it to exactly one other.',
    plainWhy:
      "When enough people are protected, a disease keeps running into people it can't infect, so it fizzles out on its own. That shields babies, elders, and people too sick to get the shot, and it can stop a small flare-up from ever becoming a full-blown epidemic.",
    plainHow:
      "Too little coverage and the disease keeps finding fresh people to infect, so it grows. Too much and you've spent more effort and more shots than you actually needed. The sweet spot sits right in between, at the exact moment each sick person hands the illness to just one other.",
    terms: [
      {
        term: 'vaccination coverage',
        meaning: 'the share of people in a group who are protected against the disease',
      },
      {
        term: 'herd immunity',
        meaning:
          "when enough people are protected that a disease can no longer spread widely, which also shields those who aren't protected",
      },
    ],
  },
  'primer-melting-temp': {
    plainWhat:
      'You are setting how tightly a tiny DNA probe grips its target. Adjust that grip so the probe lets go exactly when the sample is heated to 60°C.',
    plainWhy:
      'These probes are the heart of medical tests that spot viruses and diseases. If a probe lets go at the wrong temperature, the test can miss what it is looking for or give a false alarm, so getting the grip right helps doctors trust the result.',
    plainHow:
      'Think of it like a handshake that only breaks when things get hot enough. Too weak a grip and the probe lets go too early, before 60°C; too strong and it hangs on past 60°C. The right answer sits in between, where letting-go happens right at 60°C.',
    terms: [
      {
        term: 'DNA probe',
        meaning:
          'A tiny made-to-order strand that sticks to one exact piece of genetic code to detect it.',
      },
      {
        term: 'PCR test',
        meaning:
          'A common lab method that copies DNA millions of times so even a trace of a virus becomes easy to spot.',
      },
    ],
  },
  'van-deemter-optimal-flow': {
    plainWhat:
      'You are setting how fast the liquid pushes through a tall tube that sorts a mix into separate parts. Your job is to pick the flow speed that makes each part show up as a clean, sharp band.',
    plainWhy:
      'Sharp, clean bands are how a lab knows exactly what is in a sample. That is what lets people purify a safe vaccine or read a blood test correctly, so a doctor can trust the answer.',
    plainHow:
      'Go too slow and the bands drift and blur while they wait. Go too fast and the parts cannot keep up and smear a different way. The cleanest result hides at a middling speed between those two, so nudge toward that balance point.',
    terms: [
      {
        term: 'separation column',
        meaning:
          'A long tube that sorts a mixture into its separate parts as liquid flows through it.',
      },
      {
        term: 'peaks',
        meaning:
          'The bumps on the read-out; a tall narrow bump means one part came out clean and clear.',
      },
    ],
  },
  'haldane-sweet-spot': {
    plainWhat:
      "You are feeding tiny living microbes and finding the just-right amount of food. Too little starves them, too much poisons them, so you're tuning how easily the food turns harmful to place their happiest amount at 15.",
    plainWhy:
      'These little microbes can eat up messes and pollution, and they do it fastest when the amount of "food" is just right. Getting that amount dialed in means faster, cleaner work in real cleanups.',
    plainHow:
      'Think of it like a seesaw. If the food barely bothers them, they keep wanting more and more, so their best amount drifts high. If even a little food upsets them fast, they get overwhelmed early and their best amount drops low. Nudge this dial until their happiest point lands right on 15 g/L.',
    terms: [
      {
        term: 'microbes',
        meaning: 'Tiny living things, too small to see, that can feed on and break down messes.',
      },
      {
        term: 'g/L (grams per liter)',
        meaning: 'A way to say how much food is packed into the water.',
      },
    ],
  },
  'poise-a-reaction': {
    plainWhat:
      'You are tuning a chemical reaction inside a warm body so it flows "downhill" just the right amount. You adjust how much the reaction spreads things out into disorder until its energy lands on the target.',
    plainWhy:
      'The same balancing act is how factories pull nitrogen from the air to make fertilizer, the stuff that helps grow enough food to feed billions of people. Get this balance right and life keeps running smoothly.',
    plainHow:
      'Two forces push against each other: one comes from heat given off or taken in, the other from things becoming more jumbled and spread out. Turn the disorder knob too low and the reaction barely wants to go; turn it too high and it races away out of control. The sweet spot sits calmly in between, right on the target.',
    terms: [
      {
        term: 'free energy',
        meaning:
          'A score for how much a reaction wants to happen on its own; lower means it flows forward more easily.',
      },
      {
        term: 'entropy',
        meaning:
          'A measure of how spread out and jumbled things are; more of it usually helps a reaction go.',
      },
    ],
  },
  'design-high-affinity-binder': {
    plainWhat:
      'You are designing a drug and choosing how tightly it grips its target on a cell. Your goal is to make it grip hard enough that, at a fixed dose, 9 out of every 10 targets are filled.',
    plainWhy:
      'A drug that grips its target tightly works at a lower, safer dose — that means fewer side effects and a better chance of helping. Tuning that grip is one of the first things drug designers optimise.',
    plainHow:
      'A tighter grip means fewer molecules are needed to fill the targets. Loosen the grip and the dose barely fills any; tighten it and a modest dose fills almost all. There is a sweet spot that lands you at exactly 9 in 10.',
    terms: [
      {
        term: 'receptor',
        meaning: 'the target on a cell that a drug latches onto.',
      },
      {
        term: 'grip strength (Kd)',
        meaning:
          'how much drug it takes to fill half the targets — a smaller number means a tighter grip.',
      },
      { term: 'occupancy', meaning: 'the share of targets currently filled, from none to all.' },
    ],
  },
  'time-a-fermentation': {
    plainWhat:
      'You are growing a batch of microbes to make something useful, and it needs to be ready on schedule. Tune how fast they multiply so the batch reaches 90% full in exactly 24 hours.',
    plainWhy:
      'In real fermentation — brewing, medicine, food — timing is everything. Too slow and you miss the deadline; too fast and you can sail past the best moment to harvest. Hitting the target time keeps a production line running smoothly.',
    plainHow:
      'A faster growth rate means the flask fills up and levels off sooner. Dial the growth speed up to reach the 90%-full mark earlier, or down to reach it later, until it lands right on 24 hours.',
    terms: [
      {
        term: 'carrying capacity',
        meaning: 'the most microbes the flask can hold, where growth finally stops.',
      },
      {
        term: 'growth rate',
        meaning: 'how fast the population multiplies while there is still room to grow.',
      },
      {
        term: '90% full',
        meaning: 'nearly at the plateau — a common point to harvest a culture.',
      },
    ],
  },
  'dim-the-glow': {
    plainWhat:
      'A molecule is glowing, and you add a quencher that dims it by bumping into it. Tune how much quencher you add so the glow drops to exactly half its brightness.',
    plainWhy:
      'Dimming a glow by a known amount is how scientists measure how exposed a glowing tag is — a clever, everyday trick for studying the shapes of proteins and other molecules.',
    plainHow:
      'Add too little quencher and the glow barely dims; add too much and it fades well below half. There is a just-right amount that lands it exactly halfway.',
    terms: [
      {
        term: 'quencher',
        meaning:
          'a molecule that dims a glow by bumping into the glowing one and draining its energy.',
      },
      {
        term: 'fluorescence',
        meaning: 'the glow a molecule gives off shortly after it soaks up light.',
      },
      {
        term: 'half-quenched',
        meaning: 'the point where the glow has dropped to 50% of its full brightness.',
      },
    ],
  },
  'carbon-date-a-bone': {
    plainWhat:
      "A bone is buried and slowly loses its carbon-14, which fades away at a steady, known pace. You're given how much is left and asked to work out how long ago the creature died.",
    plainWhy:
      'This is how archaeologists and biologists put real dates on ancient bones, tools, and fossils — reading the age straight out of how much of a fading atom remains. It is one of the most powerful clocks in science.',
    plainHow:
      'Every 5730 years, half the carbon-14 is gone. So a half left means one stretch of that time; a quarter left means two. Slide the age until the leftover amount matches what was measured.',
    terms: [
      {
        term: 'carbon-14',
        meaning:
          'a slowly-fading form of carbon that living things take in, then lose after they die.',
      },
      {
        term: 'half-life',
        meaning: 'the time for half of it to disappear — about 5730 years for carbon-14.',
      },
      {
        term: 'carbon dating',
        meaning: 'finding an age from the leftover amount of a fading atom.',
      },
    ],
  },
  'enzyme-for-60c': {
    plainWhat:
      "You're engineering an enzyme to do its best work in a hot 60°C process. Tune how much heat the enzyme can take (its melting temperature) so its sweet spot lands right on 60°C.",
    plainWhy:
      'Industrial processes — making biofuel, food, or medicine — often run hot to go faster and stay clean. An enzyme tuned to thrive at that heat, instead of falling apart, is worth a fortune to biotech.',
    plainHow:
      "If the enzyme melts too easily, it's already falling apart at 60°C and works poorly. If it's far too tough, 60°C is below its best. Raise its heat tolerance until its sweet spot sits exactly on 60°C.",
    terms: [
      {
        term: 'enzyme',
        meaning: 'a protein that speeds up a chemical reaction in a living thing.',
      },
      {
        term: 'melting temperature',
        meaning: 'how much heat the enzyme can take before it unravels and stops working.',
      },
      {
        term: 'optimal temperature',
        meaning: 'the sweet spot where the enzyme works fastest.',
      },
    ],
  },
  'uncover-gene-distance': {
    plainWhat:
      'In a breeding cross, two genes end up shuffled apart 40% of the time. You need to turn that number into the true distance between them along the chromosome.',
    plainWhy:
      'Finding the real distance between genes is how researchers zero in on the gene behind an inherited trait or disease — a cornerstone of genetics, from the very first fruit-fly maps to modern medicine.',
    plainHow:
      "For far-apart genes the shuffling can happen twice and undo itself, so the observed 40% actually hides a bigger true distance. Slide the true distance up until the model's shuffling rate matches the measured 40%.",
    terms: [
      {
        term: 'recombination',
        meaning: 'the shuffling that separates two genes onto different chromosome copies.',
      },
      {
        term: 'centimorgan',
        meaning: 'the unit of genetic distance; roughly the distance that gives 1% shuffling.',
      },
      {
        term: 'double crossover',
        meaning:
          'two swaps between the same two genes, which cancel out and make far genes look closer.',
      },
    ],
  },
  'live-long-grow-big': {
    plainWhat:
      'Bigger animals live longer, in a very regular way. Grow the body mass of an animal until its expected lifespan is three times that of a 1-kilogram creature.',
    plainWhy:
      'This surprising rule — size buys time — holds across mammals from mice to whales, and it is one of the clues to why lifespans differ so much. Understanding it helps biologists compare ageing across species.',
    plainHow:
      'Lifespan grows only slowly with size — as roughly the fourth root of mass — so you need a LOT more mass for a little more life. Nudge the mass up until the lifespan lands at three times the reference.',
    terms: [
      {
        term: 'metabolic rate',
        meaning: 'how fast an animal burns energy just to stay alive.',
      },
      {
        term: 'body mass',
        meaning: 'how heavy the animal is — the single number that sets the pace of its life.',
      },
      {
        term: 'lifespan scaling',
        meaning:
          'the rule that bigger animals live longer, in proportion to mass raised to a small power.',
      },
    ],
  },
  'carry-a-drug-across-a-membrane': {
    plainWhat:
      'Every cell is wrapped in a thin, oily skin. You are setting how greasy a drug is, which decides how fast it can seep across that skin. Your goal is to make the two sides even out at a set pace — closing half the gap in half a second.',
    plainWhy:
      'A medicine is useless if it cannot cross into the cells where it needs to act. Getting this greasiness just right is one of the real jobs of drug design: too little and the drug never gets in, too much and it gets stuck in the oily skin instead of passing through.',
    plainHow:
      'Greasier means faster crossing, so the two sides even out sooner. Turn the greasiness up and the evening-out speeds up; turn it down and it slows. Slide it until the pace matches the target — not the fastest, but the exact speed asked for.',
    terms: [
      {
        term: 'membrane',
        meaning: 'the thin, oily skin around a cell that a drug has to cross to get inside.',
      },
      {
        term: 'lipophilicity',
        meaning: 'how much a substance likes oil over water — how greasy it is.',
      },
      {
        term: 'half-equilibration time',
        meaning: 'how long it takes the two sides to close half the gap between them.',
      },
    ],
  },
  'reopen-a-narrowed-artery': {
    plainWhat:
      'A fatty deposit has narrowed a blood vessel, throttling the flow. You are widening the vessel — the way a stent does — until the blood flow climbs back to a healthy level.',
    plainWhy:
      'This is the heart of what a stent or an angioplasty does. Because flow depends so steeply on how wide the vessel is, even a small narrowing can starve tissue of blood, and even a small widening can bring it dramatically back. It is one of the most common life-saving procedures in medicine.',
    plainHow:
      'Widening the vessel helps far more than you would expect: the flow grows with the fourth power of the width, so doubling the width multiplies the flow sixteen-fold. Nudge the width up gently — you will reach the target flow well before the vessel is back to full size.',
    terms: [
      {
        term: 'vessel radius',
        meaning:
          'half the width of the blood vessel — the single biggest thing that sets the flow.',
      },
      {
        term: 'flow rate',
        meaning: 'how much blood passes through the vessel each second.',
      },
      {
        term: 'fourth-power law',
        meaning:
          'flow grows with width multiplied by itself four times, so small width changes have huge effects.',
      },
    ],
  },
  'how-aggressive-is-the-tumor': {
    plainWhat:
      'You are setting how aggressively a make-believe tumour grows. Starting from a tiny 1% seed, your goal is to make it fill exactly half of its maximum possible size by the deadline.',
    plainWhy:
      'Real tumours grow fastest while they are smallest and hardest to spot, then slow as they get large. Understanding that pattern is why early screening saves lives and helps doctors judge how urgently a tumour needs treating.',
    plainHow:
      'A more aggressive tumour fills up faster, but with diminishing returns — because growth slows as it gets big. Nudge the aggressiveness up from a crawl until it lands right at the halfway mark by the deadline: not so slow it stays small, not so fast it nearly fills up.',
    terms: [
      {
        term: 'carrying capacity',
        meaning: 'the largest size the tumour can reach, set by its room and blood supply.',
      },
      {
        term: 'growth aggressiveness',
        meaning: 'how hard the tumour pushes to grow — higher means it reaches its maximum sooner.',
      },
      {
        term: 'fraction of capacity',
        meaning:
          'how full the tumour is compared with its maximum size, from 0 (nothing) to 1 (full).',
      },
    ],
  },
};

/** The plain-language help card for a challenge, or null if none exists yet. */
export function helpForChallenge(id: string): HelpCard | null {
  return HELP_CARDS[id] ?? null;
}
