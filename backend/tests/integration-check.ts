
import prisma from '../src/config/database.js';
import * as messageService from '../src/services/messageService.js';
import * as folderService from '../src/services/folderService.js';
import * as draftService from '../src/services/draftService.js';
import * as threadService from '../src/services/threadService.js';
import * as contactService from '../src/services/contactService.js';
import * as orgTreeService from '../src/services/orgTreeService.js';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('🚀 Starting integration checks...');

  // 1. Setup Users
  console.log('\n--- Setting up Users ---');
  const user1 = await prisma.user.create({
    data: {
      email: `test1_${uuidv4()}@example.com`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'Sender',
      isAdmin: false,
    },
  });
  const user2 = await prisma.user.create({
    data: {
      email: `test2_${uuidv4()}@example.com`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'Receiver',
      isAdmin: false,
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: `admin_${uuidv4()}@example.com`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'Admin',
      isAdmin: true,
    },
  });
  console.log(`✅ Created Users: ${user1.firstName}, ${user2.firstName}, ${admin.firstName}`);

  try {
    // 2. Testing Messages
    console.log('\n--- Testing Messages Module ---');
    
    // Create Folder
    const folder = await folderService.createFolder(user2.id, { name: 'My Project' });
    console.log(`✅ Folder created: ${folder.name}`);

    // Send Message
    const msg1 = await messageService.sendMessage(user1.id, {
      subject: 'Hello',
      content: 'This is a test message',
      recipientIds: [user2.id],
    });
    console.log(`✅ Message sent: ${msg1.subject}`);

    // Check Inbox
    const inbox = await messageService.getInbox(user2.id);
    if (inbox.messages.length === 0 || inbox.messages[0].id !== msg1.id) throw new Error('Message not found in inbox');
    console.log(`✅ Message received in Inbox. Unread: ${inbox.unreadCount}`);

    // Move to Folder
    await messageService.moveToFolder(user2.id, msg1.id, folder.id);
    const folderMsgs = await messageService.getInbox(user2.id, 1, 20, false, folder.id);
    if (folderMsgs.messages.length !== 1) throw new Error('Move to folder failed');
    console.log('✅ Message moved to folder');

    // Reply (Thread)
    const reply = await messageService.sendMessage(user2.id, {
      subject: 'Re: Hello',
      content: 'Reply content',
      recipientIds: [user1.id],
      replyToId: msg1.id,
    });
    console.log('✅ Reply sent');

    // Check Thread
    // Wait a bit for async db ops if any? No, prisma is awaitable.
    // Need to get threadId from message.
    const msg1Updated = await prisma.message.findUnique({ where: { id: msg1.id } });
    if (!msg1Updated?.threadId) throw new Error('Thread ID not created');
    
    const thread = await threadService.getThread(msg1Updated.threadId, user1.id);
    if (!thread || thread.messages.length !== 2) throw new Error('Thread structure incorrect');
    console.log(`✅ Thread verified. Messages: ${thread.messages.length}`);

    // Drafts
    const draft = await draftService.createDraft(user1.id, {
        subject: 'Draft Subject',
        content: 'Draft Content'
    });
    console.log(`✅ Draft created: ${draft.subject}`);
    await draftService.updateDraft(draft.id, user1.id, { content: 'Updated content' });
    console.log('✅ Draft updated');
    
    // 3. Testing Contacts
    console.log('\n--- Testing Contacts Module ---');
    
    await contactService.addToFavorites(user1.id, user2.id);
    const favs = await contactService.getFavorites(user1.id);
    if (favs.length !== 1 || favs[0].id !== user2.id) throw new Error('Favorites failed');
    console.log('✅ Added to favorites');

    await contactService.updateProfile(user1.id, { bio: 'I am a tester' });
    const user1Updated = await contactService.getContactById(user1.id);
    if (user1Updated?.bio !== 'I am a tester') throw new Error('Profile update failed');
    console.log('✅ Profile updated');

    // 4. Testing Org Tree
    console.log('\n--- Testing Org Tree Module ---');
    
    // Create Node (Admin)
    const node1 = await orgTreeService.createNode({
        type: 'custom',
        customTitle: 'CEO',
        customSubtitle: 'Big Boss',
        style: { x: 100, y: 100 }
    });
    console.log('✅ Org Node created');

    const tree = await orgTreeService.getTree();
    if (tree.length === 0) throw new Error('Tree is empty');
    console.log(`✅ Tree fetched. Nodes: ${tree.length}`);

    // 5. Security Checks
    console.log('\n--- Security Checks ---');
    
    // Create attachment record manually for user1
    const attachment = await prisma.messageAttachment.create({
        data: {
            messageId: msg1.id, // msg1 sent by user1 to user2
            fileName: 'secret.pdf',
            fileUrl: 'secret_uuid.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf'
        }
    });

    // Admin tries to download (should be allowed? currently only sender/recipient)
    // Let's check access for a stranger
    const stranger = await prisma.user.create({
        data: {
            email: `stranger_${uuidv4()}@example.com`,
            password: 'password',
            firstName: 'Stranger',
            lastName: 'Danger'
        }
    });

    // We can't easily test controller logic (req/res) here without mocking express.
    // But we can check service logic if we moved logic to service.
    // Logic is in controller currently.
    // Let's just verify that direct DB access via service respects userId.
    
    const draft2 = await draftService.getDraftById(draft.id, stranger.id);
    if (draft2) throw new Error('Security Breach: Stranger can see draft');
    console.log('✅ Stranger cannot see draft');

    // Cleanup extra user
    await prisma.user.delete({ where: { id: stranger.id } });

    // Cleanup (optional, but good for local dev db)
    await prisma.message.deleteMany({ where: { OR: [{ senderId: user1.id }, { senderId: user2.id }] } });
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id, admin.id] } } });
    await prisma.messageFolder.deleteMany({ where: { id: folder.id } });
    await prisma.orgTreeNode.deleteMany({ where: { id: node1.id } });
    console.log('\n✅ Cleanup complete');

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
