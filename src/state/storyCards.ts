import { StoryCard } from './types';

export const STORY_CARDS: StoryCard[] = [
  // ── Deterministic Stories (simple, immediate outcomes) ─────────────
  {
    id: 'lost_teddy',
    title: 'Lost Teddy Bear',
    description: 'A child from a family guest has lost their favorite teddy bear somewhere on the beach. The parents are asking for help finding it.',
    segment: 'family',
    options: [
      {
        id: 'return_teddy',
        label: 'Search and return it ($120)',
        effects: { money: -120, reputation: 2, segmentHappiness: { family: 8 } },
      },
      {
        id: 'ignore_teddy',
        label: 'Not our problem',
        effects: { reputation: -1, segmentHappiness: { family: -5 } },
      },
    ],
  },
  {
    id: 'food_allergy',
    title: 'Food Allergy Incident',
    description: 'A guest had an allergic reaction after eating at the restaurant. They are upset and threatening to leave a bad review.',
    options: [
      {
        id: 'comp_meal',
        label: 'Complimentary meal + apology ($600)',
        effects: { money: -600, reputation: 2 },
      },
      {
        id: 'deny_allergy',
        label: 'Deny responsibility',
        effects: {
          reputation: -2, socialHeat: 3,
          delayedEffect: { daysLater: 2, logEntry: { day: 0, category: 'reputation', label: 'Allergy incident review surfaced', delta: -3, causeId: 'story_food_allergy' } },
        },
      },
      {
        id: 'upgrade_package',
        label: 'Upgrade their package free ($900)',
        effects: { money: -900, reputation: 4 },
      },
    ],
  },
  {
    id: 'noisy_neighbors',
    title: 'Noisy Neighbors',
    description: 'Several guests are complaining about loud music from events keeping them up at night. They want action.',
    options: [
      {
        id: 'move_guests',
        label: 'Relocate complainers (temporary -2 capacity)',
        effects: { segmentHappiness: { family: 3, couple: 3 } },
      },
      {
        id: 'ignore_noise',
        label: 'Ignore complaints',
        effects: {
          segmentHappiness: { family: -4, couple: -3 },
          delayedEffect: { daysLater: 1, logEntry: { day: 0, category: 'reputation', label: 'Noise complaints piled up', delta: -2, causeId: 'story_noise' } },
        },
      },
    ],
  },
  {
    id: 'vip_privacy',
    title: 'VIP Privacy Complaint',
    description: 'A VIP guest is upset that other guests keep taking photos of them. They demand more privacy or they leave.',
    segment: 'vip',
    options: [
      {
        id: 'extra_security',
        label: 'Hire extra security ($600)',
        effects: { money: -600, segmentHappiness: { vip: 8 } },
      },
      {
        id: 'ignore_vip',
        label: 'Cannot control other guests',
        effects: { segmentHappiness: { vip: -8 }, reputation: -2 },
      },
    ],
  },
  {
    id: 'staff_dispute',
    title: 'Staff Dispute',
    description: 'Two staff members got into a heated argument in front of guests. Some guests look uncomfortable.',
    options: [
      {
        id: 'mediate_dispute',
        label: 'Mediate and resolve',
        effects: { reputation: 1 },
      },
      {
        id: 'fire_one',
        label: 'Fire the instigator',
        effects: {
          delayedEffect: { daysLater: 2, logEntry: { day: 0, category: 'happiness', label: 'Staff shortage after firing', delta: -2, causeId: 'story_staff_fired' } },
        },
      },
      {
        id: 'ignore_dispute',
        label: 'Let them sort it out',
        effects: { segmentHappiness: { family: -2, vip: -3 } },
      },
    ],
  },
  {
    id: 'found_wallet',
    title: 'Found Wallet',
    description: 'A guest left a wallet containing $3,000 in their room after checking out. You could try to return it or keep it.',
    options: [
      {
        id: 'return_wallet',
        label: 'Return the wallet',
        effects: {
          reputation: 3, segmentHappiness: { family: 2, couple: 2, vip: 2, nomad: 2 },
          delayedEffect: { daysLater: 3, logEntry: { day: 0, category: 'reputation', label: 'Grateful guest shared story online', delta: 2, causeId: 'story_wallet_returned' } },
        },
      },
      {
        id: 'keep_wallet',
        label: 'Keep the money (+$3,000)',
        effects: {
          money: 3000,
          delayedEffect: { daysLater: 3, logEntry: { day: 0, category: 'reputation', label: 'Guest complained about missing wallet', delta: -5, causeId: 'story_wallet_kept' } },
        },
      },
    ],
  },
  {
    id: 'stray_dog',
    title: 'Stray Dog on Beach',
    description: 'A friendly stray dog has been hanging around the beach. Families love it, but VIP guests are not impressed.',
    options: [
      {
        id: 'adopt_dog',
        label: 'Adopt as resort mascot',
        effects: { segmentHappiness: { family: 5, nomad: 3, vip: -3 }, reputation: 1 },
      },
      {
        id: 'remove_dog',
        label: 'Call animal control',
        effects: { segmentHappiness: { vip: 2, family: -4 } },
      },
      {
        id: 'ignore_dog',
        label: 'Let it stay for now',
        effects: {
          delayedEffect: { daysLater: 2, logEntry: { day: 0, category: 'reputation', label: 'Dog dug up the beach garden', delta: -1, causeId: 'story_dog_mess' } },
        },
      },
    ],
  },

  // ── Probabilistic Stories (risky decisions with uncertain outcomes) ─

  {
    id: 'influencer_freebies',
    title: 'Influencer Wants Freebies',
    description: 'A social media influencer with 50K followers wants a free stay in exchange for posting about your resort. There are no guarantees it will work.',
    options: [
      {
        id: 'free_stay',
        label: 'Offer free stay',
        cost: 1800,
        hint: '55% viral success, 30% mild buzz, 15% total flop',
        resolveDays: 2,
        outcomes: [
          { probability: 0.55, label: 'Influencer post went viral — bookings surging!',
            effects: { socialHeat: 20, reputation: 4 } },
          { probability: 0.30, label: 'Post got some likes, nothing special',
            effects: { socialHeat: 6, reputation: 1 } },
          { probability: 0.15, label: 'Influencer never posted — wasted investment',
            effects: { socialHeat: -2 } },
        ],
      },
      {
        id: 'decline_influencer',
        label: 'No freebies',
        effects: {},
      },
      {
        id: 'negotiate_influencer',
        label: 'Half-price deal',
        cost: 900,
        hint: '40% decent exposure, 40% minor buzz, 20% nothing',
        resolveDays: 2,
        outcomes: [
          { probability: 0.40, label: 'Influencer posted a decent story about the resort',
            effects: { socialHeat: 10, reputation: 2 } },
          { probability: 0.40, label: 'Brief mention in a story — barely noticed',
            effects: { socialHeat: 3 } },
          { probability: 0.20, label: 'Influencer posted a snarky half-hearted review',
            effects: { reputation: -1, socialHeat: 2 } },
        ],
      },
    ],
  },
  {
    id: 'proposal_request',
    title: 'Proposal Request',
    description: 'A couple wants to set up a romantic private beach dinner for a surprise proposal. They are willing to pay, but want it perfect — and perfection is never guaranteed.',
    segment: 'couple',
    options: [
      {
        id: 'arrange_proposal',
        label: 'Arrange it',
        cost: 1200,
        hint: '70% magical evening, 20% nice but not perfect, 10% something goes wrong',
        resolveDays: 1,
        outcomes: [
          { probability: 0.70, label: 'The proposal was magical — they are telling everyone!',
            effects: { reputation: 4, socialHeat: 8, segmentHappiness: { couple: 15 } } },
          { probability: 0.20, label: 'Nice evening, but the couple expected more',
            effects: { reputation: 1, segmentHappiness: { couple: 4 } } },
          { probability: 0.10, label: 'Waiter spilled wine on the ring box — awkward',
            effects: { reputation: -2, segmentHappiness: { couple: -5 } } },
        ],
      },
      {
        id: 'decline_proposal',
        label: 'We do not offer that service',
        effects: {},
      },
    ],
  },
  {
    id: 'local_festival',
    title: 'Local Festival Partnership',
    description: 'The nearby town is hosting a festival and offers a partnership. It could boost traffic — or the festival might be a dud this year.',
    options: [
      {
        id: 'sponsor_festival',
        label: 'Co-sponsor the festival',
        cost: 1500,
        hint: '50% great turnout, 35% modest traffic, 15% rained out',
        resolveDays: 2,
        outcomes: [
          { probability: 0.50, label: 'Festival was a huge hit — resort traffic surged!',
            effects: { reputation: 5, socialHeat: 12 } },
          { probability: 0.35, label: 'Modest turnout — some extra visitors came',
            effects: { reputation: 2, socialHeat: 4 } },
          { probability: 0.15, label: 'Festival rained out — almost nobody showed up',
            effects: { reputation: -1 } },
        ],
      },
      {
        id: 'decline_festival',
        label: 'Not interested',
        effects: {},
      },
    ],
  },

  // ── Unlock-gated probabilistic stories ────────────────────────────

  {
    id: 'date_night',
    title: 'Date Night Request',
    description: 'A couple asks you to arrange a special candlelit dinner at the restaurant. The a-la-carte menu is available — but a perfect evening is never guaranteed.',
    segment: 'couple',
    requiredUnlock: 'date_night',
    options: [
      {
        id: 'arrange_dinner',
        label: 'Reserve a private table',
        cost: 750,
        hint: '65% romantic success, 25% pleasant but forgettable, 10% kitchen mishap',
        resolveDays: 1,
        outcomes: [
          { probability: 0.65, label: 'A truly romantic evening — couple left thrilled!',
            effects: { reputation: 4, segmentHappiness: { couple: 12 } } },
          { probability: 0.25, label: 'Pleasant dinner, but nothing memorable',
            effects: { reputation: 1, segmentHappiness: { couple: 4 } } },
          { probability: 0.10, label: 'Kitchen sent the wrong dish — couple disappointed',
            effects: { reputation: -1, segmentHappiness: { couple: -3 } } },
        ],
      },
      {
        id: 'free_upgrade',
        label: 'Upgrade to wine pairing',
        cost: 1200,
        hint: '60% viral photo moment, 30% lovely evening, 10% wine spill disaster',
        resolveDays: 2,
        outcomes: [
          { probability: 0.60, label: 'Couple shared stunning dinner photos online!',
            effects: { reputation: 5, socialHeat: 8, segmentHappiness: { couple: 18 } } },
          { probability: 0.30, label: 'Great pairing, couple very satisfied',
            effects: { reputation: 3, segmentHappiness: { couple: 10 } } },
          { probability: 0.10, label: 'Sommelier recommended a bad pairing — awkward evening',
            effects: { reputation: -2, segmentHappiness: { couple: -5 } } },
        ],
      },
      {
        id: 'decline_date',
        label: 'We are fully booked tonight',
        effects: { segmentHappiness: { couple: -5 } },
      },
    ],
  },
  {
    id: 'celebrity_visit',
    title: 'Celebrity Wants Fine Dining',
    description: 'A famous food critic is visiting your resort. A rave review could put you on the map — but a bad one could be devastating. There are no guarantees.',
    segment: 'vip',
    requiredUnlock: 'celebrity_visit',
    options: [
      {
        id: 'vip_treatment',
        label: 'Full VIP treatment',
        cost: 1800,
        hint: '50% rave review, 30% decent mention, 20% harsh criticism',
        resolveDays: 3,
        outcomes: [
          { probability: 0.50, label: 'Food critic published a glowing review!',
            effects: { reputation: 6, socialHeat: 15, segmentHappiness: { vip: 12 } } },
          { probability: 0.30, label: 'Critic gave a fair but unremarkable review',
            effects: { reputation: 2, socialHeat: 5 } },
          { probability: 0.20, label: 'Critic found the experience lacking — negative review published',
            effects: { reputation: -3, socialHeat: 8, segmentHappiness: { vip: -5 } } },
        ],
      },
      {
        id: 'standard_service',
        label: 'Standard service, no special treatment',
        effects: { reputation: 1 },
      },
      {
        id: 'decline_critic',
        label: 'Ask them to leave — too risky',
        effects: { segmentHappiness: { vip: -10 }, socialHeat: 5 },
      },
    ],
  },
  {
    id: 'wellness_retreat',
    title: 'Wellness Retreat Request',
    description: 'A group wants to organize a wellness day using your spa. It could boost your wellness reputation — or overwhelm your staff.',
    requiredUnlock: 'wellness_retreat',
    options: [
      {
        id: 'host_retreat',
        label: 'Host full retreat day',
        cost: 1500,
        hint: '55% rave reviews, 30% decent day, 15% staff overwhelmed',
        resolveDays: 2,
        outcomes: [
          { probability: 0.55, label: 'Retreat guests left 5-star wellness reviews!',
            effects: { reputation: 5, segmentHappiness: { couple: 10, vip: 8 } } },
          { probability: 0.30, label: 'Guests enjoyed it but nothing spectacular',
            effects: { reputation: 2, segmentHappiness: { couple: 4 } } },
          { probability: 0.15, label: 'Staff was overwhelmed — some guests left unhappy',
            effects: { reputation: -2, segmentHappiness: { couple: -3, vip: -3 } } },
        ],
      },
      {
        id: 'partial_retreat',
        label: 'Offer basic spa access only',
        effects: { reputation: 1, segmentHappiness: { couple: 3 } },
      },
      {
        id: 'decline_retreat',
        label: 'Not enough staff for a retreat',
        effects: { segmentHappiness: { couple: -3, vip: -3 } },
      },
    ],
  },
  {
    id: 'family_loyalty',
    title: 'Returning Family — Premium Kids Club',
    description: 'A family that visited before wants to come back for the Kids Club. They want a family deal — but will the word-of-mouth actually materialize?',
    segment: 'family',
    requiredUnlock: 'family_loyalty',
    options: [
      {
        id: 'family_deal',
        label: 'Offer 10% discount on extended stay',
        cost: 900,
        hint: '60% strong word-of-mouth, 30% happy but quiet, 10% they complain anyway',
        resolveDays: 3,
        outcomes: [
          { probability: 0.60, label: 'Family recommended resort to multiple friends!',
            effects: { reputation: 5, segmentHappiness: { family: 15 } } },
          { probability: 0.30, label: 'Family happy but did not spread the word',
            effects: { reputation: 2, segmentHappiness: { family: 8 } } },
          { probability: 0.10, label: 'Family felt the discount was not enough — left a mixed review',
            effects: { reputation: -1, segmentHappiness: { family: -2 } } },
        ],
      },
      {
        id: 'standard_booking',
        label: 'Standard rates, no deal',
        effects: { segmentHappiness: { family: -2 } },
      },
      {
        id: 'premium_family',
        label: 'Free kids club upgrade + welcome gift',
        cost: 1500,
        hint: '55% social media viral, 35% grateful family, 10% kids broke something',
        resolveDays: 2,
        outcomes: [
          { probability: 0.55, label: 'Family shared Kids Club experience on social media — went viral!',
            effects: { reputation: 6, socialHeat: 10, segmentHappiness: { family: 20 } } },
          { probability: 0.35, label: 'Family very grateful, booked again next year',
            effects: { reputation: 3, segmentHappiness: { family: 12 } } },
          { probability: 0.10, label: 'Kids broke equipment during the welcome party — extra costs',
            effects: { money: -900, reputation: -1, segmentHappiness: { family: 3 } } },
        ],
      },
    ],
  },
  {
    id: 'nomad_community',
    title: 'Digital Nomad Meetup',
    description: 'A popular nomad blogger wants to host a community meetup at your coworking space. Could attract more nomads — or be a waste of time.',
    segment: 'nomad',
    requiredUnlock: 'nomad_community',
    options: [
      {
        id: 'host_meetup',
        label: 'Host the meetup',
        cost: 600,
        hint: '50% attracts remote workers, 35% nice event, 15% blogger no-show',
        resolveDays: 2,
        outcomes: [
          { probability: 0.50, label: 'Meetup attracted remote workers — bookings up!',
            effects: { reputation: 3, socialHeat: 12, segmentHappiness: { nomad: 15 } } },
          { probability: 0.35, label: 'Nice event, a few new contacts made',
            effects: { reputation: 1, socialHeat: 4, segmentHappiness: { nomad: 6 } } },
          { probability: 0.15, label: 'Blogger cancelled last minute — almost nobody showed up',
            effects: { segmentHappiness: { nomad: -3 } } },
        ],
      },
      {
        id: 'decline_meetup',
        label: 'Coworking space is for work, not parties',
        effects: { segmentHappiness: { nomad: -5 } },
      },
    ],
  },
  {
    id: 'grand_event',
    title: 'Grand Event Opportunity',
    description: 'A local organizer wants to rent your event space for a weekend gala. High prestige potential — but also high risk of noise complaints and wear.',
    requiredUnlock: 'grand_event',
    options: [
      {
        id: 'host_gala',
        label: 'Host the gala (earn $3,000)',
        cost: 0,
        hint: '45% huge success, 35% decent night, 20% noise disaster',
        resolveDays: 1,
        outcomes: [
          { probability: 0.45, label: 'Gala was a huge success — covered by local press!',
            effects: { money: 3000, reputation: 6, socialHeat: 15, segmentHappiness: { vip: 10, couple: 6 } } },
          { probability: 0.35, label: 'Decent event, some extra revenue and exposure',
            effects: { money: 3000, reputation: 2, socialHeat: 5 } },
          { probability: 0.20, label: 'Gala got out of control — noise complaints and damage',
            effects: { money: 1200, reputation: -3, segmentHappiness: { family: -8, vip: -3 } } },
        ],
      },
      {
        id: 'small_event',
        label: 'Offer smaller, quieter version ($1,200)',
        effects: { money: 1200, reputation: 2 },
      },
      {
        id: 'decline_gala',
        label: 'Too much risk — decline',
        effects: {},
      },
    ],
  },
];
