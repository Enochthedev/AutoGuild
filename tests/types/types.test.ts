import { Platform, UniversalMessage, UniversalUser, MessageType, UserRole } from '../../src/types';

describe('Type System', () => {
  it('should create a valid UniversalUser', () => {
    const user: UniversalUser = {
      id: 'user123',
      username: 'testuser',
      displayName: 'Test User',
      platform: Platform.DISCORD,
      platformSpecificId: 'discord123',
      roles: [UserRole.MEMBER],
      isBot: false,
    };

    expect(user.id).toBe('user123');
    expect(user.platform).toBe(Platform.DISCORD);
    expect(user.roles).toContain(UserRole.MEMBER);
  });

  it('should create a valid UniversalMessage', () => {
    const user: UniversalUser = {
      id: 'user123',
      username: 'testuser',
      platform: Platform.DISCORD,
      platformSpecificId: 'discord123',
      roles: [UserRole.MEMBER],
      isBot: false,
    };

    const message: UniversalMessage = {
      id: 'msg123',
      content: 'Hello, world!',
      author: user,
      platform: Platform.DISCORD,
      channelId: 'channel123',
      timestamp: new Date(),
      type: MessageType.TEXT,
    };

    expect(message.content).toBe('Hello, world!');
    expect(message.author.username).toBe('testuser');
    expect(message.type).toBe(MessageType.TEXT);
  });

  it('should support all platform types', () => {
    expect(Platform.DISCORD).toBe('discord');
    expect(Platform.WHATSAPP).toBe('whatsapp');
    expect(Platform.TELEGRAM).toBe('telegram');
    expect(Platform.SLACK).toBe('slack');
  });

  it('should support all user roles', () => {
    const roles = [
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.MODERATOR,
      UserRole.MEMBER,
      UserRole.GUEST,
    ];

    expect(roles).toHaveLength(5);
  });

  it('should support all message types', () => {
    const types = [
      MessageType.TEXT,
      MessageType.IMAGE,
      MessageType.VIDEO,
      MessageType.AUDIO,
      MessageType.FILE,
      MessageType.STICKER,
    ];

    expect(types).toHaveLength(6);
  });
});
