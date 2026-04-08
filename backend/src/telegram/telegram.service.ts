import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import FormData from 'form-data';
import { UsersService } from '../users/users.service';
import { CartridgesService } from '../cartridges/cartridges.service';
import { WorksService } from '../works/works.service';
import { NotesService } from '../notes/notes.service';

type BotSession = {
  state:
    | 'idle'
    | 'add_work_cartridge'
    | 'add_work_desc'
    | 'add_note_cartridge'
    | 'add_note_text';
  cartridgeId?: number;
  cartridgeName?: string;
};

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot;
  private sessions = new Map<number, BotSession>();

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly cartridgesService: CartridgesService,
    private readonly worksService: WorksService,
    private readonly notesService: NotesService,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'your_telegram_bot_token_here') {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set – bot disabled');
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.registerHandlers();
    this.logger.log('Telegram bot started');
  }

  private getSession(chatId: number): BotSession {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, { state: 'idle' });
    }
    return this.sessions.get(chatId)!;
  }

  private async getAuthorizedUser(tgId: string) {
    return this.usersService.findByTgId(tgId);
  }

  private registerHandlers() {
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const tgId = String(msg.from?.id);
      const user = await this.getAuthorizedUser(tgId);

      if (!user) {
        return this.bot.sendMessage(
          chatId,
          '⛔ You are not authorized. Please contact the administrator to link your Telegram account.',
        );
      }

      this.bot.sendMessage(
        chatId,
        `👋 Hello, *${user.username}*! Welcome to the Cartridge Management System.\n\nYour role: *${user.role}*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔧 Add Work', callback_data: 'add_work' },
                { text: '📝 Add Note', callback_data: 'add_note' },
              ],
              [{ text: '📋 List Cartridges', callback_data: 'list_cartridges' }],
            ],
          },
        },
      );
    });

    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id!;
      const tgId = String(query.from.id);
      const user = await this.getAuthorizedUser(tgId);

      if (!user) {
        return this.bot.answerCallbackQuery(query.id, {
          text: 'Not authorized',
        });
      }

      await this.bot.answerCallbackQuery(query.id);

      if (query.data === 'add_work') {
        if (user.role === 'viewer') {
          return this.bot.sendMessage(chatId, '⛔ You do not have permission to add works.');
        }
        const session = this.getSession(chatId);
        session.state = 'add_work_cartridge';
        return this.bot.sendMessage(
          chatId,
          '🔍 Please enter the cartridge name to search:',
        );
      }

      if (query.data === 'add_note') {
        if (user.role === 'viewer') {
          return this.bot.sendMessage(chatId, '⛔ You do not have permission to add notes.');
        }
        const session = this.getSession(chatId);
        session.state = 'add_note_cartridge';
        return this.bot.sendMessage(
          chatId,
          '🔍 Please enter the cartridge name to search:',
        );
      }

      if (query.data === 'list_cartridges') {
        const cartridges = await this.cartridgesService.findAll();
        if (cartridges.length === 0) {
          return this.bot.sendMessage(chatId, 'No cartridges found.');
        }
        const list = cartridges
          .slice(0, 20)
          .map((c) => `• *${c.name}* (${c.model})`)
          .join('\n');
        return this.bot.sendMessage(chatId, `📋 *Cartridges:*\n${list}`, {
          parse_mode: 'Markdown',
        });
      }

      if (query.data?.startsWith('select_cartridge:')) {
        const parts = query.data.split(':');
        const cartridgeId = parseInt(parts[1]);
        const cartridgeName = parts.slice(2).join(':');
        const session = this.getSession(chatId);
        session.cartridgeId = cartridgeId;
        session.cartridgeName = cartridgeName;

        if (session.state === 'add_work_cartridge') {
          session.state = 'add_work_desc';
          return this.bot.sendMessage(
            chatId,
            `✅ Selected: *${cartridgeName}*\n\nNow enter the work description:`,
            { parse_mode: 'Markdown' },
          );
        }

        if (session.state === 'add_note_cartridge') {
          session.state = 'add_note_text';
          return this.bot.sendMessage(
            chatId,
            `✅ Selected: *${cartridgeName}*\n\nNow enter the note text:`,
            { parse_mode: 'Markdown' },
          );
        }
      }
    });

    this.bot.on('voice', async (msg) => {
      const chatId = msg.chat.id;
      const tgId = String(msg.from?.id);
      const user = await this.getAuthorizedUser(tgId);

      if (!user) {
        return this.bot.sendMessage(chatId, '⛔ Not authorized.');
      }

      const openaiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!openaiKey || openaiKey === 'your_openai_api_key_here') {
        return this.bot.sendMessage(
          chatId,
          '🎤 Voice messages are not supported (no OpenAI API key configured). Please send text instead.',
        );
      }

      try {
        await this.bot.sendMessage(chatId, '🎤 Processing voice message...');
        const fileId = msg.voice!.file_id;
        const fileInfo = await this.bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${this.config.get('TELEGRAM_BOT_TOKEN')}/${fileInfo.file_path}`;

        const response = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
        });
        const audioBuffer = Buffer.from(response.data);

        const form = new FormData();
        form.append('file', audioBuffer, {
          filename: 'voice.ogg',
          contentType: 'audio/ogg',
        });
        form.append('model', 'whisper-1');

        const whisperResponse = await axios.post(
          'https://api.openai.com/v1/audio/transcriptions',
          form,
          {
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              ...form.getHeaders(),
            },
          },
        );

        const text = whisperResponse.data.text;
        const session = this.getSession(chatId);

        if (session.state === 'add_work_desc' && session.cartridgeId) {
          await this.worksService.create(
            {
              cartridge_id: session.cartridgeId,
              description: text,
              performed_at: new Date().toISOString(),
            },
            user.id,
          );
          session.state = 'idle';
          return this.bot.sendMessage(
            chatId,
            `✅ Work added to *${session.cartridgeName}*:\n"${text}"`,
            { parse_mode: 'Markdown' },
          );
        }

        if (session.state === 'add_note_text' && session.cartridgeId) {
          await this.notesService.create(
            {
              cartridge_id: session.cartridgeId,
              content: text,
            },
            user.id,
          );
          session.state = 'idle';
          return this.bot.sendMessage(
            chatId,
            `✅ Note added to *${session.cartridgeName}*:\n"${text}"`,
            { parse_mode: 'Markdown' },
          );
        }

        return this.bot.sendMessage(
          chatId,
          `🎤 Transcribed: "${text}"\n\nUse /start to begin adding a work or note.`,
        );
      } catch (err) {
        this.logger.error('Voice processing error', err);
        return this.bot.sendMessage(
          chatId,
          '❌ Failed to process voice message. Please try again or send text.',
        );
      }
    });

    this.bot.on('message', async (msg) => {
      if (msg.voice || msg.text?.startsWith('/')) return;

      const chatId = msg.chat.id;
      const tgId = String(msg.from?.id);
      const text = msg.text?.trim();

      if (!text) return;

      const user = await this.getAuthorizedUser(tgId);
      if (!user) {
        return this.bot.sendMessage(chatId, '⛔ Not authorized.');
      }

      const session = this.getSession(chatId);

      if (
        session.state === 'add_work_cartridge' ||
        session.state === 'add_note_cartridge'
      ) {
        const cartridges = await this.cartridgesService.findByName(text);
        if (cartridges.length === 0) {
          return this.bot.sendMessage(
            chatId,
            `❌ No cartridges found matching "*${text}*". Try a different search term.`,
            { parse_mode: 'Markdown' },
          );
        }

        const keyboard = cartridges.map((c) => [
          {
            text: `${c.name} — ${c.model}`,
            callback_data: `select_cartridge:${c.id}:${c.name}`,
          },
        ]);

        return this.bot.sendMessage(chatId, '📋 Select a cartridge:', {
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      if (session.state === 'add_work_desc' && session.cartridgeId) {
        if (user.role === 'viewer') {
          session.state = 'idle';
          return this.bot.sendMessage(chatId, '⛔ No permission.');
        }
        await this.worksService.create(
          {
            cartridge_id: session.cartridgeId,
            description: text,
            performed_at: new Date().toISOString(),
          },
          user.id,
        );
        session.state = 'idle';
        return this.bot.sendMessage(
          chatId,
          `✅ Work added to *${session.cartridgeName}*:\n"${text}"`,
          { parse_mode: 'Markdown' },
        );
      }

      if (session.state === 'add_note_text' && session.cartridgeId) {
        if (user.role === 'viewer') {
          session.state = 'idle';
          return this.bot.sendMessage(chatId, '⛔ No permission.');
        }
        await this.notesService.create(
          {
            cartridge_id: session.cartridgeId,
            content: text,
          },
          user.id,
        );
        session.state = 'idle';
        return this.bot.sendMessage(
          chatId,
          `✅ Note added to *${session.cartridgeName}*:\n"${text}"`,
          { parse_mode: 'Markdown' },
        );
      }

      this.bot.sendMessage(
        chatId,
        'Use /start to see available commands.',
      );
    });
  }
}
