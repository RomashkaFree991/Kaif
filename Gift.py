import asyncio
import logging
import uuid
import random
import datetime

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandObject
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import (
    LabeledPrice, 
    PreCheckoutQuery, 
    SuccessfulPayment, 
    InlineQueryResultArticle, 
    InputTextMessageContent
)
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# ==========================================
# --- КОНФИГУРАЦИЯ БОТА ---
# ==========================================

TOKEN = "8271218748:AAHeJIQMXcN66Y0XglVcUByyIV0w9fPyS5c"
ADMIN_ID = 7968792398

# Инициализация бота и диспетчера
bot = Bot(token=TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# ==========================================
# --- БАЗЫ ДАННЫХ (В ПАМЯТИ) ---
# ==========================================

# Настройки бота (вкл/выкл выигрыши)
bot_settings = {
    "winning_enabled": True
}

# База созданных чеков
checks_db = {} 

# Временное хранилище текстов для чеков
temp_texts = {}

# База пользователей (id -> username, name)
users_db = {}       

# Активные чаты с админом (для техподдержки)
active_chats = {}   

# ==========================================
# --- МАШИНА СОСТОЯНИЙ (FSM) ---
# ==========================================

class CheckCreation(StatesGroup):
    """Состояния для создания чека"""
    choosing_gift = State()
    writing_text = State()

class GameStates(StatesGroup):
    """Состояния для игры"""
    entering_bet = State()
    picking_number = State()

# ==========================================
# --- СПИСОК ПОДАРКОВ ---
# ==========================================
# Цены обновлены на 60 для указанных предметов

GIFTS = {
    "tree": {
        "name": "Ёлка", 
        "price": 60, 
        "id": "5922558454332916696", 
        "media": "https://t.me/roxmangetgift/22"
    },
    "bear_ny": {
        "name": "Медведь (НГ)", 
        "price": 60, 
        "id": "5956217000635139069", 
        "media": "https://t.me/roxmangetgift/23"
    },
    "bear_14": {
        "name": "Медведь (14 фев)", 
        "price": 60, 
        "id": "5800655655995968830", 
        "media": "https://t.me/roxmangetgift/24"
    },
    "heart_14": {
        "name": "Сердце (14 фев)", 
        "price": 60, 
        "id": "5801108895304779062", 
        "media": "https://t.me/roxmangetgift/25"
    },
    "champ": {
        "name": "Шампанское", 
        "price": 51, 
        "id": "6028601630662853006", 
        "media": "https://t.me/roxmangetgift/26"
    },
    "gift": {
        "name": "Подарок", 
        "price": 26, 
        "id": "5170250947678437525", 
        "media": "https://t.me/roxmangetgift/27"
    },
    "heart": {
        "name": "Сердце", 
        "price": 16, 
        "id": "5170145012310081615", 
        "media": "https://t.me/roxmangetgift/28"
    },
    "rose": {
        "name": "Роза", 
        "price": 26, 
        "id": "5168103777563050263", 
        "media": "https://t.me/roxmangetgift/29"
    },
    "bear": {
        "name": "Медведь", 
        "price": 16, 
        "id": "5170233102089322756", 
        "media": "https://t.me/roxmangetgift/30"
    },
    "cup": {
        "name": "Кубок", 
        "price": 101, 
        "id": "5168043875654172773", 
        "media": "https://t.me/roxmangetgift/31"
    },
    "rocket": {
        "name": "Ракета", 
        "price": 51, 
        "id": "5170564780938756245", 
        "media": "https://t.me/roxmangetgift/32"
    },
    "bouquet": {
        "name": "Букет", 
        "price": 51, 
        "id": "5170314324215857265", 
        "media": "https://t.me/roxmangetgift/33"
    },
    "cake": {
        "name": "Торт", 
        "price": 51, 
        "id": "5170144170496491616", 
        "media": "https://t.me/roxmangetgift/34"
    },
    "ring": {
        "name": "Кольцо", 
        "price": 101, 
        "id": "5170690322832818290", 
        "media": "https://t.me/roxmangetgift/35"
    },
    "diamond": {
        "name": "Алмаз", 
        "price": 101, 
        "id": "5170521118301225164", 
        "media": "https://t.me/roxmangetgift/36"
    },
}

# ==========================================
# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
# ==========================================

async def create_check_link(user_id, gift_key, text):
    """Создает уникальную ссылку на чек и сохраняет его в БД"""
    check_id = f"chk_{uuid.uuid4().hex[:10]}"
    
    checks_db[check_id] = {
        "gift_key": gift_key, 
        "text": text, 
        "creator_id": user_id
    }
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🔗 Отправить другу", switch_inline_query=check_id)
    
    gift_name = GIFTS[gift_key]['name']
    return f"✅ Чек на <b>{gift_name}</b> готов!", builder.as_markup()

# ==========================================
# --- ОБРАБОТЧИК АДМИНСКИХ КОМАНД (/l) ---
# ==========================================

@dp.message(Command("l"))
async def handle_l_command(message: types.Message):
    if message.from_user.id != ADMIN_ID: 
        return
    
    parts = message.text.split(maxsplit=2)
    if len(parts) < 2: 
        return
    
    # Режим чата: /l @username on/off
    if parts[1].startswith("@") and len(parts) == 3 and parts[2].lower() in ["on", "off"]:
        username = parts[1].replace("@", "").lower()
        
        target_id = None
        for uid, info in users_db.items():
            if info['username'] and info['username'].lower() == username:
                target_id = uid
                break
        
        if not target_id:
            await message.answer("Юзер не найден в базе.")
            return

        if parts[2].lower() == "on":
            active_chats[ADMIN_ID] = target_id
            await message.answer(f"Чат с @{username} ВКЛ.")
        else:
            active_chats.pop(ADMIN_ID, None)
            await message.answer(f"Чат с @{username} ВЫКЛ.")
    
    # Режим рассылки: /l текст
    else:
        txt = message.text[3:].strip()
        count = 0
        blocked = 0
        
        for uid in users_db.keys():
            try: 
                await bot.send_message(uid, txt)
                count += 1
            except: 
                blocked += 1
        
        await message.answer(
            f"Статистика рассылки:\n"
            f"✅ Успешно: {count}\n"
            f"❌ Заблокировано: {blocked}"
        )

# ==========================================
# --- ИНЛАЙН РЕЖИМ (ОТПРАВКА ЧЕКА) ---
# ==========================================

@dp.inline_query()
async def inline_handler(query: types.InlineQuery):
    check_id = query.query.strip()
    
    if check_id in checks_db:
        c = checks_db[check_id]
        g = GIFTS[c['gift_key']]
        
        kb = InlineKeyboardBuilder()
        kb.button(text="🎁 Забрать подарок", url=f"https://t.me/{(await bot.get_me()).username}?start={check_id}")
        
        # Формирование превью
        text = f"<a href='{g['media']}'>&#8203;</a>✨ Вам подарок: <b>{g['name']}</b>!"
        if c['text']: 
            text += f"\n\n💬 <i>«{c['text']}»</i>"
            
        result = InlineQueryResultArticle(
            id=check_id, 
            title=f"Подарок: {g['name']}",
            input_message_content=InputTextMessageContent(message_text=text, parse_mode="HTML"),
            reply_markup=kb.as_markup()
        )
        await query.answer([result], is_personal=True, cache_time=1)

# ==========================================
# --- СТАРТ И МЕНЮ ---
# ==========================================

@dp.message(Command("start"))
async def cmd_start(message: types.Message, command: CommandObject, state: FSMContext):
    # Сохраняем юзера
    users_db[message.from_user.id] = {
        "username": message.from_user.username, 
        "name": message.from_user.full_name
    }
    
    # Если перешли по ссылке чека
    if command.args and command.args.startswith("chk"):
        cid = command.args
        if cid in checks_db:
            c = checks_db[cid]
            try:
                await bot.send_gift(
                    user_id=message.from_user.id, 
                    gift_id=GIFTS[c['gift_key']]['id'], 
                    text=c['text'] or None
                )
                await message.answer(f"🎁 Вы получили подарок: {GIFTS[c['gift_key']]['name']}!")
                del checks_db[cid]
            except: 
                await message.answer("❌ Ошибка отправки (возможно, у бота закончились звезды).")
        return

    await state.clear()
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🎁 Подарки", callback_data="menu_gifts")
    builder.button(text="🎫 Создать чек", callback_data="create_check")
    builder.button(text="🎮 Игры", callback_data="menu_games")
    
    if message.from_user.id == ADMIN_ID:
        builder.button(text="🛠 Админ панель", callback_data="admin_panel")
    
    builder.adjust(1)
    await message.answer("<b>Главное меню:</b>", reply_markup=builder.as_markup(), parse_mode="HTML")

# ==========================================
# --- ПОКУПКА ПОДАРКОВ СЕБЕ ---
# ==========================================

@dp.callback_query(F.data == "menu_gifts")
async def menu_self(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    # Сортировка по цене
    for k, v in sorted(GIFTS.items(), key=lambda x: x[1]['price']):
        builder.button(text=f"{v['name']} — {v['price']} ⭐", callback_data=f"buy_self:{k}")
    
    builder.adjust(1).button(text="⬅️ Назад", callback_data="to_main")
    await callback.message.edit_text("Выберите подарок для покупки себе:", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("buy_self:"))
async def buy_self_inv(callback: types.CallbackQuery):
    gk = callback.data.split(":")[1]
    
    await bot.send_invoice(
        chat_id=callback.from_user.id, 
        title=f"Подарок: {GIFTS[gk]['name']}", 
        description=f"Покупка подарка себе за {GIFTS[gk]['price']} ⭐", 
        payload=f"self:{gk}", 
        currency="XTR", 
        prices=[LabeledPrice(label="Оплата", amount=GIFTS[gk]['price'])], 
        provider_token=""
    )

# ==========================================
# --- СОЗДАНИЕ ЧЕКА ---
# ==========================================

@dp.callback_query(F.data.in_(["create_check", "admin_free_check"]))
async def start_check(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(is_free=(callback.data == "admin_free_check"))
    
    builder = InlineKeyboardBuilder()
    sorted_gifts = sorted(GIFTS.items(), key=lambda x: x[1]['price'])
    
    for k, v in sorted_gifts: 
        builder.button(text=f"{v['name']} ({v['price']} ⭐)", callback_data=f"chk_gift:{k}")
    builder.adjust(1)
    
    await state.set_state(CheckCreation.choosing_gift)
    await callback.message.edit_text("Выберите подарок для создания чека:", reply_markup=builder.as_markup())

@dp.callback_query(CheckCreation.choosing_gift, F.data.startswith("chk_gift:"))
async def chk_gift_chosen(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(gift_key=callback.data.split(":")[1])
    await state.set_state(CheckCreation.writing_text)
    
    builder = InlineKeyboardBuilder().button(text="Пропустить ➡️", callback_data="skip_text")
    await callback.message.edit_text("Введите текст поздравления (или пропустите):", reply_markup=builder.as_markup())

@dp.callback_query(CheckCreation.writing_text, F.data == "skip_text")
async def chk_text_skipped(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    gk = data['gift_key']
    
    if data.get('is_free'):
        msg, kb = await create_check_link(callback.from_user.id, gk, "")
        await callback.message.answer(msg, reply_markup=kb, parse_mode="HTML")
    else:
        temp_texts[callback.from_user.id] = ""
        now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
        invoice_desc = f"Чек\nПодарок: {GIFTS[gk]['name']}\nЦена: {GIFTS[gk]['price']} ⭐\nДата: {now}\nОписание: -"
        
        await bot.send_invoice(
            chat_id=callback.from_user.id, 
            title="Оплата чека", 
            description=invoice_desc, 
            payload=f"check:{gk}", 
            currency="XTR", 
            prices=[LabeledPrice(label="Оплатить", amount=GIFTS[gk]['price'])], 
            provider_token=""
        )
    await state.clear()

# ==========================================
# --- ИГРОВАЯ СИСТЕМА ---
# ==========================================

@dp.callback_query(F.data == "menu_games")
async def menu_games(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    builder.button(text="🔢 Отгадай число", callback_data="game_info")
    builder.button(text="⬅️ Назад", callback_data="to_main")
    builder.adjust(1)
    await callback.message.edit_text("Раздел игр:", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "game_info")
async def game_info(callback: types.CallbackQuery):
    text = (
        "🎲 <b>Игра «Отгадай число»</b>\n\n"
        "Правила просты: сделай ставку и выбери число от 1 до 3.\n"
        "Шанс победы: 33%.\n"
        "Ставки: 5-10 ⭐ (мелкие призы) или 15-20+ ⭐ (крупные призы)."
    )
    builder = InlineKeyboardBuilder()
    builder.button(text="🚀 Начать игру", callback_data="game_start")
    
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="HTML")

@dp.callback_query(F.data == "game_start")
async def game_bet_in(callback: types.CallbackQuery, state: FSMContext):
    await state.set_state(GameStates.entering_bet)
    await callback.message.answer("💸 Введите сумму вашей ставки (минимум 5 звезд):")

# ==========================================
# --- ОБРАБОТКА ОПЛАТЫ ---
# ==========================================

@dp.pre_checkout_query()
async def pre_checkout(q: PreCheckoutQuery):
    await q.answer(ok=True)

@dp.message(F.successful_payment)
async def on_pay(message: types.Message, state: FSMContext):
    p = message.successful_payment.invoice_payload
    uid = message.from_user.id
    
    # Оплата чека
    if p.startswith("check:"):
        gk = p.split(":")[1]
        msg, kb = await create_check_link(uid, gk, temp_texts.get(uid, ""))
        await message.answer(msg, reply_markup=kb, parse_mode="HTML")
    
    # Оплата ставки в игре
    elif p.startswith("game:"):
        amt = int(p.split(":")[1])
        await state.update_data(paid_bet=amt)
        await state.set_state(GameStates.picking_number)
        
        kb = InlineKeyboardBuilder()
        for i in range(1, 4):
            kb.button(text=str(i), callback_data=f"guess:{i}")
        kb.adjust(3)
        
        await message.answer(f"Ставка {amt} ⭐ принята! Выбери число (1-3):", reply_markup=kb.as_markup())
    
    # Оплата подарка себе
    elif p.startswith("self:"):
        await bot.send_gift(user_id=uid, gift_id=GIFTS[p.split(":")[1]]['id'])
        await message.answer("✅ Подарок успешно отправлен вам в профиль!")

# ==========================================
# --- ИГРОВАЯ ЛОГИКА (РЕЗУЛЬТАТ) ---
# ==========================================

@dp.callback_query(GameStates.picking_number, F.data.startswith("guess:"))
async def game_res(callback: types.CallbackQuery, state: FSMContext):
    choice = int(callback.data.split(":")[1])
    data = await state.get_data()
    bet = data.get("paid_bet", 5)
    
    # Определение выигрыша
    if not bot_settings["winning_enabled"]:
        # Режим проигрыша: выбираем любое число, кроме выбранного игроком
        w = [1, 2, 3]
        if choice in w:
            w.remove(choice)
        win_num = random.choice(w)
        is_win = False
    else:
        # Честный рандом
        win_num = random.randint(1, 3)
        is_win = (choice == win_num)
    
    if is_win:
        # Выбор приза в зависимости от ставки
        small_prizes = ["bear", "heart", "gift", "rose"]
        big_prizes = ["tree", "bear_ny", "bear_14", "heart_14"]
        
        if bet <= 10:
            prz = random.choice(small_prizes)
        else:
            prz = random.choice(big_prizes)
            
        try:
            await bot.send_gift(user_id=callback.from_user.id, gift_id=GIFTS[prz]['id'])
            await callback.message.edit_text(f"🎉 <b>ПОБЕДА!</b> Выпало число {win_num}.\nВам отправлен подарок: {GIFTS[prz]['name']}", parse_mode="HTML")
        except:
            await callback.message.edit_text(f"🎉 <b>ПОБЕДА!</b> Выпало число {win_num}.\nНо у бота закончились звезды для отправки подарка.", parse_mode="HTML")
    else:
        await callback.message.edit_text(f"❌ <b>ПРОИГРЫШ!</b> Выпало число {win_num}. Попробуйте еще раз!", parse_mode="HTML")
    
    await state.clear()

# ==========================================
# --- ОБРАБОТКА ТЕКСТА (ВВОД И ЧАТ) ---
# ==========================================

@dp.message(F.text)
async def text_handler(message: types.Message, state: FSMContext):
    curr_state = await state.get_state()
    
    # 1. Если вводят текст для чека
    if curr_state == CheckCreation.writing_text:
        data = await state.get_data()
        gk = data['gift_key']
        
        if data.get('is_free'):
            msg, kb = await create_check_link(message.from_user.id, gk, message.text)
            await message.answer(msg, reply_markup=kb, parse_mode="HTML")
        else:
            temp_texts[message.from_user.id] = message.text
            now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
            invoice_desc = f"Чек\nПодарок: {GIFTS[gk]['name']}\nЦена: {GIFTS[gk]['price']} ⭐\nДата: {now}\nОписание: {message.text}"
            
            await bot.send_invoice(
                chat_id=message.from_user.id, 
                title="Оплата чека", 
                description=invoice_desc, 
                payload=f"check:{gk}", 
                currency="XTR", 
                prices=[LabeledPrice(label="Оплатить", amount=GIFTS[gk]['price'])], 
                provider_token=""
            )
        await state.clear()
        return

    # 2. Если вводят ставку для игры
    if curr_state == GameStates.entering_bet:
        if message.text.isdigit():
            amt = int(message.text)
            
            # Проверка минимальной ставки
            if amt < 5:
                await message.answer("❌ Минимальная ставка — 5 звёзд! Введите число больше или равно 5.")
                return
            
            # ОТПРАВКА ИНВОЙСА С КРАСИВЫМ ОПИСАНИЕМ
            await bot.send_invoice(
                chat_id=message.from_user.id, 
                title="🎲 Ставка: Угадай число", 
                description=f"Ставка {amt} ⭐ на игру.\nУгадайте число от 1 до 3 и получите подарок!", 
                payload=f"game:{amt}", 
                currency="XTR", 
                prices=[LabeledPrice(label=f"Ставка {amt} ⭐", amount=amt)], 
                provider_token=""
            )
            await state.clear()
            return

    # 3. Админ-чат (техподдержка)
    if message.from_user.id == ADMIN_ID and ADMIN_ID in active_chats:
        try: 
            await bot.send_message(active_chats[ADMIN_ID], f"💬 Админ: {message.text}")
        except: 
            pass
        return
        
    for aid, tid in active_chats.items():
        if message.from_user.id == tid:
            await bot.send_message(aid, f"👤 @{message.from_user.username}: {message.text}")
            return

# ==========================================
# --- АДМИН ПАНЕЛЬ ---
# ==========================================

@dp.callback_query(F.data == "admin_panel")
async def admin_panel(c: types.CallbackQuery):
    if c.from_user.id != ADMIN_ID: 
        return
    
    status = "✅ ВКЛ" if bot_settings["winning_enabled"] else "❌ ВЫКЛ"
    
    kb = InlineKeyboardBuilder()
    kb.button(text=f"Выигрыши: {status}", callback_data="toggle_w")
    kb.button(text="🧪 Тест Подарок", callback_data="t_p")
    kb.button(text="🧪 Тест Чек", callback_data="admin_free_check")
    kb.button(text="👥 Юзеры", callback_data="u_l")
    kb.button(text="⬅️ Назад", callback_data="to_main")
    kb.adjust(1)
    
    await c.message.edit_text(f"🔧 <b>Админ панель</b>\nСтатус выигрышей: {status}", reply_markup=kb.as_markup(), parse_mode="HTML")

@dp.callback_query(F.data == "toggle_w")
async def tw(c: types.CallbackQuery): 
    bot_settings["winning_enabled"] = not bot_settings["winning_enabled"]
    await admin_panel(c)

@dp.callback_query(F.data == "t_p")
async def tp(c: types.CallbackQuery):
    try: 
        await bot.send_gift(user_id=c.from_user.id, gift_id=GIFTS["bear"]["id"])
        await c.answer("Тестовый подарок отправлен!")
    except: 
        await c.answer("Ошибка: нет звезд или сбой API", show_alert=True)

@dp.callback_query(F.data == "u_l")
async def ul(c: types.CallbackQuery):
    # Генерация списка пользователей
    lines = []
    for uid, info in users_db.items():
        lines.append(f"• {info['name']} (@{info['username']}) [ID: {uid}]")
        
    txt = "\n".join(lines)
    if not txt:
        txt = "База пользователей пуста."
        
    # Разбиваем на части, если слишком длинное сообщение
    if len(txt) > 4000:
        txt = txt[:4000] + "... (обрезано)"
        
    await c.message.answer(txt)
    await c.answer()

@dp.callback_query(F.data == "to_main")
async def back(c: types.CallbackQuery, state: FSMContext): 
    await state.clear()
    await cmd_start(c.message, CommandObject(command="start"), state)

# ==========================================
# --- ЗАПУСК БОТА ---
# ==========================================

async def main():
    logging.basicConfig(level=logging.INFO)
    print("Бот запущен...")
    await dp.start_polling(bot)

if __name__ == "__main__": 
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        print("Бот остановлен.")
