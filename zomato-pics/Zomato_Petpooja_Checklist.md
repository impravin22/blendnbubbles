# Getting the 2026 menu live on Zomato (via Petpooja)

**Status today:** the Zomato channel in Petpooja still holds the OLD menu (~21 items in the four "- 25" categories). The new 2026 categories (Soda, Matcha, Chocolate, etc.) exist in the Zomato channel but are **empty**. Last push to Zomato was **26 Jan 2026**. Nothing new will show on Zomato until the items are added to the Zomato channel and the menu is triggered.

**Two decisions already made (David):**
- **Images:** Petpooja pushes item images to Zomato, so upload them in Petpooja (no need to touch the Zomato dashboard).
- **Hot drinks:** not going on Zomato. So we list **cold variation only**, and skip the two hot items entirely.

---

## What goes on Zomato (40 items, cold only)

Skip these 2 (hot): **Hot Cocoa Cloud**, **Hong Kong Silk Tea**.

| Category | Items to add (cold) |
|---|---|
| Soda 26 (11) | Island Pineapple Punch, Spicy Pink Guava Punch, Zesty Lemon Twist, Orange Burst Co., Exotic Passion Splash, Kiwi Green Splash, Hawaiian Sunset Fizz, Tangy Kachha Mango Twist, Lychee Blossom Fizz, Peachy Summer Cooler, *Pomelo Passion Twist (off-menu, confirm)* |
| Coffee 26 (5) | Caramel Boba Coffee, Cafe Mocha, Classic Boba Brew, Biscoff Boba Coffee, Brown Sugar Macchiato |
| Fruit Tea 26 (8) | Mango Jade Splash, Raw Mango Mist Pop, Passion Fruit Rush, Orange Ginger Spark, Taiwan Pink Guava Splash, Tropical Pineapple Pop, Kiwi Island Tea, *Peach Pomelo Burst (off-menu, confirm)* |
| Milk Tea 26 (6) | Indian Boba Fusion, Taiwan Classic Boba, Thai Sunset, Royal Taro Mist, Assam Garden Brew, Madagascar Vanilla Tea |
| Matcha 26 (4) | Kyoto Matcha Latte, Rose Matcha Velvet, Tropical Matcha, Creamy Vanilla Matcha |
| Smoothie 26 (5) | Mango Chill Vibe, Strawberry Chill, Cheesy Mango Melt, Blackcurrant Cream Bliss, Blueberry Blend |
| Chocolate 26 (1) | Choco Ice Swirl |

Two of those (Pomelo Passion Twist, Peach Pomelo Burst) are not on the printed menu. List them on Zomato only if you actually sell them; otherwise drop and it's 38 items.

---

## The steps (in Petpooja)

Do NOT delete the old "- 25" menu until the new one is verified live, or there will be a gap where Zomato shows nothing.

### Step 1 — Open the Zomato channel menu
Petpooja → left nav **Menu → Menu & Discounts → Manage Menu** → click the **Zomato** tile → **Items** dropdown should read "Zomato".

### Step 2 — Fill each new category
For each new category in the left sidebar (Soda, Coffee, Fruit Tea, Milk Tea, Matcha, Smoothie, Chocolate):
1. Click the category.
2. Click **Add Items** (top right).
3. Tick the 2026 items that belong in that category (from the table above).
4. Save.

> The empty new categories already exist; you're just pulling items into them. Use the display names listed above.

### Step 3 — Set each item up correctly
For every item you added, in the Zomato item list:
- **Price:** make sure a real price shows (not 0). On the 2026 items the item base price was 0; the price sits on the Cold variation, so confirm the cold price is correct.
- **"O" marker (Expose in online order):** must be ON. If an item's edit page is open, that's the **"Online Orders"** checkbox under **"Expose This Items In"** (it was OFF on the new items).
- **Available toggle:** ON (blue).
- **Variation = Cold only.** Open the item's **Variation Details** (the "V" marker). Keep the **Cold [350ML]** row active with its price; for the **Hot [250 ML]** row, deactivate it **for Zomato**. (See the support question doc, this may affect dine-in too, confirm with Petpooja first.)

### Step 4 — Add the images
Petpooja → **Menu → Multi-Item Images Upload**. Upload the 40 pics from the `New_menu_without_sparkles` folder, matching each to its item by name.
- First, strip the trailing space from 8 filenames (e.g. `Biscoff Boba Coffee .png` → `Biscoff Boba Coffee.png`) so the name matches exactly. (I can do this for you in one go.)
- Skip the 2 hot-item images (Hot Cocoa Cloud, Hong Kong Silk Tea).
- These are AI-generated images. Zomato reviews images for authenticity, so some may be flagged. Worth uploading a known-real photo or two as backup.

### Step 5 — Push to Zomato
In the Zomato menu, click **Menu Trigger** (top bar). Wait for the "Last Menu Triggered" banner to update to today with **Status: Success**.

### Step 6 — Verify on the live listing
Open the Zomato page (zomato.com → Blend N Bubbles, Barrackpore). Check the new categories show, prices are right, images appear, and there are no leftover duplicates from the old menu.

### Step 7 — Remove the old menu (only after Step 6 passes)
Once the new menu is confirmed live and correct, delete or empty the old **"- 25" categories** (Milk Tea - 25, Fruit Tea Fusions - 25, Smoothies - 25, Coffee - 25) so customers don't see the old names. Trigger again, verify.

---

## Quick-check before you trigger
- [ ] Every new item has a price > 0
- [ ] Every new item has "Online Orders" / "O" ON
- [ ] Available toggle ON
- [ ] Cold variation set, Hot deactivated for Zomato
- [ ] Images uploaded and matched (filenames cleaned)
- [ ] Hot Cocoa Cloud + Hong Kong Silk Tea NOT added
- [ ] Off-menu pair (Pomelo Passion Twist, Peach Pomelo Burst): decided in/out
- [ ] Old "- 25" categories left in place until new menu verified

## Honest flags
- **Choco Ice Swirl** has no recipe in Petpooja (recipe was empty). That doesn't block listing it, but it won't deduct inventory until a recipe is built, and it needs a price.
- Per-variation on/off (cold-only) might affect all channels, not just Zomato. Confirm with Petpooja before turning Hot off (see support questions doc).
- I won't hit Menu Trigger or push anything live myself, that's your call to make.
