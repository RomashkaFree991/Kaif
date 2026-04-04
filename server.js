// ══════════════════════════════════════════════════════════════════════════════
// GiftPepe Backend — server.js
// Express + Supabase + Telegram Mini App
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const cors = require('cors');

const CONFIG = {
  BOT_TOKEN: '7948801307:AAEVkGlfE4kd0dmgifPZPdQb4FK3vvXrdUc', // ⚠️ смени токен
  SUPABASE_URL: 'https://bfakvijmshgtvzpstbwj.supabase.co',
  SUPABASE_KEY: 'sb_publishable_EeLpqhgkDNAlTCFHHY1bTA_teZ6dxYQ',
  ADMIN_KEY: 'giftpepe_admin_2025',
  PORT: process.env.PORT || 3000,
};

const app = express();
app.use(cors());
app.use(express.json());

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const paymentReceipts = new Map();
const pendingPrizeMemory = new Map();
const inventoryMemory = new Map();
let inventorySeq = 1;

function isMissingTableError(error, tableName) {
  const msg = String(error?.message || '');
  if (!msg) return false;
  return msg.includes(`public.${tableName}`) && (
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('Could not find the table')
  );
}

function getMemoryInventory(userId) {
  return (inventoryMemory.get(String(userId)) || []).map((item) => ({ ...item }));
}

function setMemoryInventory(userId, items) {
  inventoryMemory.set(String(userId), items.map((item) => ({ ...item })));
}
const GIFT_CATALOG = [{"name":"Snake Box","price":339,"id":"6023679164349940429","image":"https://cdn.changes.tg/gifts/originals/6023679164349940429/Original.png"},{"name":"Big Year","price":340,"id":"6028283532500009446","image":"https://cdn.changes.tg/gifts/originals/6028283532500009446/Original.png"},{"name":"Xmas Stocking","price":340,"id":"6003767644426076664","image":"https://cdn.changes.tg/gifts/originals/6003767644426076664/Original.png"},{"name":"Chill Flame","price":350,"id":"5999277561060787166","image":"https://cdn.changes.tg/gifts/originals/5999277561060787166/Original.png"},{"name":"Instant Ramen","price":350,"id":"6005564615793050414","image":"https://cdn.changes.tg/gifts/originals/6005564615793050414/Original.png"},{"name":"Lunar Snake","price":350,"id":"6028426950047957932","image":"https://cdn.changes.tg/gifts/originals/6028426950047957932/Original.png"},{"name":"Vice Cream","price":350,"id":"5898012527257715797","image":"https://cdn.changes.tg/gifts/originals/5898012527257715797/Original.png"},{"name":"Victory Medal","price":350,"id":"5830340739074097859","image":"https://cdn.changes.tg/gifts/originals/5830340739074097859/Original.png"},{"name":"Winter Wreath","price":350,"id":"5983259145522906006","image":"https://cdn.changes.tg/gifts/originals/5983259145522906006/Original.png"},{"name":"Candy Cane","price":355,"id":"6003373314888696650","image":"https://cdn.changes.tg/gifts/originals/6003373314888696650/Original.png"},{"name":"Fresh Socks","price":360,"id":"5895603153683874485","image":"https://cdn.changes.tg/gifts/originals/5895603153683874485/Original.png"},{"name":"Pet Snake","price":365,"id":"6023917088358269866","image":"https://cdn.changes.tg/gifts/originals/6023917088358269866/Original.png"},{"name":"Santa Hat","price":380,"id":"5983471780763796287","image":"https://cdn.changes.tg/gifts/originals/5983471780763796287/Original.png"},{"name":"Whip Cupcake","price":380,"id":"5933543975653737112","image":"https://cdn.changes.tg/gifts/originals/5933543975653737112/Original.png"},{"name":"Ice Cream","price":389,"id":"5900177027566142759","image":"https://cdn.changes.tg/gifts/originals/5900177027566142759/Original.png"},{"name":"Pool Float","price":395,"id":"5832644211639321671","image":"https://cdn.changes.tg/gifts/originals/5832644211639321671/Original.png"},{"name":"Lol Pop","price":399,"id":"5170594532177215681","image":"https://cdn.changes.tg/gifts/originals/5170594532177215681/Original.png"},{"name":"Holiday Drink","price":400,"id":"6003735372041814769","image":"https://cdn.changes.tg/gifts/originals/6003735372041814769/Original.png"},{"name":"Happy Brownie","price":420,"id":"6006064678835323371","image":"https://cdn.changes.tg/gifts/originals/6006064678835323371/Original.png"},{"name":"Hypno Lollipop","price":420,"id":"5825895989088617224","image":"https://cdn.changes.tg/gifts/originals/5825895989088617224/Original.png"},{"name":"Tama Gadget","price":420,"id":"6023752243218481939","image":"https://cdn.changes.tg/gifts/originals/6023752243218481939/Original.png"},{"name":"Ginger Cookie","price":425,"id":"5983484377902875708","image":"https://cdn.changes.tg/gifts/originals/5983484377902875708/Original.png"},{"name":"Party Sparkler","price":430,"id":"6003643167683903930","image":"https://cdn.changes.tg/gifts/originals/6003643167683903930/Original.png"},{"name":"Spiced Wine","price":430,"id":"5913442287462908725","image":"https://cdn.changes.tg/gifts/originals/5913442287462908725/Original.png"},{"name":"Bow Tie","price":450,"id":"5895544372761461960","image":"https://cdn.changes.tg/gifts/originals/5895544372761461960/Original.png"},{"name":"Jack-in-the-Box","price":450,"id":"6005659564635063386","image":"https://cdn.changes.tg/gifts/originals/6005659564635063386/Original.png"},{"name":"Jester Hat","price":450,"id":"5933590374185435592","image":"https://cdn.changes.tg/gifts/originals/5933590374185435592/Original.png"},{"name":"Stellar Rocket","price":450,"id":"6042113507581755979","image":"https://cdn.changes.tg/gifts/originals/6042113507581755979/Original.png"},{"name":"Mousse Cake","price":460,"id":"5935877878062253519","image":"https://cdn.changes.tg/gifts/originals/5935877878062253519/Original.png"},{"name":"Money Pot","price":465,"id":"5963238670868677492","image":"https://cdn.changes.tg/gifts/originals/5963238670868677492/Original.png"},{"name":"Mood Pack","price":470,"id":"5886756255493523118","image":"https://cdn.changes.tg/gifts/originals/5886756255493523118/Original.png"},{"name":"B-Day Candle","price":498,"id":"5782984811920491178","image":"https://cdn.changes.tg/gifts/originals/5782984811920491178/Original.png"},{"name":"Clover Pin","price":498,"id":"5960747083030856414","image":"https://cdn.changes.tg/gifts/originals/5960747083030856414/Original.png"},{"name":"Hex Pot","price":500,"id":"5825801628657124140","image":"https://cdn.changes.tg/gifts/originals/5825801628657124140/Original.png"},{"name":"Pretty Posy","price":500,"id":"5933737850477478635","image":"https://cdn.changes.tg/gifts/originals/5933737850477478635/Original.png"},{"name":"Restless Jar","price":500,"id":"5870784783948186838","image":"https://cdn.changes.tg/gifts/originals/5870784783948186838/Original.png"},{"name":"Cookie Heart","price":509,"id":"6001538689543439169","image":"https://cdn.changes.tg/gifts/originals/6001538689543439169/Original.png"},{"name":"Swag Bag","price":510,"id":"6012607142387778152","image":"https://cdn.changes.tg/gifts/originals/6012607142387778152/Original.png"},{"name":"Snow Globe","price":530,"id":"5981132629905245483","image":"https://cdn.changes.tg/gifts/originals/5981132629905245483/Original.png"},{"name":"Star Notepad","price":538,"id":"5936017773737018241","image":"https://cdn.changes.tg/gifts/originals/5936017773737018241/Original.png"},{"name":"Homemade Cake","price":542,"id":"5783075783622787539","image":"https://cdn.changes.tg/gifts/originals/5783075783622787539/Original.png"},{"name":"Faith Amulet","price":544,"id":"6003456431095808759","image":"https://cdn.changes.tg/gifts/originals/6003456431095808759/Original.png"},{"name":"Easter Egg","price":550,"id":"5773668482394620318","image":"https://cdn.changes.tg/gifts/originals/5773668482394620318/Original.png"},{"name":"Snoop Dogg","price":550,"id":"6014591077976114307","image":"https://cdn.changes.tg/gifts/originals/6014591077976114307/Original.png"},{"name":"Spring Basket","price":550,"id":"5773725897517433693","image":"https://cdn.changes.tg/gifts/originals/5773725897517433693/Original.png"},{"name":"Moon Pendant","price":555,"id":"5998981470310368313","image":"https://cdn.changes.tg/gifts/originals/5998981470310368313/Original.png"},{"name":"Input Key","price":567,"id":"5870972044522291836","image":"https://cdn.changes.tg/gifts/originals/5870972044522291836/Original.png"},{"name":"Lush Bouquet","price":570,"id":"5871002671934079382","image":"https://cdn.changes.tg/gifts/originals/5871002671934079382/Original.png"},{"name":"Snow Mittens","price":570,"id":"5980789805615678057","image":"https://cdn.changes.tg/gifts/originals/5980789805615678057/Original.png"},{"name":"Witch Hat","price":570,"id":"5821384757304362229","image":"https://cdn.changes.tg/gifts/originals/5821384757304362229/Original.png"},{"name":"Desk Calendar","price":572,"id":"5782988952268964995","image":"https://cdn.changes.tg/gifts/originals/5782988952268964995/Original.png"},{"name":"Bunny Muffin","price":575,"id":"5935936766358847989","image":"https://cdn.changes.tg/gifts/originals/5935936766358847989/Original.png"},{"name":"Eternal Candle","price":575,"id":"5821205665758053411","image":"https://cdn.changes.tg/gifts/originals/5821205665758053411/Original.png"},{"name":"Evil Eye","price":575,"id":"5825480571261813595","image":"https://cdn.changes.tg/gifts/originals/5825480571261813595/Original.png"},{"name":"Jelly Bunny","price":575,"id":"5915502858152706668","image":"https://cdn.changes.tg/gifts/originals/5915502858152706668/Original.png"},{"name":"Jolly Chimp","price":575,"id":"6005880141270483700","image":"https://cdn.changes.tg/gifts/originals/6005880141270483700/Original.png"},{"name":"Light Sword","price":575,"id":"5897581235231785485","image":"https://cdn.changes.tg/gifts/originals/5897581235231785485/Original.png"},{"name":"Spy Agaric","price":575,"id":"5821261908354794038","image":"https://cdn.changes.tg/gifts/originals/5821261908354794038/Original.png"},{"name":"Timeless Book","price":575,"id":"5886387158889005864","image":"https://cdn.changes.tg/gifts/originals/5886387158889005864/Original.png"},{"name":"Joyful Bundle","price":616,"id":"5870862540036113469","image":"https://cdn.changes.tg/gifts/originals/5870862540036113469/Original.png"},{"name":"Sleigh Bell","price":691,"id":"5981026247860290310","image":"https://cdn.changes.tg/gifts/originals/5981026247860290310/Original.png"},{"name":"Hanging Star","price":697,"id":"5915733223018594841","image":"https://cdn.changes.tg/gifts/originals/5915733223018594841/Original.png"},{"name":"Berry Box","price":699,"id":"5882252952218894938","image":"https://cdn.changes.tg/gifts/originals/5882252952218894938/Original.png"},{"name":"Jingle Bells","price":700,"id":"6001473264306619020","image":"https://cdn.changes.tg/gifts/originals/6001473264306619020/Original.png"},{"name":"Sakura Flower","price":800,"id":"5167939598143193218","image":"https://cdn.changes.tg/gifts/originals/5167939598143193218/Original.png"},{"name":"Valentine Box","price":829,"id":"5868595669182186720","image":"https://cdn.changes.tg/gifts/originals/5868595669182186720/Original.png"},{"name":"Skull Flower","price":899,"id":"5839038009193792264","image":"https://cdn.changes.tg/gifts/originals/5839038009193792264/Original.png"},{"name":"Love Candle","price":903,"id":"5915550639663874519","image":"https://cdn.changes.tg/gifts/originals/5915550639663874519/Original.png"},{"name":"Crystal Ball","price":921,"id":"5841336413697606412","image":"https://cdn.changes.tg/gifts/originals/5841336413697606412/Original.png"},{"name":"Top Hat","price":928,"id":"5897593557492957738","image":"https://cdn.changes.tg/gifts/originals/5897593557492957738/Original.png"},{"name":"Snoop Cigar","price":967,"id":"6012435906336654262","image":"https://cdn.changes.tg/gifts/originals/6012435906336654262/Original.png"},{"name":"Flying Broom","price":1068,"id":"5837063436634161765","image":"https://cdn.changes.tg/gifts/originals/5837063436634161765/Original.png"},{"name":"UFC Strike","price":1085,"id":"5882260270843168924","image":"https://cdn.changes.tg/gifts/originals/5882260270843168924/Original.png"},{"name":"Trapped Heart","price":1117,"id":"5841391256135008713","image":"https://cdn.changes.tg/gifts/originals/5841391256135008713/Original.png"},{"name":"Record Player","price":1213,"id":"5856973938650776169","image":"https://cdn.changes.tg/gifts/originals/5856973938650776169/Original.png"},{"name":"Love Potion","price":1221,"id":"5868348541058942091","image":"https://cdn.changes.tg/gifts/originals/5868348541058942091/Original.png"},{"name":"Mad Pumpkin","price":1231,"id":"5841632504448025405","image":"https://cdn.changes.tg/gifts/originals/5841632504448025405/Original.png"},{"name":"Ionic Dryer","price":1362,"id":"5933937398953018107","image":"https://cdn.changes.tg/gifts/originals/5933937398953018107/Original.png"},{"name":"Sky Stilettos","price":1397,"id":"5870947077877400011","image":"https://cdn.changes.tg/gifts/originals/5870947077877400011/Original.png"},{"name":"Cupid Charm","price":1685,"id":"5868561433997870501","image":"https://cdn.changes.tg/gifts/originals/5868561433997870501/Original.png"},{"name":"Khabib’s Papakha","price":1915,"id":"5839094187366024301","image":"https://cdn.changes.tg/gifts/originals/5839094187366024301/Original.png"},{"name":"Rare Bird","price":2096,"id":"5999116401002939514","image":"https://cdn.changes.tg/gifts/originals/5999116401002939514/Original.png"},{"name":"Eternal Rose","price":2301,"id":"5882125812596999035","image":"https://cdn.changes.tg/gifts/originals/5882125812596999035/Original.png"},{"name":"Diamond Ring","price":2384,"id":"5868503709637411929","image":"https://cdn.changes.tg/gifts/originals/5868503709637411929/Original.png"},{"name":"Bling Binky","price":2421,"id":"5902339509239940491","image":"https://cdn.changes.tg/gifts/originals/5902339509239940491/Original.png"},{"name":"Voodoo Doll","price":2653,"id":"5836780359634649414","image":"https://cdn.changes.tg/gifts/originals/5836780359634649414/Original.png"},{"name":"Electric Skull","price":2838,"id":"5846192273657692751","image":"https://cdn.changes.tg/gifts/originals/5846192273657692751/Original.png"},{"name":"Signet Ring","price":2951,"id":"5936085638515261992","image":"https://cdn.changes.tg/gifts/originals/5936085638515261992/Original.png"},{"name":"Vintage Cigar","price":3017,"id":"5857140566201991735","image":"https://cdn.changes.tg/gifts/originals/5857140566201991735/Original.png"},{"name":"Neko Helmet","price":3201,"id":"5933793770951673155","image":"https://cdn.changes.tg/gifts/originals/5933793770951673155/Original.png"},{"name":"Toy Bear","price":3855,"id":"5868220813026526561","image":"https://cdn.changes.tg/gifts/originals/5868220813026526561/Original.png"},{"name":"Bonded Ring","price":3897,"id":"5870661333703197240","image":"https://cdn.changes.tg/gifts/originals/5870661333703197240/Original.png"},{"name":"Genie Lamp","price":3938,"id":"5933531623327795414","image":"https://cdn.changes.tg/gifts/originals/5933531623327795414/Original.png"},{"name":"Sharp Tongue","price":3938,"id":"5841689550203650524","image":"https://cdn.changes.tg/gifts/originals/5841689550203650524/Original.png"},{"name":"Swiss Watch","price":4069,"id":"5936043693864651359","image":"https://cdn.changes.tg/gifts/originals/5936043693864651359/Original.png"},{"name":"Low Rider","price":4641,"id":"6014675319464657779","image":"https://cdn.changes.tg/gifts/originals/6014675319464657779/Original.png"},{"name":"Kissed Frog","price":5060,"id":"5845776576658015084","image":"https://cdn.changes.tg/gifts/originals/5845776576658015084/Original.png"},{"name":"Gem Signet","price":5746,"id":"5859442703032386168","image":"https://cdn.changes.tg/gifts/originals/5859442703032386168/Original.png"},{"name":"Magic Potion","price":6577,"id":"5846226946928673709","image":"https://cdn.changes.tg/gifts/originals/5846226946928673709/Original.png"},{"name":"Artisan Brick","price":7177,"id":"6005797617768858105","image":"https://cdn.changes.tg/gifts/originals/6005797617768858105/Original.png"},{"name":"Mini Oscar","price":7637,"id":"5879737836550226478","image":"https://cdn.changes.tg/gifts/originals/5879737836550226478/Original.png"},{"name":"Ion Gem","price":7793,"id":"5843762284240831056","image":"https://cdn.changes.tg/gifts/originals/5843762284240831056/Original.png"},{"name":"Perfume Bottle","price":8714,"id":"5913517067138499193","image":"https://cdn.changes.tg/gifts/originals/5913517067138499193/Original.png"},{"name":"Westside Sign","price":8796,"id":"6014697240977737490","image":"https://cdn.changes.tg/gifts/originals/6014697240977737490/Original.png"},{"name":"Scared Cat","price":9775,"id":"5837059369300132790","image":"https://cdn.changes.tg/gifts/originals/5837059369300132790/Original.png"},{"name":"Nail Bracelet","price":11229,"id":"5870720080265871962","image":"https://cdn.changes.tg/gifts/originals/5870720080265871962/Original.png"},{"name":"Loot Bag","price":12537,"id":"5868659926187901653","image":"https://cdn.changes.tg/gifts/originals/5868659926187901653/Original.png"},{"name":"Mighty Arm","price":13638,"id":"5895518353849582541","image":"https://cdn.changes.tg/gifts/originals/5895518353849582541/Original.png"},{"name":"Astral Shard","price":14099,"id":"5933629604416717361","image":"https://cdn.changes.tg/gifts/originals/5933629604416717361/Original.png"},{"name":"Heroic Helmet","price":21859,"id":"5895328365971244193","image":"https://cdn.changes.tg/gifts/originals/5895328365971244193/Original.png"},{"name":"Precious Peach","price":35678,"id":"5933671725160989227","image":"https://cdn.changes.tg/gifts/originals/5933671725160989227/Original.png"},{"name":"Durov’s Cap","price":67592,"id":"5915521180483191380","image":"https://cdn.changes.tg/gifts/originals/5915521180483191380/Original.png"},{"name":"Heart Locket","price":172552,"id":"5868455043362980631","image":"https://cdn.changes.tg/gifts/originals/5868455043362980631/Original.png"},{"name":"Plush Pepe","price":780883,"id":"5936013938331222567","image":"https://cdn.changes.tg/gifts/originals/5936013938331222567/Original.png"}];

function validateInitDataContext(initDataStr) {
  try {
    const params = new URLSearchParams(String(initDataStr || ''));
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const str = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(CONFIG.BOT_TOKEN).digest();
    const expected = crypto.createHmac('sha256', secret).update(str).digest('hex');
    if (hash !== expected) return null;
    return {
      user: JSON.parse(params.get('user') || 'null'),
      startParam: params.get('start_param') || null,
      authDate: Number(params.get('auth_date') || 0),
    };
  } catch {
    return null;
  }
}

function validateInitData(initDataStr) {
  return validateInitDataContext(initDataStr)?.user || null;
}

function getReqInitData(req) {
  return req.headers['x-init-data'] || req.body?.initData || '';
}

function requireUser(req, res) {
  const user = validateInitData(getReqInitData(req));
  if (!user) {
    res.status(401).json({ error: 'Invalid initData' });
    return null;
  }
  return user;
}

function requireUserContext(req, res) {
  const context = validateInitDataContext(getReqInitData(req));
  if (!context?.user) {
    res.status(401).json({ error: 'Invalid initData' });
    return null;
  }
  return context;
}

function extractReferralId(startParam) {
  const match = /^ref_(\d+)$/.exec(String(startParam || '').trim());
  return match ? Number(match[1]) : null;
}

async function getReferralSummary(userId) {
  const { data, error } = await sb.rpc('get_referral_stats', { p_user_id: userId });
  if (error) throw new Error(error.message || 'Referral stats failed');
  const row = Array.isArray(data) ? data[0] : data;
  return {
    invitedCount: Number(row?.invited_count || 0),
    earned: Number(row?.earned || 0),
  };
}

async function tgApi(method, data = {}) {
  const r = await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

async function getUserBalance(userId) {
  const { data, error } = await sb.from('users').select('balance').eq('id', userId).single();
  if (error) throw new Error(error.message || 'Balance read failed');
  return Number(data?.balance || 0);
}

async function spendBalance(userId, amount) {
  const rpc = await sb.rpc('spend_balance', { p_user_id: userId, p_amount: amount });
  if (!rpc.error) return Number(rpc.data || 0);

  const currentBalance = await getUserBalance(userId);
  if (currentBalance < amount) throw new Error('Not enough balance');

  const nextBalance = currentBalance - amount;
  const { data, error } = await sb
    .from('users')
    .update({ balance: nextBalance })
    .eq('id', userId)
    .select('balance')
    .single();

  if (error) throw new Error(error.message || rpc.error.message || 'Balance spend failed');
  return Number(data?.balance ?? nextBalance);
}

async function addWinBalance(userId, amount) {
  const rpc = await sb.rpc('add_win_balance', { p_user_id: userId, p_amount: amount });
  if (!rpc.error) return Number(rpc.data || 0);

  const currentBalance = await getUserBalance(userId);
  const nextBalance = currentBalance + amount;
  const { data, error } = await sb
    .from('users')
    .update({ balance: nextBalance })
    .eq('id', userId)
    .select('balance')
    .single();

  if (error) throw new Error(error.message || rpc.error.message || 'Balance add failed');
  return Number(data?.balance ?? nextBalance);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}


function buildGiftImage(giftId) {
  const id = String(giftId || '').trim();
  return id ? `https://cdn.changes.tg/gifts/originals/${id}/Original.png` : '';
}

function findGiftInCatalog(gift) {
  if (!gift) return null;
  const id = String(gift.id || gift.giftId || gift.gift_id || '').trim();
  const name = String(gift.name || gift.gift_name || '').trim().toLowerCase();
  if (id) {
    const byId = GIFT_CATALOG.find((entry) => String(entry.id || entry.giftId || '').trim() === id);
    if (byId) return byId;
  }
  if (name) {
    const byName = GIFT_CATALOG.find((entry) => String(entry.name || '').trim().toLowerCase() === name);
    if (byName) return byName;
  }
  return null;
}

function normalizeGift(gift) {
  if (!gift) return null;
  const id = String(gift.id || gift.giftId || gift.gift_id || '').trim();
  const catalogGift = findGiftInCatalog(gift);
  return {
    id: id || String(catalogGift?.id || '').trim(),
    name: String(gift.name || gift.gift_name || catalogGift?.name || 'Gift'),
    price: Number(gift.price || gift.gift_price || catalogGift?.price || 0),
    image: String(gift.image || gift.gift_image || catalogGift?.image || buildGiftImage(id || catalogGift?.id || '')),
  };
}

function getBestGiftForStars(stars) {
  const budget = Number(stars || 0);
  let result = null;
  for (const gift of GIFT_CATALOG) {
    const price = Number(gift?.price || 0);
    if (price <= budget && (!result || price > Number(result.price || 0))) {
      result = gift;
    }
  }
  return normalizeGift(result);
}

function pickCrashGiftForPayout(payout, selectedGift = null) {
  const numericPayout = Math.max(0, Math.floor(Number(payout || 0)));
  const normalizedSelected = normalizeGift(selectedGift);
  const selectedCatalog = findGiftInCatalog(selectedGift || normalizedSelected);
  const selectedBasePrice = Number(selectedCatalog?.price || normalizedSelected?.price || 0);
  if (normalizedSelected && selectedBasePrice <= numericPayout) {
    return normalizeGift({ ...normalizedSelected, price: numericPayout });
  }
  const fallback = getBestGiftForStars(numericPayout);
  return fallback ? normalizeGift({ ...fallback, price: numericPayout }) : null;
}

function buildCrashBetState(bet, { viewer = false, phase = crashGame.phase, liveMultiplier = 1 } = {}) {
  if (!bet) return null;
  const amount = Number(bet.amount || 0);
  const won = !!bet.cashedOut;
  const lost = !won && phase === 'ended';
  const displayAmount = won
    ? Number(bet.payout || 0)
    : (phase === 'live' ? Math.max(0, Math.floor(amount * liveMultiplier)) : amount);
  const basePreviewGift = won
    ? normalizeGift(bet.awardedGift) || getBestGiftForStars(displayAmount)
    : getBestGiftForStars(displayAmount);
  const previewGift = basePreviewGift ? normalizeGift({ ...basePreviewGift, price: displayAmount }) : null;
  return {
    userId: bet.userId,
    firstName: bet.firstName || 'User',
    photoUrl: bet.photoUrl || null,
    amount,
    betAmount: amount,
    roundId: bet.roundId,
    cashedOut: won,
    payout: Number(bet.payout || 0),
    currentPayout: displayAmount,
    displayAmount,
    previewGift,
    status: won ? 'won' : (lost ? 'lost' : (phase === 'countdown' ? 'pending' : 'active')),
    isViewer: viewer,
  };
}

async function getPendingPrize(userId) {
  if (!userId) return null;
  const memoryPrize = pendingPrizeMemory.get(String(userId)) || null;
  if (memoryPrize) return normalizeGift(memoryPrize);

  const { data, error } = await sb
    .from('user_pending_prizes')
    .select('gift_id,gift_name,gift_price,gift_image,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'user_pending_prizes')) {
      return null;
    }
    return null;
  }
  if (!data) return null;
  const normalized = normalizeGift({
    id: data.gift_id,
    name: data.gift_name,
    price: data.gift_price,
    image: data.gift_image,
  });
  if (normalized) {
    pendingPrizeMemory.set(String(userId), normalized);
  }
  return normalized;
}

async function upsertPendingPrize(userId, gift) {
  const normalized = normalizeGift(gift);
  if (!userId || !normalized) return null;
  pendingPrizeMemory.set(String(userId), normalized);

  const { error: deleteError } = await sb.from('user_pending_prizes').delete().eq('user_id', userId);
  if (deleteError && !isMissingTableError(deleteError, 'user_pending_prizes')) {
    throw new Error(deleteError.message || 'Pending prize cleanup failed');
  }

  const { error } = await sb.from('user_pending_prizes').insert({
    user_id: userId,
    gift_id: normalized.id,
    gift_name: normalized.name,
    gift_price: normalized.price,
    gift_image: normalized.image,
    created_at: new Date().toISOString(),
  });
  if (error) {
    if (isMissingTableError(error, 'user_pending_prizes')) {
      return normalized;
    }
    throw new Error(error.message || 'Pending prize save failed');
  }
  return normalized;
}

async function clearPendingPrize(userId) {
  if (!userId) return null;
  const memoryPrize = pendingPrizeMemory.get(String(userId)) || null;
  const pending = memoryPrize ? normalizeGift(memoryPrize) : await getPendingPrize(userId);
  const { error } = await sb.from('user_pending_prizes').delete().eq('user_id', userId);
  pendingPrizeMemory.delete(String(userId));
  if (error && !isMissingTableError(error, 'user_pending_prizes')) {
    throw new Error(error.message || 'Pending prize delete failed');
  }
  return pending;
}

async function getUserInventory(userId) {
  const { data, error } = await sb
    .from('user_gifts')
    .select('id,gift_id,gift_name,gift_price,gift_image,withdraw_available_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error, 'user_gifts')) {
      return getMemoryInventory(userId);
    }
    throw new Error(error.message || 'Inventory read failed');
  }

  return (data || []).map((row) => ({
    id: Number(row.id),
    giftId: String(row.gift_id || ''),
    name: String(row.gift_name || 'Gift'),
    price: Number(row.gift_price || 0),
    image: String(row.gift_image || ''),
    withdrawAt: row.withdraw_available_at || null,
    createdAt: row.created_at || null,
  }));
}

async function addGiftToInventory(userId, gift) {
  const normalized = normalizeGift(gift);
  if (!normalized) throw new Error('Gift is required');
  const withdrawAt = new Date().toISOString();
  const { data, error } = await sb
    .from('user_gifts')
    .insert({
      user_id: userId,
      gift_id: normalized.id,
      gift_name: normalized.name,
      gift_price: normalized.price,
      gift_image: normalized.image,
      withdraw_available_at: withdrawAt,
    })
    .select('id,gift_id,gift_name,gift_price,gift_image,withdraw_available_at,created_at')
    .single();

  if (error) {
    if (isMissingTableError(error, 'user_gifts')) {
      const item = {
        id: inventorySeq++,
        giftId: normalized.id,
        name: normalized.name,
        price: normalized.price,
        image: normalized.image,
        withdrawAt,
        createdAt: new Date().toISOString(),
      };
      const items = getMemoryInventory(userId);
      items.unshift(item);
      setMemoryInventory(userId, items);
      return item;
    }
    throw new Error(error.message || 'Gift save failed');
  }

  return {
    id: Number(data.id),
    giftId: String(data.gift_id || ''),
    name: String(data.gift_name || 'Gift'),
    price: Number(data.gift_price || 0),
    image: String(data.gift_image || ''),
    withdrawAt: data.withdraw_available_at || null,
    createdAt: data.created_at || null,
  };
}

async function sellInventoryGift(userId, giftDbId) {
  const { data, error } = await sb
    .from('user_gifts')
    .select('id,gift_price')
    .eq('user_id', userId)
    .eq('id', giftDbId)
    .single();

  if (error) {
    if (isMissingTableError(error, 'user_gifts')) {
      const items = getMemoryInventory(userId);
      const item = items.find((entry) => Number(entry.id) === Number(giftDbId));
      if (!item) throw new Error('Gift not found');
      setMemoryInventory(userId, items.filter((entry) => Number(entry.id) !== Number(giftDbId)));
      const newBalance = await addWinBalance(userId, Number(item.price || 0));
      return { soldPrice: Number(item.price || 0), newBalance };
    }
    throw new Error(error.message || 'Gift not found');
  }
  if (!data) throw new Error('Gift not found');

  const { error: deleteError } = await sb
    .from('user_gifts')
    .delete()
    .eq('user_id', userId)
    .eq('id', giftDbId);

  if (deleteError) throw new Error(deleteError.message || 'Gift delete failed');

  const newBalance = await addWinBalance(userId, Number(data.gift_price || 0));
  return {
    soldPrice: Number(data.gift_price || 0),
    newBalance,
  };
}

async function withdrawInventoryGift(userId, targetUserId, giftDbId) {
  let gift = null;

  const { data, error } = await sb
    .from('user_gifts')
    .select('id,gift_id,gift_name,gift_price,gift_image')
    .eq('user_id', userId)
    .eq('id', giftDbId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'user_gifts')) {
      const items = getMemoryInventory(userId);
      const item = items.find((entry) => Number(entry.id) === Number(giftDbId));
      if (!item) throw new Error('Gift not found');
      gift = {
        id: Number(item.id),
        gift_id: item.giftId,
        gift_name: item.name,
        gift_price: item.price,
        gift_image: item.image,
      };
    } else {
      throw new Error(error.message || 'Gift not found');
    }
  } else {
    gift = data;
  }

  if (!gift) throw new Error('Gift not found');

  const telegramResult = await tgApi('sendGift', {
    user_id: Number(targetUserId),
    gift_id: String(gift.gift_id || ''),
  });

  if (!telegramResult?.ok) {
    throw new Error(telegramResult?.description || 'Telegram gift send failed');
  }

  if (data) {
    const { error: deleteError } = await sb
      .from('user_gifts')
      .delete()
      .eq('user_id', userId)
      .eq('id', giftDbId);
    if (deleteError) throw new Error(deleteError.message || 'Gift delete failed');
  } else {
    const items = getMemoryInventory(userId);
    setMemoryInventory(userId, items.filter((entry) => Number(entry.id) !== Number(giftDbId)));
  }

  return {
    sentGift: normalizeGift({
      id: gift.gift_id,
      name: gift.gift_name,
      price: gift.gift_price,
      image: gift.gift_image,
    }),
  };
}

async function sellAllInventoryGifts(userId) {
  const items = await getUserInventory(userId);
  const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  if (!items.length) {
    return { soldCount: 0, soldTotal: 0, newBalance: await getUserBalance(userId) };
  }

  const ids = items.map((item) => item.id);
  const { error } = await sb.from('user_gifts').delete().eq('user_id', userId).in('id', ids);
  if (error && !isMissingTableError(error, 'user_gifts')) throw new Error(error.message || 'Sell all failed');
  if (error && isMissingTableError(error, 'user_gifts')) {
    setMemoryInventory(userId, []);
  }

  const newBalance = total > 0 ? await addWinBalance(userId, total) : await getUserBalance(userId);
  return {
    soldCount: items.length,
    soldTotal: total,
    newBalance,
  };
}


function sampleCrashTarget() {
  const r = Math.random();
  if (r < 0.28) return round2(1.01 + Math.random() * 1.3);
  if (r < 0.56) return round2(2.0 + Math.random() * 3.2);
  if (r < 0.78) return round2(5.2 + Math.random() * 9.8);
  if (r < 0.92) return round2(15 + Math.random() * 20);
  return round2(35 + Math.random() * 35);
}

const CRASH = {
  countdownMs: 10000,
  resetMs: 3000,
  growthMs: 8000,
  historyLimit: 12,
};

const crashGame = {
  roundId: 0,
  phase: 'countdown',
  countdownEndsAt: 0,
  liveStartAt: 0,
  liveEndsAt: 0,
  crashTarget: 1.0,
  lastCrashMultiplier: 1.0,
  nextRoundAt: 0,
  growthMs: CRASH.growthMs,
  history: [],
  bets: new Map(),
  timers: {
    start: null,
    end: null,
    next: null,
  },
};

function clearCrashTimers() {
  clearTimeout(crashGame.timers.start);
  clearTimeout(crashGame.timers.end);
  clearTimeout(crashGame.timers.next);
  crashGame.timers.start = null;
  crashGame.timers.end = null;
  crashGame.timers.next = null;
}

function currentCrashMultiplier(now = Date.now()) {
  syncCrashByTime();

  if (crashGame.phase !== 'live') {
    return Number(crashGame.lastCrashMultiplier || 1);
  }
  const elapsed = Math.max(0, now - crashGame.liveStartAt);
  const mult = Math.exp(elapsed / Number(crashGame.growthMs || CRASH.growthMs));
  return Math.min(Number(crashGame.crashTarget || 1), mult);
}

function finishCrashRound(now = Date.now()) {
  if (crashGame.phase === 'ended') return;
  crashGame.phase = 'ended';
  crashGame.lastCrashMultiplier = round2(crashGame.crashTarget);
  crashGame.liveEndsAt = now;
  crashGame.nextRoundAt = now + CRASH.resetMs;
  crashGame.history.unshift({
    roundId: crashGame.roundId,
    multiplier: round2(crashGame.crashTarget),
  });
  crashGame.history = crashGame.history.slice(0, CRASH.historyLimit);
  clearTimeout(crashGame.timers.end);
  crashGame.timers.end = null;
  clearTimeout(crashGame.timers.next);
  crashGame.timers.next = setTimeout(startCrashRound, CRASH.resetMs);
}

function startCrashLive(now = Date.now()) {
  if (crashGame.phase === 'live') return;
  crashGame.phase = 'live';
  crashGame.liveStartAt = now;
  const durationMs = Math.max(
    400,
    Math.round(crashGame.growthMs * Math.log(Math.max(crashGame.crashTarget, 1.01)))
  );
  crashGame.liveEndsAt = now + durationMs;
  crashGame.lastCrashMultiplier = 1.0;
  clearTimeout(crashGame.timers.start);
  crashGame.timers.start = null;
  clearTimeout(crashGame.timers.end);
  crashGame.timers.end = setTimeout(() => finishCrashRound(Date.now()), durationMs);
}

function syncCrashByTime(now = Date.now()) {
  if (crashGame.phase === 'countdown' && crashGame.countdownEndsAt && now >= crashGame.countdownEndsAt) {
    startCrashLive(now);
  }
  if (crashGame.phase === 'live' && crashGame.liveEndsAt && now >= crashGame.liveEndsAt) {
    finishCrashRound(now);
  }
  if (crashGame.phase === 'ended' && crashGame.nextRoundAt && now >= crashGame.nextRoundAt) {
    startCrashRound();
    syncCrashByTime(now);
  }
}

function serializeViewerBet(userId) {
  if (!userId) return null;
  const bet = crashGame.bets.get(String(userId));
  if (!bet) return null;
  const now = Date.now();
  const liveMultiplier = crashGame.phase === 'live' ? currentCrashMultiplier(now) : Number(crashGame.lastCrashMultiplier || 1);
  return buildCrashBetState(bet, { viewer: true, phase: crashGame.phase, liveMultiplier });
}

function serializeActiveBets(userId = null) {
  const now = Date.now();
  const liveMultiplier = crashGame.phase === 'live' ? currentCrashMultiplier(now) : Number(crashGame.lastCrashMultiplier || 1);
  return [...crashGame.bets.values()]
    .filter((bet) => bet.roundId === crashGame.roundId)
    .sort((a, b) => Number(a.placedAt || 0) - Number(b.placedAt || 0))
    .map((bet) => buildCrashBetState(bet, {
      viewer: userId ? String(bet.userId) === String(userId) : false,
      phase: crashGame.phase,
      liveMultiplier,
    }))
    .filter(Boolean);
}

async function serializeCrashState(userId = null) {
  syncCrashByTime();
  const pendingPrize = userId ? await getPendingPrize(userId) : null;
  return {
    serverNow: Date.now(),
    roundId: crashGame.roundId,
    phase: crashGame.phase,
    countdownEndsAt: crashGame.countdownEndsAt || 0,
    liveStartAt: crashGame.liveStartAt,
    liveEndsAt: crashGame.liveEndsAt || 0,
    growthMs: crashGame.growthMs,
    crashTarget: Number(crashGame.crashTarget),
    lastCrashMultiplier: Number(
      crashGame.phase === 'live' ? round2(currentCrashMultiplier()) : round2(crashGame.lastCrashMultiplier || 1)
    ),
    nextRoundAt: crashGame.nextRoundAt || 0,
    history: crashGame.history.map((entry) => ({
      roundId: entry.roundId,
      multiplier: Number(entry.multiplier),
    })),
    betsCount: crashGame.bets.size,
    activeBets: serializeActiveBets(userId),
    pendingPrize,
    viewerBet: serializeViewerBet(userId),
  };
}

function startCrashRound() {
  clearCrashTimers();
  crashGame.roundId += 1;
  crashGame.phase = 'countdown';
  crashGame.countdownEndsAt = Date.now() + CRASH.countdownMs;
  crashGame.liveStartAt = 0;
  crashGame.liveEndsAt = 0;
  crashGame.crashTarget = sampleCrashTarget();
  crashGame.lastCrashMultiplier = 1.0;
  crashGame.nextRoundAt = 0;
  crashGame.growthMs = CRASH.growthMs;
  crashGame.bets = new Map();

  crashGame.timers.start = setTimeout(() => startCrashLive(Date.now()), CRASH.countdownMs);
}

startCrashRound();

app.get('/api/healthz', (req, res) => {
  res.json({ ok: true, now: Date.now() });
});

app.post('/api/init', async (req, res) => {
  const context = requireUserContext(req, res);
  if (!context) return;
  const user = context.user;

  const { data, error } = await sb.rpc('init_user', {
    p_id: user.id,
    p_first_name: user.first_name || 'User',
    p_username: user.username || null,
    p_photo_url: user.photo_url || null,
  });

  if (error) {
    console.error('init_user error:', error);
    return res.status(500).json({ error: error.message });
  }

  const referrerId = extractReferralId(context.startParam);
  if (referrerId && referrerId !== Number(user.id)) {
    const linkResult = await sb.rpc('apply_referral_link', {
      p_user_id: user.id,
      p_referrer_id: referrerId,
    });
    if (linkResult.error) {
      console.error('apply_referral_link error:', linkResult.error);
    }
  }

  res.json(data?.[0] ?? {});
});

app.get('/api/balance', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { data, error } = await sb
    .from('users')
    .select('balance,total_deposited')
    .eq('id', user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.get('/api/referral', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const summary = await getReferralSummary(user.id);
    res.json({
      invitedCount: summary.invitedCount,
      earned: summary.earned,
      referrerLink: `ref_${user.id}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Referral stats failed' });
  }
});


app.get('/api/inventory', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const [items, pendingPrize] = await Promise.all([
      getUserInventory(user.id),
      getPendingPrize(user.id),
    ]);
    res.json({ items, pendingPrize });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Inventory failed' });
  }
});

app.post('/api/inventory/sell', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const giftId = Number(req.body.giftId || 0);
  if (!giftId) return res.status(400).json({ error: 'Missing giftId' });

  try {
    const result = await sellInventoryGift(user.id, giftId);
    const items = await getUserInventory(user.id);
    res.json({ ok: true, ...result, items });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Sell failed' });
  }
});

app.post('/api/inventory/withdraw', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const giftId = Number(req.body.giftId || 0);
  if (!giftId) return res.status(400).json({ error: 'Missing giftId' });

  try {
    const result = await withdrawInventoryGift(user.id, user.id, giftId);
    const items = await getUserInventory(user.id);
    res.json({
      ok: true,
      ...result,
      items,
      message: 'Подарок отправлен в Telegram',
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Withdraw failed' });
  }
});

app.post('/api/inventory/sell-all', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const result = await sellAllInventoryGifts(user.id);
    res.json({ ok: true, ...result, items: [] });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Sell all failed' });
  }
});

app.post('/api/promo/redeem', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Введите промокод' });

  try {
    const rpc = await sb.rpc('apply_promo_code', {
      p_user_id: user.id,
      p_code: code,
    });
    if (rpc.error) throw new Error(rpc.error.message || 'Promo redeem failed');

    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    if (!row?.ok) {
      return res.status(400).json({ error: row?.message || 'Промокод недоступен' });
    }

    const [balanceData, referral] = await Promise.all([
      getUserBalance(user.id),
      getReferralSummary(user.id).catch(() => null),
    ]);

    res.json({
      ok: true,
      reward: Number(row.reward || 0),
      message: row.message || 'Промокод активирован',
      balance: Number(balanceData || 0),
      referral,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Promo redeem failed' });
  }
});

app.post('/api/crash/prize/resolve', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const action = String(req.body.action || '').trim();
  if (!['sell', 'claim'].includes(action)) {
    return res.status(400).json({ error: 'Bad action' });
  }

  try {
    const pendingPrize = await clearPendingPrize(user.id);
    if (!pendingPrize) {
      return res.status(404).json({ error: 'Prize not found' });
    }

    let newBalance = await getUserBalance(user.id);
    let claimedGift = null;

    if (action === 'sell') {
      newBalance = await addWinBalance(user.id, Number(pendingPrize.price || 0));
    } else {
      const savedGift = await addGiftToInventory(user.id, pendingPrize);
      claimedGift = {
        ...savedGift,
        giftId: String(savedGift?.giftId || pendingPrize?.id || ''),
        name: String(savedGift?.name || pendingPrize?.name || 'Gift'),
        price: Number(savedGift?.price || pendingPrize?.price || 0),
        image: String(savedGift?.image || pendingPrize?.image || ''),
      };
    }

    const [items, state] = await Promise.all([
      getUserInventory(user.id),
      serializeCrashState(user.id),
    ]);

    res.json({
      ok: true,
      action,
      prize: pendingPrize,
      newBalance,
      claimedGift,
      items,
      state,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Prize resolve failed' });
  }
});

app.get('/api/payment-status', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const invoiceId = String(req.query.invoiceId || '');
  if (!invoiceId) {
    return res.status(400).json({ error: 'Missing invoiceId' });
  }

  const receipt = paymentReceipts.get(invoiceId);
  if (!receipt || String(receipt.userId) !== String(user.id)) {
    return res.json({ applied: false });
  }

  let balance = null;
  let referral = null;
  try {
    balance = await getUserBalance(user.id);
    referral = await getReferralSummary(user.id);
  } catch {}

  res.json({
    applied: true,
    amount: Number(receipt.amount || 0),
    appliedAt: Number(receipt.appliedAt || 0),
    balance,
    referral,
  });
});

app.post('/api/invoice', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const amount = parseInt(req.body.amount, 10);
  if (!amount || amount < 1 || amount > 100000) {
    return res.status(400).json({ error: 'Bad amount' });
  }

  const invoiceId = crypto.randomUUID();

  const result = await tgApi('createInvoiceLink', {
    title: 'Пополнение баланса',
    description: `Пополнить на ${amount} ⭐`,
    payload: JSON.stringify({ userId: user.id, amount, invoiceId }),
    currency: 'XTR',
    prices: [{ label: `${amount} звёзд`, amount }],
  });

  if (!result.ok) {
    console.error('invoice error:', result);
    return res.status(500).json({ error: result.description });
  }

  res.set('Cache-Control', 'no-store');
  res.json({ invoiceLink: result.result, invoiceId });
});

app.get('/api/top', async (req, res) => {
  const { data: leaders, error } = await sb
    .from('users')
    .select('id,first_name,photo_url,total_deposited')
    .gt('total_deposited', 0)
    .order('total_deposited', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });

  let myRank = null;
  const userId = parseInt(req.query.userId, 10);
  if (Number.isFinite(userId)) {
    const { data: me, error: meError } = await sb
      .from('users')
      .select('total_deposited')
      .eq('id', userId)
      .single();

    if (!meError && Number(me?.total_deposited || 0) > 0) {
      const { count } = await sb
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gt('total_deposited', Number(me.total_deposited || 0));
      myRank = Number(count || 0) + 1;
    }
  }

  res.json({ leaders: leaders ?? [], myRank });
});

app.get('/api/crash/state', async (req, res) => {
  syncCrashByTime();
  const user = validateInitData(getReqInitData(req));
  res.json(await serializeCrashState(user?.id || null));
});

app.post('/api/crash/bet', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  syncCrashByTime();

  if (crashGame.phase !== 'countdown') {
    return res.status(400).json({ error: 'Round already started' });
  }

  const amount = parseInt(req.body.amount, 10);
  if (!amount || amount < 1) {
    return res.status(400).json({ error: 'Bad amount' });
  }

  if (crashGame.bets.has(String(user.id))) {
    return res.status(400).json({ error: 'Bet already placed' });
  }

  try {
    const newBalance = await spendBalance(user.id, amount);
    crashGame.bets.set(String(user.id), {
      userId: user.id,
      firstName: user.first_name || user.username || 'User',
      photoUrl: user.photo_url || null,
      amount,
      roundId: crashGame.roundId,
      placedAt: Date.now(),
      cashedOut: false,
      payout: 0,
    });

    return res.json({
      ok: true,
      newBalance,
      state: await serializeCrashState(user.id),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Bet failed' });
  }
});

app.post('/api/crash/cashout', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  syncCrashByTime();

  const bet = crashGame.bets.get(String(user.id));
  if (!bet || bet.roundId !== crashGame.roundId) {
    return res.status(400).json({ error: 'No active bet' });
  }
  if (bet.cashedOut) {
    return res.status(400).json({ error: 'Already cashed out' });
  }

  const now = Date.now();
  const endedRecently = crashGame.phase === 'ended'
    && crashGame.liveEndsAt
    && (now - Number(crashGame.liveEndsAt || 0)) <= 1600
    && Number(req.body?.roundId || 0) === Number(crashGame.roundId || 0);

  if (crashGame.phase !== 'live' && !endedRecently) {
    return res.status(400).json({ error: 'Round is not live' });
  }

  const serverMultiplier = crashGame.phase === 'live'
    ? currentCrashMultiplier(now)
    : Math.max(1, Math.min(Number(crashGame.lastCrashMultiplier || 1), Number(req.body?.clientMultiplier || 1)));
  const serverPayout = Math.max(0, Math.floor(Number(bet.amount) * serverMultiplier));
  const clientPayout = Math.max(0, Math.floor(Number(req.body?.clientPayout || 0)));
  const maxPossiblePayout = Math.max(0, Math.floor(Number(bet.amount || 0) * Number(crashGame.crashTarget || 1)));
  const payoutTolerance = Math.max(150, Math.floor(serverPayout * 0.08));
  const payout = endedRecently
    ? ((clientPayout > 0 && clientPayout <= maxPossiblePayout) ? clientPayout : serverPayout)
    : (clientPayout >= serverPayout && clientPayout <= maxPossiblePayout && (clientPayout - serverPayout) <= payoutTolerance
      ? clientPayout
      : serverPayout);

  try {
    const newBalance = await addWinBalance(user.id, payout);
    bet.cashedOut = true;
    bet.payout = payout;
    bet.cashedOutAt = now;
    bet.awardedGift = pickCrashGiftForPayout(payout, req.body?.selectedGift || null);

    let pendingPrize = bet.awardedGift;
    if (pendingPrize) {
      pendingPrize = await upsertPendingPrize(user.id, pendingPrize);
      bet.awardedGift = pendingPrize;
    }

    return res.json({
      ok: true,
      payout,
      serverPayout,
      clientPayout,
      newBalance,
      pendingPrize,
      awardedGift: bet.awardedGift || null,
      state: await serializeCrashState(user.id),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Cash out failed' });
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const u = req.body;

  if (u.pre_checkout_query) {
    tgApi('answerPreCheckoutQuery', {
      pre_checkout_query_id: u.pre_checkout_query.id,
      ok: true,
    }).catch((error) => console.error('pre_checkout approve error:', error));
    return;
  }

  console.log('Webhook:', JSON.stringify(u).slice(0, 200));

  if (u.message?.successful_payment) {
    const p = u.message.successful_payment;
    const senderId = u.message.from.id;
    try {
      const { userId, amount, invoiceId } = JSON.parse(p.invoice_payload);
      if (Number(userId) !== senderId) {
        console.error('userId mismatch!');
        return;
      }
      const { error } = await sb.rpc('balance_add', { p_user_id: userId, p_amount: amount });
      if (error) {
        console.error('balance_add error:', error);
      } else {
        paymentReceipts.set(String(invoiceId || `${userId}:${Date.now()}`), {
          userId: Number(userId),
          amount: Number(amount),
          appliedAt: Date.now(),
        });
        console.log(`💫 user ${userId} +${amount}⭐`);
        const rewardResult = await sb.rpc('credit_referral_for_deposit', {
          p_user_id: userId,
          p_deposit_amount: amount,
        });
        if (rewardResult.error) {
          console.error('credit_referral_for_deposit error:', rewardResult.error);
        } else {
          const rewardRow = Array.isArray(rewardResult.data) ? rewardResult.data[0] : rewardResult.data;
          if (Number(rewardRow?.reward || 0) > 0) {
            console.log(`🤝 referral bonus +${rewardRow.reward}⭐ for ${rewardRow.referrer_id}`);
          }
        }
      }
    } catch (e) {
      console.error('Payment error:', e);
    }
  }
});

app.post('/api/set-webhook', async (req, res) => {
  if (req.headers['x-admin-key'] !== CONFIG.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(await tgApi('setWebhook', {
    url: req.body.url,
    allowed_updates: ['message', 'pre_checkout_query'],
  }));
});

app.get('/api/webhook-info', async (req, res) => {
  if (req.headers['x-admin-key'] !== CONFIG.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(await tgApi('getWebhookInfo'));
});

app.listen(CONFIG.PORT, () => console.log(`🚀 Server on port ${CONFIG.PORT}`));
