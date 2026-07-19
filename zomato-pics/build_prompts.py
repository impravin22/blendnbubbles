# -*- coding: utf-8 -*-

CAMERA = ("Camera & framing (LOCKED, identical for every image): match the Cafe Mocha reference photo's "
"camera distance but pulled back a few inches, so the cup sits a touch smaller in frame with more empty space "
"around it. Single drink dead-centre, eye-level, 50mm lens, shallow depth of field. The cup fills roughly the "
"middle 38-40% of the frame width and about 70% of the height, base sitting ~80% down. Two-tone studio backdrop "
"(soft muted wall meeting a pale cream tabletop), gentle diffused side-light, soft shadow, calm slightly-"
"desaturated grade. Photo-realistic, high detail, appetising, clean and minimal with generous negative space. "
"No extra text, no watermark, no people, no hands. Portrait framing ~4:5.")

LOGO = ("Logo: place the Blend N Bubbles green circular logo (uploaded as the logo reference image) flat and "
"front-facing on the cup, centred, crisp and undistorted, same size and position as in the reference photo.")

# drink: (number, name, shortcode, cup, reference photo, body)
DRINKS = [
("SODA 26", [
 (1,"Island Pineapple Punch","26SOD01","350ml clear PET cup, domed lid, straw","sweet-peach-bubble-tea.webp",
  "A PINEAPPLE SODA: bright golden-yellow fizzy translucent soda with carbonation bubbles and ice, a layer of pale-yellow pineapple popping boba settled at the bottom. Garnish at the base: a fresh pineapple wedge and a small dish of pineapple popping boba. Warm tan or cream backdrop.",
  "pineapple syrup + soda + pineapple popping boba + sugar + a pinch of chaat masala",""),
 (2,"Spicy Pink Guava Punch","26SOD02","350ml clear PET cup, domed lid, straw","red-grapefruit-tea-pop.webp",
  "A PINK GUAVA SODA: vivid pink-coral fizzy translucent soda, carbonation bubbles, ice, a layer of orange popping boba at the bottom. Garnish at the base: a halved pink guava and a few orange popping boba. Muted green backdrop.",
  "red guava syrup + sugar + soda + orange popping boba",""),
 (3,"Zesty Lemon Twist","26SOD03","350ml clear PET cup, domed lid, straw","sweet-peach-bubble-tea.webp",
  "A LEMON SODA: pale lemon-yellow, very clear and fizzy, lots of bubbles and ice, almost transparent. Garnish at the base: fresh lemon slices and a sprig of mint. Cream or soft tan backdrop.",
  "lemon syrup + soda + sugar",""),
 (4,"Orange Burst Co.","26SOD04","350ml clear PET cup, domed lid, straw","hawaiian-sunset-bubble.webp",
  "An ORANGE SODA: bright orange fizzy translucent soda, carbonation, ice, a layer of orange popping boba at the bottom. Garnish at the base: a fresh orange slice and a small white dish of orange popping boba. Warm caramel-brown backdrop.",
  "orange syrup + orange popping boba + sugar + soda + chaat masala",""),
 (5,"Exotic Passion Splash","26SOD05","350ml clear PET cup, domed lid, straw","passion-fruit-blast.webp",
  "A PASSION FRUIT SODA: golden orange-yellow fizzy soda with real passion-fruit seeds suspended, carbonation bubbles, ice, a hint of green mint, a layer of passion-fruit popping boba at the bottom. Garnish at the base: a halved passion fruit and a few mint leaves. Muted sage-green backdrop.",
  "passion fruit jam + passionfruit syrup + passion fruit popping boba + mint syrup + soda + chaat masala",""),
 (6,"Kiwi Green Splash","26SOD06","350ml clear PET cup, domed lid, straw","red-grapefruit-tea-pop.webp",
  "A KIWI SODA: fresh green fizzy translucent soda, carbonation bubbles, ice, a layer of green kiwi popping boba at the bottom. Garnish at the base: a halved kiwi (green flesh, black seeds) and a few green popping boba. Muted green backdrop.",
  "kiwi syrup + kiwi popping boba + sugar + soda + chaat masala",""),
 (7,"Hawaiian Sunset Fizz","26SOD07","350ml clear PET cup, domed lid, straw","hawaiian-sunset-bubble.webp",
  "A TROPICAL SUNSET SODA: a sunset gradient from deep blue at the top fading to pink/orange at the bottom (Hawaii blue syrup base), fizzy, bubbles, ice. Garnish at the base: a pineapple wedge or orange slice, tropical look. Warm caramel-brown backdrop.",
  "Hawaii (blue) syrup + sugar + soda + chaat masala","If you pour it single-colour blue, drop the gradient and make it a clean tropical-blue soda."),
 (8,"Tangy Kachha Mango Twist","26SOD08","350ml clear PET cup, domed lid, straw","red-grapefruit-tea-pop.webp",
  "A RAW-MANGO (aam panna) SODA: pale yellow-green cloudy soda, fizzy, ice, a layer of green-apple popping boba at the bottom. Garnish at the base: a raw green mango piece and a few mint leaves. Cream backdrop.",
  "aam panna syrup + sugar + soda + green apple popping boba + chaat masala",""),
 (9,"Lychee Blossom Fizz","26SOD09","350ml clear PET cup, domed lid, straw","red-grapefruit-tea-pop.webp",
  "A LYCHEE-ROSE SODA: very pale blush-pink, almost clear, delicate, fizzy, ice, a layer of lychee popping boba at the bottom. Garnish at the base: peeled whole lychees and a single pink rose petal. Soft cream or pale-pink backdrop.",
  "lychee rose syrup + lychee popping boba + soda + sugar + chaat masala",""),
 (10,"Peachy Summer Cooler","26SOD10","350ml clear PET cup, domed lid, straw","sweet-peach-bubble-tea.webp",
  "A PEACH SODA: soft peach-orange fizzy translucent soda, gentle gradient, bubbles, ice, a layer of peach popping boba at the bottom. Garnish at the base: a fresh peach half and a small dish of peach popping boba. Warm tan backdrop.",
  "peach syrup + peach popping boba + chaat masala + soda + sugar",""),
 (11,"Pomelo Passion Twist","26SOD11","350ml clear PET cup, domed lid, straw","passion-fruit-blast.webp",
  "A GRAPEFRUIT-PASSION SODA: orange-coral fizzy translucent soda, bubbles, ice, a layer of orange popping boba at the bottom. Garnish at the base: a red-grapefruit (pomelo) wedge and a halved passion fruit. Muted backdrop.",
  "passionfruit syrup + soda + orange popping boba","OFF the printed menu - shoot only if you sell it."),
]),
("COFFEE 26", [
 (12,"Classic Boba Brew","26COF03","350ml clear PET cup, domed lid, straw","caramel-boba-coffee.jpg",
  "A CLASSIC ICED BOBA COFFEE: layered milky pale top fading into medium coffee-brown, ice cubes, a layer of dark tapioca pearls at the bottom. Garnish at the base: a few coffee beans in a small dish. Warm cream backdrop.",
  "fresh milk + sugar + coffee + cooked tapioca pearls",""),
 (13,"Biscoff Boba Coffee","26COF04","350ml clear PET cup, domed lid, straw","caramel-boba-coffee.jpg",
  "A BISCOFF ICED COFFEE: caramel-beige creamy iced coffee, a dusting of crushed Biscoff/speculoos biscuit on the cream cap, ice, dark tapioca pearls at the bottom. Garnish at the base: a couple of Biscoff biscuits and a few coffee beans. Warm cream backdrop.",
  "fresh milk + Biscoff spread + sugar + coffee + cooked tapioca",""),
 (14,"Brown Sugar Macchiato","26COF05","350ml clear PET cup, domed lid, straw","caramel-boba-coffee.jpg",
  "A BROWN SUGAR COFFEE MACCHIATO: signature brown-sugar syrup tiger-stripes running down the inside of the clear cup, creamy coffee body, ice, a layer of coffee popping boba and a few chocolate chips at the bottom. Garnish at the base: a piece of brown-sugar slab and a few coffee beans. Warm cream backdrop.",
  "non-dairy creamer + brown sugar syrup + coffee + coffee popping boba + choco chips",""),
]),
("FRUIT TEA 26", [
 (15,"Raw Mango Mist Pop","26FRT02","350ml clear PET cup, domed lid, black straw","ginger-iced-tea.webp",
  "A RAW-MANGO GREEN TEA: pale yellow-green translucent iced tea, ice, light and clear (no milk). Garnish at the base: a raw green mango piece and a small mound of loose green tea leaves. Cream backdrop.",
  "green tea + aam panna (raw mango) syrup + sugar",""),
 (16,"Tropical Pineapple Pop","26FRT06","350ml clear PET cup, domed lid, black straw","jasmine-mango-bubble-tea.webp",
  "A PINEAPPLE FRUIT TEA: golden-yellow translucent iced tea, ice, a layer of pineapple popping boba at the bottom. Garnish at the base: a fresh pineapple wedge and a small mound of tea leaves. Muted sage backdrop.",
  "darjeeling tea + pineapple syrup + sugar + pineapple popping boba",""),
 (17,"Kiwi Island Tea","26FRT07","350ml clear PET cup, domed lid, black straw","ginger-iced-tea.webp",
  "A KIWI FRUIT TEA: fresh green translucent iced tea, ice, a layer of green kiwi popping boba at the bottom. Garnish at the base: a halved kiwi (green flesh, black seeds) and a small mound of tea leaves. Cream backdrop.",
  "darjeeling tea + kiwi syrup + sugar + kiwi popping boba",""),
 (18,"Peach Pomelo Burst","26FRT08","350ml clear PET cup, domed lid, straw","red-grapefruit-tea-pop.webp",
  "A PEACH-GRAPEFRUIT FRUIT TEA: warm peach-pink translucent iced tea, ice, a layer of peach popping boba at the bottom. Garnish at the base: a red-grapefruit (pomelo) wedge, a peach slice and a small mound of tea leaves. Muted green backdrop.",
  "darjeeling tea + peach syrup + red grapefruit syrup + sugar + peach popping boba","OFF the printed menu - shoot only if you sell it."),
]),
("MILK TEA 26", [
 (19,"Indian Boba Fusion","26MKT01","350ml clear PET cup, domed lid, straw","taiwan-classic-boba.webp",
  "A MASALA CHAI MILK TEA: warm tan-brown creamy spiced milk tea, ice, a layer of dark tapioca pearls at the bottom. Garnish at the base: a few whole spices (cardamom pods, a cinnamon stick) and a small dish of tapioca. Warm cream backdrop.",
  "fresh milk + condensed milk + Indian spice mix + assam tea + cooked tapioca",""),
 (20,"Thai Sunset","26MKT03","350ml clear PET cup, domed lid, straw","taiwan-classic-boba.webp",
  "A THAI MILK TEA: signature bright orange Thai tea fading to a creamy pale top (clear ombre layers), ice, tapioca pearls at the bottom. Garnish at the base: a small dish of tapioca and a drizzle of condensed milk. Warm cream backdrop.",
  "Thai milk tea premix + sugar + cooked tapioca + fresh milk + condensed milk + assam tea",""),
 (21,"Royal Taro Mist","26MKT04","350ml clear PET cup, domed lid, black straw","matcha-milk-tea.webp",
  "A TARO MILK TEA: soft pastel purple-lavender creamy opaque milk tea, a slightly lighter cream top layer, a layer of dark tapioca pearls at the bottom. Garnish at the base: a piece of fresh taro root and a small dish of tapioca. Muted backdrop.",
  "taro powder + sugar + fresh milk + cooked tapioca",""),
 (22,"Madagascar Vanilla Tea","26MKT06","350ml clear PET cup, domed lid, straw","assam-boba-tea.webp",
  "A VANILLA MILK TEA: warm creamy beige-tan milk tea, smooth and milky, ice, a layer of tapioca pearls at the bottom. Garnish at the base: a vanilla pod and a small dish of tapioca. Warm cream backdrop.",
  "vanilla milk tea base + milk + tapioca","Petpooja recipe was sparse - name/theme based."),
 (23,"Hong Kong Silk Tea","26MKT07","Hot 250ml glass/mug (or iced 350ml clear PET)","taiwan-classic-boba.webp",
  "A HONG KONG SILK STOCKING MILK TEA: rich strong reddish-brown milk tea, silky and creamy, a layer of dark tapioca pearls at the bottom. Garnish at the base: a small dish of tapioca and a drizzle of condensed milk. Warm cream backdrop.",
  "fresh milk + Hong Kong milk tea + sugar + Indian spice mix + condensed milk + cooked tapioca","OFF printed menu. Petpooja logs it as Hot 250ml; for an iced shot use the 350ml PET cup with ice, for hot use a 250ml glass/mug with no dome lid."),
]),
("MATCHA 26", [
 (24,"Creamy Vanilla Matcha","26MAT04","350ml clear PET cup, domed lid, black straw","matcha-milk-tea.webp",
  "A VANILLA MATCHA LATTE: layered - vibrant green matcha on top blending into creamy vanilla-white milk below, ice, a layer of dark tapioca pearls at the bottom. Garnish at the base: a small mound of bright green matcha powder, a fresh green tea leaf, and a vanilla pod. Muted sage-green backdrop.",
  "matcha powder + vanilla milk tea powder + fresh milk + sugar + cooked tapioca",""),
]),
("SMOOTHIE 26", [
 (25,"Mango Chill Vibe","26SMT01","350ml clear PET cup, domed lid, black straw","cheesy-mango-melt.jpg",
  "A THICK MANGO SMOOTHIE: rich opaque golden-yellow blended mango smoothie, a smooth cream cap under the dome lid (NO cheese-foam layer), a few mango popping boba visible. Garnish at the base: fresh mango cubes and a mango cheek scored in a hatch pattern. Muted sage-green backdrop.",
  "mango syrup + smoothie powder + non-dairy creamer + sugar + fresh milk + ripe mango + mango popping boba",""),
]),
("CHOCOLATE 26", [
 (26,"Hot Cocoa Cloud","26CHT02","Hot 250ml glass cup or mug (NO dome lid)","cafe-mocha.webp",
  "A HOT CHOCOLATE: rich hot chocolate in a glass cup/mug with a thick whipped-cream/foam cloud on top, a light cocoa-powder dusting and a chocolate-sauce drizzle, gentle steam rising. Garnish at the base: a few chocolate squares/chunks and cocoa powder. Warm caramel-brown backdrop, cosy mood.",
  "hot chocolate (warm and steamy, no ice)","The only HOT drink - deliberately breaks the cold-cup style."),
]),
]

out=[]
out.append("# Blend N Bubbles - 2026 Drink Image Prompts (NotebookLM-ready)\n")
out.append("Every drink below is a **complete, self-contained prompt**. Say a drink name and use its block as-is.\n")
out.append("---\n")
out.append("## How this works in NotebookLM\n")
out.append("1. Add as sources: **all the reference photos** in this folder + your **logo file** + **this document**.\n")
out.append("2. Type a drink name (e.g. *\"Kiwi Green Splash\"*). NotebookLM returns that drink's full prompt block.\n")
out.append("3. Paste the block into your image generator, attaching the two images it names (the reference photo + the logo).\n")
out.append("4. Every image uses the SAME camera distance as Cafe Mocha, pulled back a few inches, so the whole set is consistent.\n")
out.append("\n> NotebookLM itself does not create images - it retrieves the right prompt. Generate the image in Gemini / Nano Banana with that prompt + the two attached images.\n")
out.append("\n---\n")
out.append("## Locked style (already baked into every prompt below)\n\n")
out.append("**"+CAMERA+"**\n\n")
out.append("**"+LOGO+"**\n\n")
out.append("Cup sizes from live Petpooja: every cold drink = **350ml** PET cup with domed lid; hot serve = **250ml** glass/mug.\n")
out.append("\n---\n")

for cat, items in DRINKS:
    out.append("\n# "+cat+"\n")
    for num,name,sc,cup,ref,body,recipe,note in items:
        out.append("\n## "+str(num)+". "+name+"   ("+sc+")\n")
        out.append("**Cup:** "+cup+"  \n")
        out.append("**Attach image 1 (style/distance reference):** `"+ref+"`  \n")
        out.append("**Attach image 2 (logo):** your Blend N Bubbles logo file\n")
        if note: out.append("\n> Note: "+note+"\n")
        prompt = ("Professional product photograph of a single Blend N Bubbles bubble-tea drink. "
                  + CAMERA + " " + LOGO + " "
                  + "Use a " + cup + ". "
                  + "Drink: " + body + " "
                  + "Match the Cafe Mocha reference photo's camera distance but pull back a few inches for slightly more negative space. "
                  + "Recipe (keep the colour and toppings true to this): " + recipe + ".")
        out.append("\n```\n"+prompt+"\n```\n")

# cheat sheet
out.append("\n---\n\n## Cheat-sheet (name -> reference photo -> cup)\n\n")
out.append("| Drink | Reference photo | Cup |\n|---|---|---|\n")
for cat,items in DRINKS:
    for num,name,sc,cup,ref,body,recipe,note in items:
        tag=" (off-menu)" if "OFF" in note else ""
        cupshort = "Hot 250ml" if "250ml" in cup else "350ml"
        out.append("| "+name+tag+" | "+ref+" | "+cupshort+" |\n")

open("Gemini_Image_Prompts_2026.md","w").write("".join(out))
print("written, drinks:", sum(len(i) for _,i in DRINKS))
