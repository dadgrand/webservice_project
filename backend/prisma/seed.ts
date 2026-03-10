import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';
const seedDemoData = process.env.SEED_DEMO_DATA
  ? process.env.SEED_DEMO_DATA === 'true'
  : !isProduction;
const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null;
const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || null;

async function upsertAdmin(departmentId: string) {
  if (bootstrapAdminEmail && bootstrapAdminPassword) {
    const password = await bcrypt.hash(bootstrapAdminPassword, 12);
    const admin = await prisma.user.upsert({
      where: { email: bootstrapAdminEmail },
      update: {
        departmentId,
        password,
        isAdmin: true,
        isActive: true,
      },
      create: {
        email: bootstrapAdminEmail,
        password,
        firstName: 'Системный',
        lastName: 'Администратор',
        middleName: null,
        position: 'Системный администратор',
        departmentId,
        isAdmin: true,
        isActive: true,
        bio: 'Первичный администратор, созданный через bootstrap-переменные окружения.',
      },
    });

    console.log(`✅ Bootstrap admin created/updated: ${admin.email}`);
    return admin;
  }

  if (seedDemoData) {
    const adminEmail = 'admin@hospital.local';
    const adminPassword = await bcrypt.hash('admin123', 12);

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { departmentId, password: adminPassword, isAdmin: true, isActive: true },
      create: {
        email: adminEmail,
        password: adminPassword,
        firstName: 'Александр',
        lastName: 'Администратов',
        middleName: 'Сергеевич',
        position: 'Системный администратор',
        departmentId,
        phone: '+7 (495) 123-45-67',
        phoneInternal: '100',
        isAdmin: true,
        isActive: true,
        bio: 'Ответственный за работу информационных систем больницы.',
      },
    });

    console.log(`✅ Demo admin created: ${admin.email}`);
    return admin;
  }

  console.log('ℹ️ Demo accounts skipped. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first admin.');
  return null;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Создаем разрешения
  const permissions = [
    { code: 'tests.edit', name: 'Редактирование тестов', description: 'Создание и редактирование тестов для персонала', category: 'tests' },
    { code: 'tests.stats', name: 'Просмотр статистики тестов', description: 'Просмотр результатов и статистики прохождения тестов', category: 'tests' },
    { code: 'learning.edit', name: 'Редактирование обучающих материалов', description: 'Создание и редактирование курсов и уроков', category: 'learning' },
    { code: 'learning.stats', name: 'Просмотр статистики обучения', description: 'Просмотр прогресса обучения сотрудников', category: 'learning' },
    { code: 'documents.edit', name: 'Управление документами', description: 'Загрузка, редактирование и удаление документов', category: 'documents' },
    { code: 'messages.broadcast', name: 'Массовые рассылки', description: 'Отправка сообщений всем или группе сотрудников', category: 'messages' },
    { code: 'news.manage', name: 'Управление новостями', description: 'Создание, редактирование и удаление новостей на главной странице', category: 'news' },
    { code: 'users.view', name: 'Просмотр пользователей', description: 'Просмотр списка пользователей системы', category: 'users' },
    { code: 'users.manage', name: 'Управление пользователями', description: 'Создание, редактирование и удаление пользователей', category: 'users' },
  ];

  console.log('Creating permissions...');
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    });
  }
  console.log(`✅ Created ${permissions.length} permissions`);

  // Создаем организационную структуру
  console.log('Creating department structure...');
  
  const hospital = await prisma.department.upsert({
    where: { id: 'hospital-main' },
    update: {},
    create: {
      id: 'hospital-main',
      name: 'Городская больница №1',
      description: 'Главное здание',
      color: '#1976d2',
      order: 0,
    },
  });

  const administration = await prisma.department.upsert({
    where: { id: 'dept-admin' },
    update: {},
    create: {
      id: 'dept-admin',
      name: 'Администрация',
      description: 'Руководство больницы',
      parentId: hospital.id,
      color: '#9c27b0',
      order: 1,
    },
  });

  const therapy = await prisma.department.upsert({
    where: { id: 'dept-therapy' },
    update: {},
    create: {
      id: 'dept-therapy',
      name: 'Терапевтическое отделение',
      description: 'Лечение терапевтических заболеваний',
      parentId: hospital.id,
      color: '#2e7d32',
      order: 2,
    },
  });

  const surgery = await prisma.department.upsert({
    where: { id: 'dept-surgery' },
    update: {},
    create: {
      id: 'dept-surgery',
      name: 'Хирургическое отделение',
      description: 'Хирургические операции',
      parentId: hospital.id,
      color: '#d32f2f',
      order: 3,
    },
  });

  const cardiology = await prisma.department.upsert({
    where: { id: 'dept-cardio' },
    update: {},
    create: {
      id: 'dept-cardio',
      name: 'Кардиология',
      description: 'Сердечно-сосудистые заболевания',
      parentId: therapy.id,
      color: '#ed6c02',
      order: 1,
    },
  });

  const neurology = await prisma.department.upsert({
    where: { id: 'dept-neuro' },
    update: {},
    create: {
      id: 'dept-neuro',
      name: 'Неврология',
      description: 'Заболевания нервной системы',
      parentId: therapy.id,
      color: '#0288d1',
      order: 2,
    },
  });

  const it = await prisma.department.upsert({
    where: { id: 'dept-it' },
    update: {},
    create: {
      id: 'dept-it',
      name: 'IT отдел',
      description: 'Информационные технологии',
      parentId: administration.id,
      color: '#7b1fa2',
      order: 1,
    },
  });

  console.log('✅ Created department structure');

  const admin = await upsertAdmin(it.id);

  // Создаем тестовых пользователей
  if (!seedDemoData) {
    console.log('ℹ️ Demo users and test content skipped.');
    console.log('\n🎉 Database seed completed!');
    return;
  }

  const users = [
    {
      email: 'ivanov@hospital.local',
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Петрович',
      position: 'Главный врач',
      departmentId: administration.id,
      phone: '+7 (495) 123-00-01',
      phoneInternal: '101',
      bio: 'Главный врач больницы с 2015 года. Кандидат медицинских наук.',
    },
    {
      email: 'petrova@hospital.local',
      firstName: 'Мария',
      lastName: 'Петрова',
      middleName: 'Александровна',
      position: 'Заведующая терапевтическим отделением',
      departmentId: therapy.id,
      phone: '+7 (495) 123-00-02',
      phoneInternal: '201',
      bio: 'Врач высшей категории. Опыт работы более 20 лет.',
    },
    {
      email: 'sidorov@hospital.local',
      firstName: 'Алексей',
      lastName: 'Сидоров',
      middleName: 'Николаевич',
      position: 'Хирург',
      departmentId: surgery.id,
      phone: '+7 (495) 123-00-03',
      phoneInternal: '301',
      bio: 'Ведущий хирург. Специализация: абдоминальная хирургия.',
    },
    {
      email: 'kozlova@hospital.local',
      firstName: 'Елена',
      lastName: 'Козлова',
      middleName: 'Владимировна',
      position: 'Кардиолог',
      departmentId: cardiology.id,
      phone: '+7 (495) 123-00-04',
      phoneInternal: '211',
      bio: 'Врач-кардиолог. Специализация: аритмология.',
    },
    {
      email: 'novikov@hospital.local',
      firstName: 'Дмитрий',
      lastName: 'Новиков',
      middleName: 'Игоревич',
      position: 'Невролог',
      departmentId: neurology.id,
      phone: '+7 (495) 123-00-05',
      phoneInternal: '221',
      bio: 'Врач-невролог первой категории.',
    },
    {
      email: 'nurse1@hospital.local',
      firstName: 'Анна',
      lastName: 'Смирнова',
      middleName: 'Сергеевна',
      position: 'Старшая медсестра',
      departmentId: therapy.id,
      phone: '+7 (495) 123-00-10',
      phoneInternal: '202',
      bio: 'Старшая медицинская сестра терапевтического отделения.',
    },
  ];

  const userPassword = await bcrypt.hash('user123', 12);

  for (const userData of users) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: { departmentId: userData.departmentId },
      create: {
        ...userData,
        password: userPassword,
        isAdmin: false,
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${users.length} test users`);

  // Обновляем руководителей отделений
  const headIvanov = await prisma.user.findUnique({ where: { email: 'ivanov@hospital.local' } });
  const headPetrova = await prisma.user.findUnique({ where: { email: 'petrova@hospital.local' } });
  const headSidorov = await prisma.user.findUnique({ where: { email: 'sidorov@hospital.local' } });

  if (headIvanov) {
    await prisma.department.update({ where: { id: hospital.id }, data: { headId: headIvanov.id } });
    await prisma.department.update({ where: { id: administration.id }, data: { headId: headIvanov.id } });
  }
  if (headPetrova) {
    await prisma.department.update({ where: { id: therapy.id }, data: { headId: headPetrova.id } });
  }
  if (headSidorov) {
    await prisma.department.update({ where: { id: surgery.id }, data: { headId: headSidorov.id } });
  }

  console.log('✅ Updated department heads');

  // Создаем тестовые сообщения
  if (admin && headIvanov && headPetrova) {
    await prisma.message.create({
      data: {
        senderId: headIvanov.id,
        subject: 'Важное объявление для всех сотрудников',
        content: 'Уважаемые коллеги!\n\nНапоминаю, что в пятницу состоится общее собрание коллектива в актовом зале в 14:00.\n\nЯвка обязательна.\n\nС уважением,\nГлавный врач',
        isImportant: true,
        recipients: {
          create: [
            { userId: admin.id },
            { userId: headPetrova.id },
          ],
        },
      },
    });

    await prisma.message.create({
      data: {
        senderId: headPetrova.id,
        subject: 'Новые протоколы лечения',
        content: 'Коллеги,\n\nВ системе документооборота размещены обновленные протоколы лечения. Прошу ознакомиться.\n\nС уважением,\nМария Петрова',
        isImportant: false,
        recipients: {
          create: [
            { userId: admin.id },
          ],
        },
      },
    });
  }

  console.log('✅ Created test messages');

  console.log('\n🎉 Database seed completed!');
  console.log('\n📋 Demo accounts (development only):');
  console.log('   Admin: admin@hospital.local / admin123');
  console.log('   Other users: password user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
