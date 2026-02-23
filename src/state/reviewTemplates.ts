import { ReviewTopic } from './types';

type ReviewTemplateMap = Record<string, Partial<Record<ReviewTopic, string[]>>>;

export const REVIEW_TEMPLATES: ReviewTemplateMap = {
  positive: {
    cleanliness: [
      'Spotless resort! Everything was clean and well-maintained.',
      'Impressed by how clean the facilities were.',
      'The cleaning staff does an amazing job here.',
    ],
    service: [
      'Staff was incredibly friendly and helpful!',
      'Outstanding service from start to finish.',
      'The team here really goes above and beyond.',
    ],
    food: [
      'The food was absolutely delicious!',
      'Great variety of food options. Something for everyone.',
      'Best barbecue I have ever had at a resort!',
    ],
    entertainment: [
      'So many fun activities! We never got bored.',
      'The kids loved the pool and arcade!',
      'Entertainment options were top-notch.',
    ],
    value: [
      'Great value for money. Will definitely return!',
      'Affordable and high quality. Perfect combination.',
      'Worth every penny we spent.',
    ],
    noise: [
      'Peaceful and quiet. Perfect for relaxation.',
      'Loved the calm atmosphere.',
    ],
    queues: [
      'Never had to wait for anything. Well organized!',
      'Quick service everywhere we went.',
    ],
    safety: [
      'Felt very safe the entire stay.',
      'Great security and well-lit pathways.',
    ],
  },
  neutral: {
    cleanliness: ['Resort was reasonably clean.', 'Cleanliness was acceptable.'],
    service: ['Service was okay, nothing special.', 'Staff was polite but not memorable.'],
    food: ['Food was decent but not exciting.', 'Average food options.'],
    entertainment: ['Some fun activities but could use more.', 'Entertainment was okay.'],
    value: ['Pricing was fair for what you get.', 'Average value.'],
    noise: ['It could be quieter at night.', 'Some noise but manageable.'],
    queues: ['Had to wait a bit at peak times.', 'Queues were manageable.'],
    safety: ['Felt okay safety-wise.', 'No concerns but nothing special.'],
  },
  negative: {
    cleanliness: [
      'The resort was dirty. Needs more cleaning staff!',
      'Disgusting! Found trash everywhere.',
      'Hygiene standards are terrible here.',
    ],
    service: [
      'Staff was rude and unhelpful.',
      'Worst service I have ever experienced.',
      'Nobody seemed to care about guest comfort.',
    ],
    food: [
      'Food was terrible. Made me sick!',
      'Very limited and bad quality food.',
      'Overpriced food that tasted awful.',
    ],
    entertainment: [
      'Nothing to do here. Extremely boring.',
      'Entertainment facilities were broken or closed.',
      'Kids were bored out of their minds.',
    ],
    value: [
      'Complete rip-off! Not worth the money.',
      'Way too expensive for what they offer.',
      'Would never pay these prices again.',
    ],
    noise: [
      'Could not sleep because of the noise!',
      'Music blasting all night. Terrible for families.',
      'The disco ruined our vacation.',
    ],
    queues: [
      'Had to wait forever for everything!',
      'Extremely overcrowded. No capacity management.',
      'Lines everywhere. Frustrating experience.',
    ],
    safety: [
      'Felt unsafe. Damaged buildings everywhere!',
      'No safety measures in place.',
      'Dangerous conditions after the storm.',
    ],
  },
};
