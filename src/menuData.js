// ─── BlendNBubbles menu data ─────────────────────────────────
// Single source of truth for the /menu page. Editing prices, items or copy
// here is all that is needed: the page renders from this array.
//
// Drink categories use type 'temp' with separate hot / cold prices; a null
// price means that temperature is not offered (rendered as a dash). Toppings
// use type 'single' with one price. `desc` is the customer-facing blurb.

export const MENU = [
  {
    id: 'soda',
    title: 'Soda',
    type: 'temp',
    items: [
      { name: 'Island Pineapple Punch', desc: 'Fizzy golden pineapple soda with pineapple popping boba and a hint of chaat masala.', hot: null, cold: 120 },
      { name: 'Spicy Pink Guava Punch', desc: 'Vivid pink guava soda over ice with orange popping boba.', hot: null, cold: 120 },
      { name: 'Zesty Lemon Twist', desc: 'Crisp, clear lemon soda with a fresh mint lift.', hot: null, cold: 120 },
      { name: 'Orange Burst Co.', desc: 'Bright orange soda with orange popping boba and a hint of chaat masala.', hot: null, cold: 120 },
      { name: 'Exotic Passion Splash', desc: 'Golden passion fruit soda with real seeds, mint and passion fruit popping boba.', hot: null, cold: 120 },
      { name: 'Kiwi Green Splash', desc: 'Fresh green kiwi soda over ice with kiwi popping boba.', hot: null, cold: 130 },
      { name: 'Hawaiian Sunset Fizz', desc: 'Tropical blue Hawaiian soda, fizzy and refreshing.', hot: null, cold: 120 },
      { name: 'Tangy Kachha Mango Twist', desc: 'Tangy raw mango (aam panna) soda with green apple popping boba and chaat masala.', hot: null, cold: 120 },
      { name: 'Lychee Blossom Fizz', desc: 'Delicate blush pink lychee rose soda with lychee popping boba.', hot: null, cold: 120 },
      { name: 'Peachy Summer Cooler', desc: 'Soft peach soda over ice with peach popping boba.', hot: null, cold: 120 },
    ],
  },
  {
    id: 'milk-tea',
    title: 'Milk Tea',
    type: 'temp',
    items: [
      { name: 'Indian Boba Fusion', desc: 'Spiced masala chai milk tea with chewy tapioca pearls.', hot: 119, cold: 159 },
      { name: 'Taiwan Classic Boba', desc: 'Authentic Taiwanese signature milk tea with chewy tapioca pearls.', hot: 129, cold: 179 },
      { name: 'Thai Sunset', desc: 'Bright Thai milk tea in creamy ombre layers with tapioca pearls.', hot: 139, cold: 179 },
      { name: 'Royal Taro Mist', desc: 'Pastel taro milk tea, creamy and smooth, with tapioca pearls.', hot: 139, cold: 179 },
      { name: 'Assam Garden Brew', desc: 'Rich Assam milk tea, smooth and malty, with tapioca pearls.', hot: 139, cold: 179 },
      { name: 'Madagascar Vanilla Tea', desc: 'Creamy vanilla milk tea with tapioca pearls.', hot: 139, cold: 179 },
    ],
  },
  {
    id: 'fruit-tea',
    title: 'Fruit Tea',
    type: 'temp',
    items: [
      { name: 'Mango Jade Splash', desc: 'Mango fruit tea over ice, light and refreshing.', hot: null, cold: 165 },
      { name: 'Raw Mango Mist Pop', desc: 'Raw mango green tea, light and tangy, no milk.', hot: null, cold: 165 },
      { name: 'Passion Fruit Rush', desc: 'Zingy passion fruit tea over ice.', hot: null, cold: 170 },
      { name: 'Orange Ginger Spark', desc: 'Orange fruit tea with a warming ginger kick.', hot: null, cold: 165 },
      { name: 'Taiwan Pink Guava Splash', desc: 'Pink guava fruit tea over ice.', hot: null, cold: 165 },
      { name: 'Tropical Pineapple Pop', desc: 'Golden pineapple fruit tea with pineapple popping boba.', hot: null, cold: 165 },
      { name: 'Kiwi Island Tea', desc: 'Fresh green kiwi fruit tea with kiwi popping boba.', hot: null, cold: 175 },
    ],
  },
  {
    id: 'coffee',
    title: 'Coffee',
    type: 'temp',
    items: [
      { name: 'Caramel Boba Coffee', desc: 'Smooth iced coffee with caramel and coffee boba.', hot: 149, cold: 179 },
      { name: 'Cafe Mocha', desc: 'Espresso, milk and chocolate over ice with chocolate boba.', hot: null, cold: 179 },
      { name: 'Classic Boba Brew', desc: 'Classic iced milk coffee with chewy tapioca pearls.', hot: 119, cold: null },
      { name: 'Biscoff Boba Coffee', desc: 'Creamy iced coffee topped with crushed Biscoff and tapioca pearls.', hot: 149, cold: 179 },
      { name: 'Brown Sugar Macchiato', desc: 'Brown sugar tiger-stripe coffee with coffee boba and choco chips.', hot: 139, cold: 169 },
    ],
  },
  {
    id: 'smoothie',
    title: 'Smoothie',
    type: 'temp',
    items: [
      { name: 'Mango Chill Vibe', desc: 'Thick blended mango smoothie with mango popping boba.', hot: null, cold: 169 },
      { name: 'Strawberry Chill', desc: 'Thick blended strawberry smoothie, cool and creamy.', hot: null, cold: 169 },
      { name: 'Blueberry Blend', desc: 'Thick blended blueberry smoothie, cool and creamy.', hot: null, cold: 185 },
      { name: 'Cheesy Mango Melt', desc: 'Blended mango smoothie topped with a savoury-sweet cheese foam.', hot: null, cold: 179 },
      { name: 'Blackcurrant Cream Bliss', desc: 'Creamy blended blackcurrant smoothie.', hot: null, cold: 179 },
    ],
  },
  {
    id: 'matcha',
    title: 'Matcha',
    type: 'temp',
    items: [
      { name: 'Kyoto Matcha Latte', desc: 'Stone-ground matcha latte, creamy over ice.', hot: 139, cold: 179 },
      { name: 'Rose Matcha Velvet', desc: 'Matcha latte with a delicate rose finish.', hot: null, cold: 179 },
      { name: 'Tropical Matcha', desc: 'Matcha latte with a tropical fruit twist.', hot: null, cold: 179 },
      { name: 'Creamy Vanilla Matcha', desc: 'Layered matcha and vanilla milk with tapioca pearls.', hot: null, cold: 179 },
    ],
  },
  {
    id: 'chocolate',
    title: 'Chocolate',
    type: 'temp',
    items: [
      { name: 'Hot Cocoa Cloud', desc: 'Rich hot chocolate under a whipped-cream cloud with a cocoa dusting.', hot: 199, cold: null },
      { name: 'Choco Ice Swirl', desc: 'Iced chocolate, blended cool and creamy.', hot: null, cold: 185 },
    ],
  },
  {
    id: 'add-ons',
    title: 'Add-Ons & Toppings',
    type: 'single',
    items: [
      { name: 'Tapioca (Boba)', price: 50 },
      { name: 'Coconut Jelly', price: 50 },
      { name: 'Chocolate Popping Boba', price: 40 },
      { name: 'Coffee Popping Boba', price: 40 },
      { name: 'Orange Popping Boba', price: 40 },
      { name: 'Blueberry Popping Boba', price: 40 },
      { name: 'Cherry Popping Boba', price: 40 },
      { name: 'Green Apple Popping Boba', price: 40 },
      { name: 'Passion Fruit Popping Boba', price: 40 },
      { name: 'Mango Popping Boba', price: 40 },
      { name: 'Peach Popping Boba', price: 40 },
      { name: 'Honey Aloevera Jelly', price: 40 },
      { name: 'Chia Seeds', price: 25 },
      { name: 'Packing', price: 10 },
    ],
  },
];
